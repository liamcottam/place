const socketio = require('socket.io');
const Jimp = require('jimp');
const sharedsession = require("express-socket.io-session");

const Ban = require('../models/Ban');
const User = require('../models/User');
const Pixel = require('../models/Pixel');
const Restriction = require('../models/Restriction');

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function WebsocketServer(app) {
  const io = socketio(app.server.http);

  io.use(sharedsession(app.server.sessionMiddleware, {
    autoSave: true
  }));

  var ipClients = [];
  var clients = [];
  var connected_clients = 0;
  var config = app.config;

  var defaultIpSession = {
    cooldown: (config.connect_cooldown) ? Date.now() + (config.cooldown * 1000) : 0,
    cooldown_chat: (config.connect_cooldown) ? Date.now() + (config.cooldown_chat * 1000) : 0,
    connected: true
  };

  var userBroadcast = null;

  var userBroadcastFn = function () {
    var seen = [];
    userBroadcast = {
      connected: connected_clients,
      moderators: [],
      registered: [],
      anons: [],
    };
    for (key in clients) {
      if (clients[key].username) {
        if (seen.indexOf(clients[key].username) > -1) {
          userBroadcast.connected--;
          continue;
        }
        if (clients[key].is_moderator) userBroadcast.moderators.push(clients[key].username);
        else userBroadcast.registered.push(clients[key].username);
        seen.push(clients[key].username);
      } else {
        if (seen.indexOf(key) > -1) {
          userBroadcast.connected--;
          continue;
        }
        userBroadcast.anons.push(key);
        seen.push(key);
      }
    }

    return userBroadcast;
  }

  setInterval(function () {
    // TODO: Announce on join/disconnect
    if (connected_clients <= 50) {
      io.emit('users', userBroadcastFn());
    } else {
      io.emit('users', { connected: connected_clients });
    }
  }, 1000);

  io.on('connection', function (socket) {
    connected_clients++;
    var ip = app.formatIP(socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress);
    ipClients[ip] = (ipClients[ip]) ? ipClients[ip] : defaultIpSession;
    if (process.env.NODE_ENV !== 'production') {
      console.log('WS-CONNECTION: %s', ip);
    }

    var id = Math.random().toString(36).substr(2, 5);
    clients[id] = { ready: false };

    Ban.checkBanned(ip, function (banned) {
      if (banned) {
        console.log('BANNED USER ATTEMPTED CONNECTION: %s', ip);
        socket.emit('alert', 'You are banned.');
        clients[id] = { banned: true, ready: true };
      } else {
        clients[id] = {
          id: id,
          ip: ip,
          ws: socket,
          ready: true
        };

        // Generate a user broadcast if it was empty before-hand.
        if (userBroadcast === null || userBroadcast.connected === 0) userBroadcast = userBroadcastFn();

        var sessionData = { users: userBroadcast };
        if (socket.handshake.session.userdata) {
          sessionData.userdata = socket.handshake.session.userdata;
          sessionData.userdata.success = true;
          clients[id].username = sessionData.userdata.username;
          clients[id].is_moderator = sessionData.userdata.is_moderator;
        }

        if (!sessionData.userdata || !clients[id].is_moderator) {
          var diff = ipClients[ip].cooldown - Date.now();
          if (diff > 0) sessionData.cooldown = diff / 1000;
        }

        socket.emit('session', sessionData);
      }
    });

    socket.on('disconnect', function () {
      Reflect.deleteProperty(clients, id);
      connected_clients--;
    });

    socket.use(function (msocket, next) {
      if (typeof clients[id] === 'undefined') {
        socket.emit('alert', 'Invalid session, please refresh');
        return;
      }

      if (clients[id].banned) {
        socket.emit('alert', 'You are banned.');
        return;
      }

      if (!clients[id].ready) return;
      if (app.image === null) return;

      next();
    });

    socket.on('place', function (data) {
      let x = data.x;
      let y = data.y;
      let color = data.color;
      let anon = (clients[id].username) ? false : true;
      let username = (anon) ? clients[id].id : clients[id].username;
      data.session_id = username;
      console.log('PLACE: %s (%s) - %s, %s, %s', ip, username, x, y, color);

      // Ensure the pixel position is within the bounds of the board.
      if (x < 0 || x >= config.width || y < 0 || y >= config.height) return;

      // Tried to place before their cooldown has expired, ignore
      let now = Date.now();
      if (typeof ipClients[ip].cooldown === 'undefined' || ipClients[ip].cooldown - now > 0 && !clients[id].is_moderator) return;

      // Sent garbage data, ignore
      let rgb = hexToRgb(data.color);
      if (rgb === null) return;

      // Prevent placing colors that are not in the palette if allow_custom_colors is not enabled.
      if (!app.config.allow_custom_colors && app.config.palette.indexOf(data.color) === -1) return;

      // Prevent place for same color
      let jrgb = Jimp.rgbaToInt(rgb.r, rgb.g, rgb.b, 255);
      if (app.image.getPixelColor(x, y) === jrgb) return;

      // TODO: Fix code duplication
      if (clients[id].is_moderator) {
        Pixel.addPixel({
          x: x, y: y,
          color: rgb,
          ip: ip,
          username: username,
          anon: false
        }, function (err) {
          if (err) return console.error('Failed to process pixel!');
          io.emit('place', data);
          app.image.setPixelColor(jrgb, x, y);
        });
      } else {
        Restriction.checkRestricted(x, y, function (err, restricted) {
          if (err) return console.error(err);

          if (restricted === false) {
            Pixel.addPixel({
              x: x,
              y: y,
              color: rgb,
              ip: ip,
              username: username,
              anon: anon
            }, function (err) {
              if (err) return console.error('Failed to process pixel!');

              ipClients[ip].cooldown = now + (app.config.cooldown * 1000);
              socket.emit('cooldown', app.config.cooldown);
              io.emit('place', data);
              app.image.setPixelColor(jrgb, x, y);
            });
          } else {
            socket.emit('alert', 'Area is restricted');
          }
        });
      }
    });

    socket.on('chat', function (message) {
      var now = Date.now();
      if (typeof ipClients[ip].chat_limit !== 'undefined') {
        var delta = now - ipClients[ip].chat_limit;
        if (delta < 0) {
          console.log("CHAT-LIMIT: %s (%s) - %s", ip, id, message);
          ipClients[ip].chat_limit = now + config.cooldown_chat;
          socket.emit('alert', 'Chat rate limit exceeded');
          return;
        }
      }

      ipClients[ip].chat_limit = now + config.cooldown_chat;
      console.log("CHAT: %s (%s) - %s", ip, id, message);
      var data = { message: message };
      if (clients[id].username) {
        data.chat_id = clients[id].username;
        data.is_moderator = clients[id].is_moderator;
      } else {
        data.chat_id = clients[id].id;
      }

      io.emit('chat', data);
    });

    socket.on('auth', function (data) {
      User.authenticate({
        username: data.username,
        password: data.password
      }, function (err, user) {
        if (err) {
          console.log('AUTH-FAIL: %s (%s) - %s - ', ip, id, data.username, err);
          return socket.emit('auth', { success: false, message: err });
        }

        console.log('AUTH-SUCCESS: %s (%s) - %s', ip, id, data.username);
        clients[id].username = user.username;
        clients[id].is_moderator = user.is_moderator;
        if (user.is_moderator) socket.emit('cooldown', 0);

        socket.emit('auth', {
          success: true,
          username: user.username,
          is_moderator: user.is_moderator
        });

        socket.handshake.session.userdata = {
          username: user.username,
          is_moderator: user.is_moderator
        };
        socket.handshake.session.save();
      });
    });

    socket.on('logout', function () {
      Reflect.deleteProperty(clients, id);
      Reflect.deleteProperty(socket.handshake.session, 'userdata');
      socket.handshake.session.save();
    });

    var findUser = function (needle) {
      if (typeof clients[needle] !== 'undefined' && typeof clients[needle].ws !== 'undefined') {
        return needle;
      } else {
        for (key in clients) {
          if (clients[key].username === needle) {
            return key;
          }
        }
      }
    }

    socket.on('cooldown', function (session_id) {
      if (!clients[id].is_moderator) return;
      var client_id = findUser(session_id);

      if (client_id && !clients[client_id].is_moderator) {
        ipClients[clients[client_id].ip].cooldown = Date.now() + (1000 * 30);
        clients[client_id].ws.emit('cooldown', 30);
        socket.emit('alert', 'Cooldown for ' + session_id + ' succeeded');
      } else {
        socket.emit('alert', 'Cooldown for ' + session_id + ' failed');
      }
    });

    socket.on('ban', function (session_id) {
      if (!clients[id].is_moderator) return;
      var client_id = findUser(session_id);

      if (client_id && !clients[client_id].is_moderator) {
        Ban.addBan(clients[session_id].ip, function (err) {
          if (err) {
            console.error(err);
            return socket.emit('alert', 'Ban for ' + session_id + ' failed');
          }

          delete clients[client_id];
          clients[client_id] = { banned: true, ready: true };
          socket.emit('alert', 'Ban for ' + session_id + ' succeeded');
        });
      } else {
        socket.emit('alert', 'Ban for ' + session_id + ' failed');
      }
    });

    socket.on('restriction', function (data) {
      if (!clients[id].is_moderator) return;

      if (data.end.x <= data.start.x || data.end.y <= data.start.y) {
        socket.emit('alert', 'Invalid Region Submitted');
        return;
      }

      Restriction.checkIntersects(data.start, data.end, function (intersects) {
        if (intersects) {
          socket.emit('alert', 'Restriction intersects an existing restriction.');
        } else {
          Restriction.addRestriction(clients[id].username, data.start, data.end, function (err) {
            if (err) {
              console.error(err);
              socket.emit('alert', 'Failed to create restriction');
              return;
            }

            socket.emit('alert', 'Restriction created');
          });
        }
      });
    });
  });

  return io;
}

module.exports = WebsocketServer;