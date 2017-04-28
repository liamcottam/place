const express = require('express');
const Jimp = require('jimp');

const Pixel = require('../models/Pixel');
const Restriction = require('../models/Restriction');

function Router(app) {
  let router = express.Router();

  /* GET home page. */
  router.get('/', function (req, res, next) {
    res.render('index', { title: app.config.app_title, enable_restrictions: app.config.enable_restrictions, allow_custom_colors: app.config.allow_custom_colors });
  });

  /* GET board info. */
  router.get('/boardinfo', function (req, res, next) {
    res.json({
      width: app.config.width,
      height: app.config.height,
      custom_colors: app.config.allow_custom_colors,
      palette: app.config.palette,
    });
  });

  router.get('/pixel', (req, res, next) => {
    if (!req.query.x || !req.query.y) return res.sendStatus(400);

    Pixel.findOne({ xPos: req.query.x, yPos: req.query.y }, { _id: 0, __v: 0, ip: 0 }, function (err, pixel) {
      if (err) return res.sendStatus(500);

      if (pixel) {
        if (pixel.anon) {
          pixel.username = 'anonymous';
        }

        Reflect.deleteProperty(pixel, 'is_anon');
      }

      res.json(pixel);
    });
  });

  router.get('/boarddata', function (req, res, next) {
    if (!app.image) return res.sendStatus(503);

    app.image.getBuffer(Jimp.MIME_PNG, function (err, buffer) {
      if (err) throw err;
      res.set('Expires', 0)
        .set('Pragma', 'no-cache')
        .set('Cache-Control', 'no-cache, no-store, must-revalidate')
        .set('Content-Type', 'image/png')
        .send(buffer);
    });
  });

  router.get('/restricted', (req, res) => {
    if (!app.config.enable_restrictions) return res.sendStatus(405);

    Restriction.find({}, { _id: 0, __v: 0 }, function (err, restrictions) {
      res.json(restrictions);
    });
  });

  return router;
}

module.exports = Router;
