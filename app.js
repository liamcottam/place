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
  app.use(logger('dev'));
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
      var x = data.x;
      var y = data.y;
      var color = data.color;

      if (x < 0 || x >= config.width || y < 0 || y >= config.height || color < 0 || color > config.palette.length) return;
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
    });
  });

  server.listen(3000, function () {
    console.log('Listening on %d', server.address().port);
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