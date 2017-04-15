const fs = require('fs');
const path = require('path');
const express = require('express');

function Router(app) {
  let router = express.Router();

  var auth = require('http-auth');
  var basic = auth.basic({
    realm: "KillTheIdols",
    file: ".htpasswd"
  });

  /* GET Admin Root. */
  router.get('/', auth.connect(basic), (req, res) => {
    res.render('admin', { title: 'Admin Area' });
  });

  router.get('/backups', auth.connect(basic), (req, res) => {
    var dir = path.join(__dirname, '../backups/');
    fs.readdir(dir, function (err, files) {
      if (err) {
        console.error(err);
        return res.status(500).send(err);
      }

      files.sort(function (a, b) {
        return fs.statSync(dir + a).mtime.getTime() - fs.statSync(dir + b).mtime.getTime();
      });

      var backups = [];
      files.forEach(file => {
        backups.push(file);
      });

      res.json(backups.reverse());
    });
  });

  router.post('/restore', auth.connect(basic), (req, res) => {
    var startx = parseInt(req.body.startx);
    var endx = parseInt(req.body.endx);
    var starty = parseInt(req.body.starty);
    var endy = parseInt(req.body.endy);
    var filename = req.body.filename;

    fs.readFile(path.join(__dirname, '../backups', filename), 'binary', function (err, data) {
      if (!err) {
        for (var i = starty; i <= endy; i++) {
          for (var j = startx; j <= endx; j++) {
            var position = (i * app.config.height) + j;
            app.boardData[position] = data.charCodeAt(position);
          }
        }

        app.needWrite = true;
        app.websocket.emit('force-sync');
        res.sendStatus(200);
      }
    });
  });

  router.get('/backup/:filename', auth.connect(basic), (req, res) => {
    res.sendFile(path.join(__dirname, '../backups', req.params.filename));
  });

  router.post('/announce', auth.connect(basic), (req, res) => {
    app.websocket.emit('alert', req.body.message);
    res.sendStatus(200);
  });

  router.post('/delete', auth.connect(basic), (req, res) => {
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
        position = (i * app.config.height) + j;
        app.boardData[position] = app.config.clearColor;
      }
    }

    app.needWrite = true;
    app.websocket.emit('force-sync');
    res.sendStatus(200);
  });

  return router;
}

module.exports = Router;