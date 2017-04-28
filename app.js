const config = require('./config');
const ImageUtils = require('./utils/ImageUtils');
const HTTPServer = require('./utils/HTTPServer');
const WebsocketServer = require('./utils/WebsocketServer');
const mongoose = require('mongoose');

var app = {};
app.config = config;

app.formatIP = function (ip) {
  ip = ip.split(',')[0];
  ip = ip.split(':').slice(-1);
  return ip[0];
};

mongoose.Promise = global.Promise;
mongoose.connect(config.database, function (err) {
  if (err) throw err;
  app.mongooseConnection = mongoose.connection;

  app.ImageUtils = new ImageUtils(app);
  app.server = new HTTPServer(app);
  app.websocket = new WebsocketServer(app);
  app.server.http.listen(config.port, function () {
    console.log('Listening on port %d', app.server.http.address().port);
  });
});