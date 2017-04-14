const express = require('express');

function Router(app) {
  let router = express.Router();

  /* GET home page. */
  router.get('/', function (req, res, next) {
    res.render('index', { title: app.config.app_title });
  });

  /* GET board info. */
  router.get('/boardinfo', function (req, res, next) {
    res.json({
      width: app.config.width,
      height: app.config.height,
      palette: app.config.palette,
    });
  });

  router.get('/boarddata', function (req, res, next) {
    res.send(new Buffer(app.boardData));
  });

  router.get('/cooldown', function (request, res, next) {
    var ip = app.formatIP(request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      request.connection.socket.remoteAddress);

    if (typeof app.ipClients[ip] !== 'undefined') {
      var diff = (app.ipClients[ip].cooldown - Date.now()) / 1000;
      if (diff <= 0) {
        res.json(0);
      } else {
        res.json(Math.ceil(diff));
      }
    } else {
      res.json(0);
    }
  });

  router.get('/restricted', (req, res) => {
    app.getRestrictedDb().find({}, function (err, docs) {
      res.json(docs);
    });
  });

  return router;
}

module.exports = Router;