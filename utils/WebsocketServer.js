const socketio = require('socket.io');

function WebsocketServer(app) {
  const io = socketio(app.server.http);

  var ipClients = [];
  var clients = [];
  var connected_clients = 0;
  var config = app.config;

  var defaultIpSession = {
    cooldown: (config.connect_cooldown) ? Date.now() + (config.cooldown * 1000) : 0,
    cooldown_chat: (config.connect_cooldown) ? Date.now() + (config.cooldown_chat * 1000) : 0
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
        if (seen.indexOf(clients[key].username) === 0) {
          userBroadcast.connected--;
          continue;
        }
        if (clients[key].is_moderator) userBroadcast.moderators.push(clients[key].username);
        else userBroadcast.registered.push(clients[key].username);
        seen.push(clients[key].username);
      } else {
        if (seen.indexOf(key) === 0) {
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

    var id = Math.random().toString(36).substr(2, 5);
    clients[id] = { ready: false };

    app.checkBanned(ip, function (isBanned) {
      if (isBanned) {
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

        if (userBroadcast === null) userBroadcast = userBroadcastFn();
        socket.emit('session', { session_id: id, users: userBroadcast });

        var diff = ipClients[ip].cooldown - Date.now();
        if (diff >= 0) {
          socket.emit('cooldown', diff / 1000);
        }
      }
    });

    socket.on('disconnect', function () {
      delete clients[id];
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

      next();
    });

    socket.on('place', function (data) {
      var x = data.x;
      var y = data.y;
      var color = data.color;
      console.log('PLACE: %s (%s) - %s, %s, %s', ip, id, x, y, color);

      if (x < 0 || x >= config.width || y < 0 || y >= config.height || color < 0 || color > config.palette.length) {
        console.log('PLACE: OUT OF BOUNDS');
        return;
      }

      var now = Date.now();
      if (typeof ipClients[ip].cooldown === 'undefined' || ipClients[ip].cooldown - now >= 0 && !clients[id].is_moderator) {
        console.log('PLACE: Attempted Place Before Cooldown');
        return;
      }

      if (clients[id].is_moderator) {
        var position = (y * config.height) + x;
        if (app.boardData[position] === color) return;

        data.session_id = (clients[id].username) ? clients[id].username : clients[id].id;
        app.boardData[position] = color;
        app.needWrite = true;
        io.emit('place', data);
      } else {
        if (app.checkRestricted(x, y, function (restricted) {
          if (restricted) {
            console.log('PLACE: Restricted Area');
            socket.emit('alert', 'Area is restricted.');
            return;
          } else {
            var position = (y * config.height) + x;
            if (app.boardData[position] === color) return;

            ipClients[ip].cooldown = now + (1000 * config.cooldown);
            var diff = config.cooldown;

            data.session_id = (clients[id].username !== null) ? clients[id].username : clients[id].id;
            app.boardData[position] = color;
            app.needWrite = true;
            io.emit('place', data);
            socket.emit('cooldown', diff);
          }
        }));
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
      app.authenticateUser(data.username, data.password, function (err, response) {
        if (!err) {
          console.log('AUTH-SUCCESS: %s (%s) - %s', ip, id, data.username);
          clients[id].username = data.username;
          clients[id].is_moderator = response.is_moderator;
          if (response.is_moderator)
            socket.emit('cooldown', 0);
          socket.emit('auth', response);
        } else {
          console.log('AUTH-FAIL: %s (%s) - %s - ', ip, id, data.username, err);
          socket.emit('auth', {
            success: false,
            message: err
          });
        }
      });
    });

    socket.on('reauth', function (data) {
      app.authenticateSession(data.username, data.session_key, function (err, response) {
        if (!err) {
          console.log('REAUTH: %s (%s) - %s', ip, id, data.username);
          clients[id].username = data.username;
          clients[id].is_moderator = response.is_moderator;
          if (response.is_moderator)
            socket.emit('cooldown', 0);
          socket.emit('reauth', response);
        } else {
          console.log('REAUTH-FAIL: %s (%s) - %s', ip, id, data.username);
          socket.emit('reauth', {
            success: false,
            message: err
          });
        }
      });
    });

    socket.on('logout', function (data) {
      var new_id = Math.random().toString(36).substr(2, 5);
      var old_client = clients[id];
      delete clients[id];
      id = new_id;
      clients[id] = old_client;
      clients[id].id = id;
      clients[id].username = null;
      clients[id].is_moderator = false;
      app.deleteSession(data.session_key);
    });

    var findUser = function (needle) {
      if (typeof clients[needle] !== 'undefined' && typeof clients[needle].ws !== 'undefined') {
        return needle;
        session_id = needle;
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
        clients[client_id].ws.emit('alert', 'You have been banned.');
        app.banIP(clients[session_id].ip);
        delete clients[client_id];
        socket.emit('alert', 'Ban for ' + session_id + ' succeeded');
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

      app.checkIntersect(data.start, data.end, function (intersects) {
        if (!intersects) {
          app.createRestriction(data);
          socket.emit('alert', 'Restriction created');
        } else {
          socket.emit('alert', 'Restriction intersects already created restriction.');
        }
      });
    });
  });

  return io;
}

module.exports = WebsocketServer;