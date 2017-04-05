var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var http = require('http');
var config = require('./config');
var WebSocket = require('ws');

var boardData = new Uint32Array(config.width * config.height);
var needWrite = false;
var connectedClients = 0;
var clients = [];
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
        var data = {
          type: 'pixel',
          x: j,
          y: i,
          color: config.clearColor,
        };
        wss.broadcast(JSON.stringify(data));
      }
    }

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
    connectedClients++;
    var ip = formatIP(ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.connection.remoteAddress);
    if (typeof clients[ip] === 'undefined') {
      clients[ip] = { cooldown: 0 };
      ws.send(JSON.stringify({ type: 'cooldown', wait: 0 }));
    } else {
      var now = Date.now();
      var diff = (clients[ip].cooldown - now) / 1000;
      if (diff >= 0)
        ws.send(JSON.stringify({ type: 'cooldown', wait: Math.ceil(diff) }));
    }

    ws.on('close', function () {
      connectedClients--;
    });

    ws.on('message', function (data) {
      var data = JSON.parse(data);
      if (data.type === "place") {
        console.log('Place ' + ip);
        var x = data.x;
        var y = data.y;
        var color = data.color;

        if (x < 0 || x >= config.width || y < 0 || y >= config.height || color < 0 || color > config.palette.length) return;

        if (checkRestricted(x, y)) {
          ws.send(JSON.stringify({ type: 'alert', message: 'Area is restricted' }));
          return;
        }

        var now = Date.now();
        if (typeof clients[ip].cooldown === 'undefined' || clients[ip].cooldown - now <= 0) {
          clients[ip].cooldown = now + (1000 * config.cooldown);
          var diff = config.cooldown;

          var position = y * config.height + x;
          boardData[position] = color;
          needWrite = true;
          data.type = 'pixel';
          wss.broadcast(JSON.stringify(data));
          ws.send(JSON.stringify({ type: 'cooldown', wait: diff }));
        }
      } else if (data.type === 'chat') {
        if (typeof clients[ip].chat_id === 'undefined') {
          clients[ip].chat_id = Math.random().toString(36).substr(2, 5);
        }

        if (data.message === '') {
          return;
        }

        var now = Date.now();
        if (typeof clients[ip].chat_limit !== 'undefined') {
          var delta = now - clients[ip].chat_limit;
          if (delta < 0) {
            console.log("CHAT-LIMIT: " + ip + ' - ' + data.message);
            clients[ip].chat_limit = now + config.cooldown_chat;
            ws.send(JSON.stringify({ type: 'alert', message: 'Chat rate limited' }));
            return;
          }
        }

        clients[ip].chat_limit = now + config.cooldown_chat;
        // Needs to go into a log file...
        console.log("CHAT: " + ip + ' - ' + data.message);
        data.chat_id = clients[ip].chat_id;
        wss.broadcast(JSON.stringify(data));
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

    for (var i = 0, j = config.width * config.height; i < j; i++) {
      boardData[i] = data.charCodeAt(i);
    }

    synchroniseFile();
    onReady();
  });
} else {
  var numElements = config.width * config.height;
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
