const express = require('express');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

const indexRoutes = require('../routes/index');
const adminRoutes = require('../routes/admin');

function HTTPServer(app) {
  const server = express();
  const httpServer = require('http').createServer(server);

  const sessionMiddleware = session({
    store: new MongoStore({
      mongooseConnection: app.mongooseConnection,
      touchAfter: 3600
    }),
    secret: app.config.secret,
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 14,
      httpOnly: true,
      sameSite: 'strict',
      secure: app.config.https,
      domain: app.config.domain
    }
  });

  server.set('trust proxy', 1);
  server.set('view engine', 'pug');
  server.set('views', 'views');

  server.use(logger('dev'));
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(cookieParser());
  server.use(express.static('public'));
  server.use(sessionMiddleware);

  server.use('/', indexRoutes(app));
  server.use('/admin', adminRoutes(app));

  server.use(function (err, req, res, next) {
    res.sendStatus(err.status || 500);
    app.log.error(err);
  });

  return {
    express: server,
    http: httpServer,
    sessionMiddleware: sessionMiddleware
  };
}

module.exports = HTTPServer;