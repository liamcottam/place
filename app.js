const fs = require('fs');
const crypto = require('crypto');
const config = require('./config');
const HTTPServer = require('./utils/HTTPServer');
const WebsocketServer = require('./utils/WebsocketServer');

// TODO: Move to proper database, mongodb perhaps
const Datastore = require('nedb');
const user_db = new Datastore({ filename: 'users.nedb', autoload: true });
const session_db = new Datastore({ filename: 'sessions.nedb', autoload: true });
const banned_db = new Datastore({ filename: 'banned.nedb', autoload: true });
const restricted_db = new Datastore({ filename: 'restrictions.nedb', autoload: true });

const numElements = config.width * config.height;

var app = {};
app.config = config;
app.boardData = new Uint32Array(numElements);
app.needWrite = false;

app.checkRestricted = function (x, y, callback) {
  if (!config.enable_restrictions) return callback(false);

  restricted_db.findOne({
    $and: [
      { 'start.x': { $lte: x } },
      { 'start.y': { $lte: y } },
      { 'end.x': { $gte: x } },
      { 'end.y': { $gte: y } }
    ]
  }, function (err, restriction) {
    callback(restriction !== null);
  });
}

app.checkIntersect = function (startPosition, endPosition, callback) {
  if (config.allow_restriction_intersect) return callback(false);

  restricted_db.findOne({
    $or: [
      {
        $and: [
          { 'start.x': { $lte: startPosition.x } },
          { 'start.y': { $lte: startPosition.y } },
          { 'end.x': { $gte: startPosition.x } },
          { 'end.y': { $gte: startPosition.y } }
        ],
      },
      {
        $and: [
          { 'start.x': { $lte: endPosition.x } },
          { 'start.y': { $lte: endPosition.y } },
          { 'end.x': { $gte: endPosition.x } },
          { 'end.y': { $gte: endPosition.y } }
        ]
      }
    ]
  }, function (err, restriction) {
    callback(restriction !== null);
  });
}

app.formatIP = function (ip) {
  ip = ip.split(',')[0];
  ip = ip.split(':').slice(-1);
  return ip;
};

function generateSalt() {
  return crypto.randomBytes(Math.ceil(config.salt_length / 2))
    .toString('hex')
    .slice(0, config.salt_length);
}

function hash(password, salt) {
  var hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  var value = hash.digest('hex');
  return {
    hash: value,
    salt: salt,
  };
}

function saltHash(password) {
  var salt = generateSalt();
  var passwordData = hash(password, salt);

  return {
    hash: passwordData.hash,
    salt: passwordData.salt,
  };
}

function generateSession(username) {
  var session = {
    username: username,
    session_key: generateSalt(),
    valid_until: Date.now() + (1000 * 60 * 60 * 24 * 7),
  };

  session_db.update({ username: username }, session, { upsert: true });

  return session;
}

app.authenticateUser = function (username, password, callback) {
  if (username.length === 0 || password.length === 0) {
    callback('Username/password required', null);
    return;
  }

  if (!username.match(/^[a-z0-9]+$/i)) {
    callback('Invalid username', null);
    return;
  }

  // Check if user exists
  user_db.findOne({ username: username }, function (err, user) {
    if (err) throw err;
    if (user) {

      if (hash(password, user.salt).hash === user.hash) {
        var session = generateSession(username);
        return callback(null, {
          success: true,
          session_key: session.session_key,
          is_moderator: user.is_moderator,
        });
      }

      return callback('Username or password incorrect', null);
    } else {
      if (password.length < 6) return callback('Password must be at least 6 characters', null);

      var data = saltHash(password);
      var session = generateSession(username);

      user_db.insert({
        username: username,
        is_moderator: false,
        hash: data.hash,
        salt: data.salt,
      });

      return callback(null, {
        success: true,
        message: 'Created new account with password provided',
        session_key: session.session_key,
      });
    }
  });
}

app.authenticateSession = function (username, session_key, callback) {
  user_db.findOne({ username: username }, function (err, user) {
    if (err) throw err;
    if (!user) return;

    session_db.findOne({ username: username, session_key: session_key }, function (err, session) {
      if (err) throw err;

      if (session && session.valid_until > Date.now()) {
        session.valid_until = Date.now() + (1000 * 60 * 60 * 24 * 7);
        session_db.update({ _id: session._id }, { $set: { valid_until: session.valid_until } }, {});

        callback(null, {
          type: 'reauth',
          success: true,
          is_moderator: user.is_moderator,
        });
      } else {
        callback('Invalid session', null);
      }
    });
  });
};

app.deleteSession = function (session_key) {
  session_db.remove({ session_key: session_key });
};

app.banIP = function (ip) {
  banned_db.insert({ ip: ip });
};

app.createRestriction = function (data) {
  restricted_db.insert(data);
}

app.getRestrictedDb = function () {
  return restricted_db;
};

app.checkBanned = function (ip, callback) {
  banned_db.findOne({ ip: ip }, function (err, ip) {
    if (err) throw err;
    if (ip === null) return callback(false);
    return callback(true);
  });
};

function onReady() {
  app.server = new HTTPServer(app);
  app.websocket = new WebsocketServer(app);
  app.server.http.listen(config.port, function () {
    console.log('Listening on port %d', app.server.http.address().port);
  });
}

function synchroniseFile() {
  if (!app.needWrite) return setTimeout(synchroniseFile, 100);
  app.needWrite = false;

  fs.writeFile(config.boardFilenameTemp, new Buffer(app.boardData), function (err) {
    if (err) throw err;

    fs.rename(config.boardFilenameTemp, config.boardFilename, function (err) {
      if (err) throw err;
      setTimeout(synchroniseFile, 100);
    });
  });
}

if (!fs.existsSync('.htpasswd')) {
  fs.writeFile('.htpasswd', 'user:user', function (err) {
    if (err) throw err;
    console.log('Created default user with username and password user');
  })
}

if (fs.existsSync(config.boardFilename)) {
  fs.readFile(config.boardFilename, 'binary', function (err, data) {
    if (err) throw err;
    for (var i = 0; i < numElements; i++) {
      app.boardData[i] = data.charCodeAt(i);
    }

    synchroniseFile();
    onReady();
  });
} else {
  console.log('Creating new board file');
  for (var i = 0; i < numElements; i++) {
    app.boardData[i] = config.clearColor;
  }

  fs.writeFile(config.boardFilename, new Buffer(app.boardData), function (err) {
    if (err) throw err;

    onReady();
    synchroniseFile();
  });
}
