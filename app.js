var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var config = require('./config');
var WebSocket = require('ws');

const fs = require('fs');
const crypto = require('crypto');
var saltLength = 64;

// TODO: Move to proper database, mongodb perhaps
const Datastore = require('nedb');
const user_db = new Datastore({ filename: 'users.nedb', autoload: true });
const session_db = new Datastore({ filename: 'sessions.nedb', autoload: true });
const banned_db = new Datastore({ filename: 'banned.nedb', autoload: true });
const restricted_db = new Datastore({ filename: 'restrictions.nedb', autoload: true });

var numElements = config.width * config.height;
var boardData = new Uint32Array(numElements);
var needWrite = false;
var connectedClients = 0;
var clients = [];
var ipClients = [];

function checkRestricted(x, y, username, callback) {
  restricted_db.findOne({
    $and: [
      { 'start.x': { $lte: x } },
      { 'start.y': { $lte: y } },
      { 'end.x': { $gte: x } },
      { 'end.y': { $gte: y } }
    ]
  }, function (err, restriction) {
    callback(restriction !== null);
  });
}

function checkIntersect(startPosition, endPosition, username, callback) {
  restricted_db.findOne({
    $or: [
      {
        $and: [
          { 'start.x': { $lte: startPosition.x } },
          { 'start.y': { $lte: startPosition.y } },
          { 'end.x': { $gte: startPosition.x } },
          { 'end.y': { $gte: startPosition.y } }
        ],
      },
      {
        $and: [
          { 'start.x': { $lte: endPosition.x } },
          { 'start.y': { $lte: endPosition.y } },
          { 'end.x': { $gte: endPosition.x } },
          { 'end.y': { $gte: endPosition.y } }
        ]
      }
    ]
  }, function (err, restriction) {
    callback(restriction !== null);
  });
}

function formatIP(ip) {
  ip = ip.split(',')[0];
  ip = ip.split(':').slice(-1);
  return ip;
}

function generateSalt() {
  return crypto.randomBytes(Math.ceil(saltLength / 2))
    .toString('hex')
    .slice(0, saltLength);
}

function hash(password, salt) {
  var hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  var value = hash.digest('hex');
  return {
    hash: value,
    salt: salt,
  };
}

function saltHash(password) {
  var salt = generateSalt();
  var passwordData = hash(password, salt);

  return {
    hash: passwordData.hash,
    salt: passwordData.salt,
  };
}

function checkPassword(password, hashedPassword, salt) {
  if (hash(password, salt).hash === hashedPassword) {
    return true;
  }

  return false;
}

function authenticateUser(username, password, session_id) {
  if (username.length === 0 || password.length === 0) {
    clients[session_id].ws.send(JSON.stringify({
      type: 'authenticate',
      success: false,
      message: 'Username/password required'
    }));

    return;
  }

  // Check if user exists
  user_db.findOne({ username: username }, function (err, user) {
    if (err) throw err;
    if (user) {

      if (checkPassword(password, user.hash, user.salt)) {
        console.log('AUTH-SUCCESS: %s (%s) - %s', clients[session_id].ip, session_id, username);
        clients[session_id].username = username;
        clients[session_id].is_moderator = user.is_moderator;
        var session_key = generateSalt();

        var response = {
          type: 'authenticate',
          success: true,
          session_key: session_key,
        }
        if (user.is_moderator) {
          response.is_moderator = true;
        }
        clients[session_id].ws.send(JSON.stringify(response));

        session_db.update({ username: username }, { username: username, key: session_key, valid_until: Date.now() + (1000 * 60 * 60 * 60 * 24) }, { upsert: true });
      } else {
        console.log('AUTH-FAIL: %s (%s) - %s', clients[session_id].ip, session_id, username);
        clients[session_id].ws.send(JSON.stringify({
          type: 'authenticate',
          success: false,
          message: 'Username or password incorrect',
        }));
      }
    } else {
      if (password.length < 6) {
        clients[session_id].ws.send(JSON.stringify({
          type: 'authenticate',
          success: false,
          message: 'Password must be at least 6 characters'
        }));

        return;
      }

      var data = saltHash(password);
      clients[session_id].username = username;
      var session_key = generateSalt();

      user_db.insert({
        username: username,
        hash: data.hash,
        salt: data.salt
      });

      clients[session_id].ws.send(JSON.stringify({
        type: 'authenticate',
        success: true,
        message: 'Created new account with password provided',
        session_key, session_key,
      }));

      session_db.update({ username: username }, { username: username, key: session_key, valid_until: Date.now() + (1000 * 60 * 60 * 60 * 24) }, { upsert: true });
    }
  });
}

