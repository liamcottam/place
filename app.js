var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var http = require('http');
var config = require('./config');
var WebSocket = require('ws');

const crypto = require('crypto');
var saltLength = 64;

// TODO: Move to proper database, mongodb perhaps
const Datastore = require('nedb');
const user_db = new Datastore({ filename: 'users.nedb', autoload: true });
const session_db = new Datastore({ filename: 'sessions.nedb', autoload: true });

var numElements = config.width * config.height;
var boardData = new Uint32Array(numElements);
var needWrite = false;
var connectedClients = 0;
var clients = [];
var clientIPMap = [];

// TODO: Move to DB/File or something
var restrictedRegions = [
  { // UK Flag
    start: { x: 305, y: 970 },
    end: { x: 345, y: 997 }
  },
  { // Hitler
    start: { x: 356, y: 930 },
    end: { x: 385, y: 969 }
  },
  { // Egg
    start: { x: 394, y: 925 },
    end: { x: 435, y: 972 }
  },
  { // Czech Flag
    start: { x: 318, y: 407 },
    end: { x: 400, y: 459 }
  },
  { // Czech Flag
    start: { x: 318, y: 407 },
    end: { x: 400, y: 459 }
  },
  { // Pikachu
    start: { x: 942, y: 688 },
    end: { x: 983, y: 729 }
  },
  { // Sad man
    start: { x: 639, y: 88 },
    end: { x: 671, y: 126 }
  },
  { // Mr.T
    start: { x: 573, y: 114 },
    end: { x: 600, y: 153 }
  },
  { // Squidward
    start: { x: 601, y: 130 },
    end: { x: 687, y: 248 }
  },
  { // Charmander and misc
    start: { x: 595, y: 402 },
    end: { x: 633, y: 466 }
  },
  {
    start: { x: 470, y: 5 },
    end: { x: 531, y: 64 }
  },
  {
    start: { x: 561, y: 43 },
    end: { x: 647, y: 126 }
  },
  { // Serperior
    start: { x: 455, y: 138 },
    end: { x: 505, y: 209 }
  },
  { // Serperior
    start: { x: 147, y: 139 },
    end: { x: 239, y: 199 }
  },
  { // Serperior
    start: { x: 111, y: 214 },
    end: { x: 232, y: 238 }
  },
];

function checkRestricted(x, y) {
  for (var i = 0; i < restrictedRegions.length; i++) {
    if (x >= restrictedRegions[i].start.x && x <= restrictedRegions[i].end.x && y >= restrictedRegions[i].start.y && y <= restrictedRegions[i].end.y) {
      return true;
    }
  }

  return false;
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
  var user = user_db.findOne({ username: username }, function (err, user) {
    if (err) throw err;
    if (user) {

      if (checkPassword(password, user.hash, user.salt)) {
        clients[session_id].username = username;
        clients[session_id].is_moderator = user.is_moderator;
        var session_key = generateSalt();

        clients[session_id].ws.send(JSON.stringify({
          type: 'authenticate',
          success: true,
          session_key: session_key,
        }));

        session_db.update({ username: username }, { username: username, key: session_key, valid_until: Date.now() + (1000 * 60 * 60 * 60 * 24) }, { upsert: true });
      } else {
        console.log('failed login attempt');
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
        clients[session_id].username = username;
        clients[session_id].is_moderator = user.is_moderator;

        clients[session_id].ws.send(JSON.stringify({
          type: 'reauth',
          success: true
        }));
      } else {
        console.log('invalid session');
        clients[session_id].ws.send(JSON.stringify({
          type: 'reauth',
          success: false,
          message: 'Invalid session',
        }));
      }
    });
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

    if (typeof clients[ip] !== 'undefined') {
      var diff = (clients[ip].cooldown - Date.now()) / 1000;
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

  app.get('/admin', auth.connect(basic), (req, res) => {
    res.render('admin', { title: 'Pxls' });
  });

  app.post('/admin/announce', auth.connect(basic), (req, res) => {
    var obj = {
      type: 'alert',
      message: req.body.message,
    };
    req.wss.broadcast(JSON.stringify(obj));
    res.sendStatus(200);
  });

  app.post('/admin/remove-square', auth.connect(basic), (req, res) => {
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
  });

  wss.on('connection', function connection(ws) {
    ws.authenticated = false;
    connectedClients++;
    var ip = formatIP(ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.connection.remoteAddress);
    var id = Math.random().toString(36).substr(2, 5);
    var hasSession = false;

    // Check for previous session by ip
    if (typeof clientIPMap[ip] !== 'undefined') {
      id = clientIPMap[ip];
    } else {
      clientIPMap[ip] = id;
    }

    if (typeof clients[id] === 'undefined') {
      clients[id] = { id: id, ip: ip, ws: ws };
    } else {
      clients[id].username = null;
      clients[id].is_moderator = false;
      clients[id].ws = ws;
    }

    ws.send(JSON.stringify({ session_id: id, type: 'session' }));

    ws.on('close', function () {
      connectedClients--;
    });

    ws.on('message', function (data) {
      try {
        var data = JSON.parse(data);
      } catch (err) {
        console.error('Invalid JSON: ' + err);
        console.log(data);
      }

      if (typeof clients[id] === 'undefined') {
        ws.send(JSON.stringify({ type: 'alert', message: 'Invalid session, please refresh' }));
      }

      if (data.type === "place") {
        var x = data.x;
        var y = data.y;
        console.log('PLACE ' + ip + ' (' + x + ',' + y + ')');
        var color = data.color;

        if (x < 0 || x >= config.width || y < 0 || y >= config.height || color < 0 || color > config.palette.length) {
          console.log('PLACE: OOB');
          return;
        }

        if (!clients[id].is_moderator === true && checkRestricted(x, y)) {
          ws.send(JSON.stringify({ type: 'alert', message: 'Area is restricted' }));
          return;
        }

        var now = Date.now();
        if (typeof clients[id].cooldown === 'undefined' || clients[id].cooldown - now <= 0) {
          var diff = 0;
          if (!clients[id].is_moderator) {
            clients[id].cooldown = now + (1000 * config.cooldown);
            diff = config.cooldown;
          }

          var position = (y * config.height) + x;
          data.prevColor = boardData[position];
          boardData[position] = color;
          needWrite = true;
          data.type = 'pixel';
          wss.broadcast(JSON.stringify(data));
          ws.send(JSON.stringify({ type: 'cooldown', wait: diff }));
        }
      } else if (data.type === 'chat') {

        if (data.message === '') return;
        var now = Date.now();
        if (typeof clients[id].chat_limit !== 'undefined') {
          var delta = now - clients[id].chat_limit;
          if (delta < 0) {
            console.log("CHAT-LIMIT: " + ip + ' - ' + data.message);
            clients[id].chat_limit = now + config.cooldown_chat;
            ws.send(JSON.stringify({ type: 'alert', message: 'Chat rate limit exceeded' }));
            return;
          }
        }

        clients[id].chat_limit = now + config.cooldown_chat;
        console.log("CHAT: " + ip + ' - ' + data.message);
        if (typeof clients[id].username !== 'undefined') {
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
        clients[id] = { id: Math.random().toString(36).substr(2, 5), ip: ip, ws: ws };
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
