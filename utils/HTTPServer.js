const express = require('express');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');

const indexRoutes = require('../routes/index');
const adminRoutes = require('../routes/admin');

function HTTPServer(app) {
  const server = express();
  const httpServer = require('http').createServer(server);

  server.set('view engine', 'pug');
  server.set('views', 'views');

  server.use(logger('dev'));
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(cookieParser());
  server.use(express.static('public'));

  server.use('/', indexRoutes(app));
  server.use('/admin', adminRoutes(app));

  server.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  server.use(function (err, req, res, next) {
    res.sendStatus(err.status || 500);
    console.log(err);
  });

  return {
    express: server,
    http: httpServer
  };
}

module.exports = HTTPServer;