function authenticateSession(username, session_key, session_id) {
  user_db.findOne({ username: username }, function (err, user) {
    if (err) throw err;
    if (!user) return;

    session_db.findOne({ username: username, key: session_key }, function (err, session) {
      if (err) throw err;

      if (session && session.valid_until > Date.now()) {
        console.log('REAUTH: %s (%s) - %s', clients[session_id].ip, session_id, username);
        clients[session_id].username = username;
        clients[session_id].is_moderator = user.is_moderator;

        clients[session_id].ws.send(JSON.stringify({
          type: 'reauth',
          success: true
        }));
      } else {
        console.log('REAUTH-FAIL: %s (%s) - %s', clients[session_id].ip, session_id, username);
        clients[session_id].ws.send(JSON.stringify({
          type: 'reauth',
          success: false,
          message: 'Invalid session',
        }));
      }
    });
  });
}

function checkBanned(ip, callback) {
  banned_db.findOne({ ip: ip }, function (err, ip) {
    if (err) throw err;
    if (ip === null) return callback(false);
    return callback(true);
  });
}

function onReady() {
  var app = express();
  var server = http.createServer(app);
  var wss = new WebSocket.Server({ server });

  wss.broadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'pug');
  //app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/boarddata', function (req, res, next) {
    res.send(new Buffer(boardData));
  });

  app.get('/users', function (req, res, next) {
    res.json(connectedClients);
  });

  app.get('/cooldown', function (request, res, next) {
    var ip = formatIP(request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      request.connection.socket.remoteAddress);

    if (typeof ipClients[ip] !== 'undefined') {
      var diff = (ipClients[ip].cooldown - Date.now()) / 1000;
      if (diff <= 0) {
        res.json(0);
      } else {
        res.json(Math.ceil(diff));
      }
    } else {
      res.json(0);
    }
  });

  var index = require('./routes/index');
  app.use(function (req, res, next) {
    req.wss = wss;
    req.width = config.width;
    req.height = config.height;
    req.palette = config.palette;
    next();
  });
  app.use('/', index);

  var auth = require('http-auth');
  var basic = auth.basic({
    realm: "KillTheIdols",
    file: __dirname + "/.htpasswd"
  });

  app.get('/restricted', (req, res) => {
    restricted_db.find({}, function(err, docs) {
      res.json(docs);
    });
  });

  app.get('/admin', auth.connect(basic), (req, res) => {
    res.render('admin', { title: 'Admin Area' });
  });

  app.get('/admin/backups', auth.connect(basic), (req, res) => {
    fs.readdir('./backups', function (err, files) {
      if (err) {
        console.error(err);
        return;
      }

      var backups = [];
      files.forEach(file => {
        backups.push(file);
      });

      res.json(backups);
    });
  });

  app.post('/admin/announce', auth.connect(basic), (req, res) => {
    var obj = {
      type: 'alert',
      message: req.body.message,
    };
    req.wss.broadcast(JSON.stringify(obj));
    res.sendStatus(200);
  });

  app.post('/admin/delete', auth.connect(basic), (req, res) => {
    var data = req.body;

    var obj = {
      start: {
        x: parseInt(data.startx),
        y: parseInt(data.starty)
      },
      end: {
        x: parseInt(data.endx),
        y: parseInt(data.endy)
      }
    }

    var position = 0;
    for (var i = obj.start.y; i <= obj.end.y; i++) {
      for (var j = obj.start.x; j <= obj.end.x; j++) {
        position = (i * config.height) + j;
        boardData[position] = config.clearColor;
      }
    }

    needWrite = true;
    var data = { type: 'force-sync' };
    wss.broadcast(JSON.stringify(data));
    res.sendStatus(200);
  });

  app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  app.use(function (err, req, res, next) {
    res.sendStatus(err.status || 500);
    console.log(err);
  });

  var userArray = [];
  setInterval(function () {
    userArray = [];
    for (key in clients) {
      if (clients[key].connected) {
        if (clients[key].username !== null) {
          userArray.push(clients[key].username);
        } else {
          userArray.push(key);
        }
      }
    }

    wss.broadcast(JSON.stringify({ type: 'users', users: userArray }));
  }, 3000);

  wss.on('connection', function connection(ws) {
    connectedClients++;
    var ip = formatIP(ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.connection.remoteAddress);
    var id = Math.random().toString(36).substr(2, 5);

    // IP is only used for cooldowns
    if (typeof ipClients[ip] === 'undefined') {
      ipClients[ip] = {
        cooldown: 0,
        cooldown_chat: 0,
      };
    }

    ws.on('close', function () {
      delete clients[id];
      connectedClients--;
    });

    clients[id] = { ready: false };

    checkBanned(ip, function (isBanned) {
      clients[id].banned = isBanned;
      clients[id].ready = true;

      if (isBanned) {
        console.log('BANNED USER ATTEMPTED CONNECTION: %s - (%s)', ip);
        ws.send(JSON.stringify({
          type: 'alert',
          message: 'This IP address is banned'
        }));

        clients[id] = { banned: true, ready: true };
      } else {
        clients[id] = {
          id: id,
          ip: ip,
          username: null,
          is_moderator: false,
          ws: ws,
          connected: true,
          ready: false,
          banned: false
        };

        ws.send(JSON.stringify({ type: 'session', session_id: id, users: userArray }));
      }
    });

    if (userArray.length === 0) {
      for (key in clients) {
        if (clients[key].connected) {
          if (clients[key].username !== null) {
            userArray.push(clients[key].username);
          } else {
            userArray.push(key);
          }
        }
      }

      wss.broadcast(JSON.stringify({ type: 'users', users: userArray }));
    }

    ws.on('message', function (data) {
      if (typeof clients[id] === 'undefined') {
        ws.send(JSON.stringify({ type: 'alert', message: 'Invalid session, please refresh' }));
        return;
      }

      if (clients[id].banned) {
        ws.send(JSON.stringify({
          type: 'alert',
          message: 'This IP address is banned'
        }));
        return;
      }

      try {
        var data = JSON.parse(data);
      } catch (err) {
        console.error('Invalid JSON: ' + err);
        console.log(data);
      }

      if (data.type === "place") {
        var x = data.x;
        var y = data.y;
        var color = data.color;
        console.log('PLACE: %s (%s) - %s, %s, %s', ip, id, x, y, color);

        if (x < 0 || x >= config.width || y < 0 || y >= config.height || color < 0 || color > config.palette.length) {
          console.log('PLACE: OOB');
          return;
        }

        var now = Date.now();
        if (typeof ipClients[ip].cooldown === 'undefined' || ipClients[ip].cooldown - now >= 0 && !clients[id].is_moderator) {
          console.log('PLACE: Attempted Place Before Cooldown');
          return;
        }

        if (clients[id].is_moderator) {
          var position = (y * config.height) + x;
          if (boardData[position] === color) return;
          var diff = 0;
          if (!clients[id].is_moderator) {
            ipClients[ip].cooldown = now + (1000 * config.cooldown);
            diff = config.cooldown;
          }

          data.session_id = (clients[id].username !== null) ? clients[id].username : clients[id].id;
          boardData[position] = color;
          needWrite = true;
          data.type = 'pixel';
          wss.broadcast(JSON.stringify(data));
          ws.send(JSON.stringify({ type: 'cooldown', wait: diff }));
        } else {
          if (checkRestricted(x, y, null, function (restricted) {
            if (restricted) {
              console.log('PLACE: Restricted Area');
              ws.send(JSON.stringify({ type: 'alert', message: 'Area is restricted' }));
              return;
            } else {
              var position = (y * config.height) + x;
              if (boardData[position] === color) return;
              var diff = 0;
              if (!clients[id].is_moderator) {
                ipClients[ip].cooldown = now + (1000 * config.cooldown);
                diff = config.cooldown;
              }

              data.session_id = (clients[id].username !== null) ? clients[id].username : clients[id].id;
              boardData[position] = color;
              needWrite = true;
              data.type = 'pixel';
              wss.broadcast(JSON.stringify(data));
              ws.send(JSON.stringify({ type: 'cooldown', wait: diff }));
            }
          }));
        }
      } else if (data.type === 'chat') {
        if (data.message === '') return;
        var now = Date.now();
        if (typeof ipClients[ip].chat_limit !== 'undefined') {
          var delta = now - ipClients[ip].chat_limit;
          if (delta < 0) {
            console.log("CHAT-LIMIT: %s (%s) - %s", ip, id, data.message);
            ipClients[ip].chat_limit = now + config.cooldown_chat;
            ws.send(JSON.stringify({ type: 'alert', message: 'Chat rate limit exceeded' }));
            return;
          }
        }

        ipClients[ip].chat_limit = now + config.cooldown_chat;
        console.log("CHAT: %s (%s) - %s", ip, id, data.message);
        if (clients[id].username !== null) {
          data.chat_id = clients[id].username;
        } else {
          data.chat_id = clients[id].id;
        }

        wss.broadcast(JSON.stringify(data));
      } else if (data.type === 'auth') {
        authenticateUser(data.username, data.password, id);
      } else if (data.type === 'reauth') {
        authenticateSession(data.username, data.session_key, id);
      } else if (data.type === 'logout') {
        var new_id = Math.random().toString(36).substr(2, 5);
        var old_client = clients[id];
        delete clients[id];
        id = new_id;
        clients[id] = old_client;
        clients[id].id = id;
        clients[id].username = null;
        clients[id].is_moderator = false;
      } else if (data.type === 'cooldown' && clients[id].is_moderator) {
        var session_id = null;
        var cooldown = {
          type: 'cooldown',
          wait: 30
        };
        if (typeof clients[data.session_id] !== 'undefined' && typeof clients[data.session_id].ws !== 'undefined') {
          session_id = data.session_id;
        } else {
          for (key in clients) {
            if (clients[key].username === data.session_id) {
              session_id = key
              break;
            }
          }
        }

        if (session_id !== null && !clients[session_id].is_moderator) {
          ipClients[clients[session_id].ip].cooldown = Date.now() + (1000 * cooldown.wait);
          clients[session_id].ws.send(JSON.stringify(cooldown));

          ws.send(JSON.stringify({
            type: 'alert',
            message: 'Cooldown for ' + data.session_id + ' succeeded'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'alert',
            message: 'Cooldown for ' + data.session_id + ' failed'
          }));
        }
      } else if (data.type === 'ban' && clients[id].is_moderator) {
        var session_id = null;
        var message = {
          type: 'alert',
          message: 'This IP address is banned'
        };
        if (typeof clients[data.session_id] !== 'undefined' && typeof clients[data.session_id].ws !== 'undefined') {
          session_id = data.session_id;
        } else {
          for (key in clients) {
            if (clients[key].username === data.session_id) {
              session_id = key
              break;
            }
          }
        }

        if (session_id !== null && !clients[session_id].is_moderator) {
          clients[session_id].ws.send(JSON.stringify(message));
          banned_db.insert({ ip: clients[session_id].ip });

          // Invalidate entire session
          delete clients[session_id];

          ws.send(JSON.stringify({
            type: 'alert',
            message: 'Ban for ' + data.session_id + ' succeeded'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'alert',
            message: 'Ban for ' + data.session_id + ' failed'
          }));
        }
      } else if (data.type === 'restriction' && clients[id].is_moderator) {
        delete data.type;
        if (data.end.x <= data.start.x || data.end.y <= data.start.y) {
          ws.send(JSON.stringify({ type: 'alert', message: 'Invalid Region Submitted' }));
        } else {
          checkIntersect(data.start, data.end, null, function (intersects) {
            if (!intersects) {
              restricted_db.insert(data);
              ws.send(JSON.stringify({ type: 'alert', message: 'Restriction Created' }));
            } else {
              ws.send(JSON.stringify({ type: 'alert', message: 'The selection intersects an already created restriction' }));
            }
          });
        }
      } else {
        console.log('WS: Unknown Request', data);
        console.log(data);
        ws.send(JSON.stringify({
          type: 'alert',
          message: 'Unknown Request'
        }));
      }
    });
  });

  server.listen(config.port, function () {
    console.log('Listening on port %d', server.address().port);
  });
}

