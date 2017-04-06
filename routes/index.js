var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Place Reloaded' });
});

router.get('/boardinfo', function (req, res, next) {
  var boardInfo = {
    width: req.width,
    height: req.height,
    palette: req.palette,
  };

  res.json(boardInfo);
});

module.exports = router;