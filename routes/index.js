const express = require('express');

function Router(app) {
  let router = express.Router();

  /* GET home page. */
  router.get('/', function (req, res, next) {
    res.render('index', { title: app.config.app_title, enable_restrictions: app.config.enable_restrictions });
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

  router.get('/restricted', (req, res) => {
    if (!app.config.enable_restrictions) return res.sendStatus(405);

    app.getRestrictedDb().find({}, function (err, docs) {
      res.json(docs);
    });
  });

  return router;
}

module.exports = Router;