function synchroniseFile() {
  if (needWrite) {
    needWrite = false;
    fs.writeFile(config.boardFilenameTemp, new Buffer(boardData), function (err) {
      if (err) {
        throw err;
        process.exit(1);
      }

      fs.rename(config.boardFilenameTemp, config.boardFilename, function (err) {
        if (err) {
          throw err;
          process.exit(1);
        }

        setTimeout(synchroniseFile, 100);
      });
    });
  } else {
    setTimeout(synchroniseFile, 100);
  }
}


if (!fs.existsSync('.htpasswd')) {
  fs.writeFile('.htpasswd', 'user:user', function (err) {
    if (err) throw err;

    console.log('Created default user with username and password user');
  })
}

if (fs.existsSync(config.boardFilename)) {
  fs.readFile(config.boardFilename, 'binary', function (err, data) {
    if (err) {
      throw err;
    }

    for (var i = 0, j = numElements; i < j; i++) {
      boardData[i] = data.charCodeAt(i);
    }

    synchroniseFile();
    onReady();
  });
} else {
  var array = new Uint32Array(numElements);
  for (var i = 0; i < numElements; i++) {
    array[i] = config.clearColor;
  }

  fs.writeFile(config.boardFilename, new Buffer(array), function (err) {
    if (err) {
      console.error('Failed to create data file');
      throw err;
    }

    onReady();
    synchroniseFile();
  });
}
