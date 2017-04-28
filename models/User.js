const mongoose = require('mongoose');
const crypto = require('crypto');
const config = require('../config');
const Schema = mongoose.Schema;

function generateSalt() {
  return crypto.randomBytes(Math.ceil(config.salt_length / 2))
    .toString('hex')
    .slice(0, config.salt_length);
};

function hash(password, salt) {
  var hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  var value = hash.digest('hex');
  return {
    hash: value,
    salt: salt,
  };
};

function saltHash(password) {
  var salt = generateSalt();
  var passwordData = hash(password, salt);

  return {
    hash: passwordData.hash,
    salt: passwordData.salt,
  };
};

var UserTypes = {
  admin: 'admin',
  moderator: 'moderator'
};

var UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password_hash: {
    type: String,
    required: true
  },
  password_salt: {
    type: String,
    required: true
  },
  is_moderator: {
    type: Boolean,
    required: true
  }
});

UserSchema.statics.authenticate = function (opts, callback) {
  if (opts.username.length === 0 || opts.password.length === 0) {
    return callback('Username/password required');
  }

  var self = this;
  this.findOne({ username: opts.username }, function (err, user) {
    if (err) return callback(err);

    if (user) {
      if (hash(opts.password, user.password_salt).hash === user.password_hash) {
        return callback(null, user);
      }

      return callback('Username or password is incorrect');
    } else {
      if (opts.password.length < 6) return callback('Password must be at least 6 characters');

      let password = saltHash(opts.password);
      let newUser = self({
        username: opts.username,
        password_hash: password.hash,
        password_salt: password.salt,
        is_moderator: false
      });

      newUser.save(function (err, user) {
        if (err) return callback(err);
        callback(null, user);
      });
    }
  });
};

module.exports = mongoose.model('User', UserSchema);