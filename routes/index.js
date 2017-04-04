var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Testing' });
});

router.get('/boardinfo', function (req, res, next) {
  var boardInfo = {
    width: req.width,
    height: req.height,
    palette: req.palette,
  };

  res.json(boardInfo);
});

router.get('/alert-test', function (req, res, next) {
  var obj = {
    type: 'alert',
    message: 'Test',
  };
  req.wss.broadcast(JSON.stringify(obj));
  res.send('Test sent');
});

module.exports = router;