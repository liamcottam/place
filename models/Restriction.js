const mongoose = require('mongoose');
const config = require('../config');
const User = require('./User');
const Schema = mongoose.Schema;

var RestrictionSchema = new Schema({
  startX: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  startY: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  endX: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  endY: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  owners: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
});

RestrictionSchema.statics.addRestriction = function (username, start, end, callback) {
  var self = this;

  User.findOne({ username: username }).then((user) => {
    let restriction = self({
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      owners: [user]
    });

    restriction.save().then(() => {
      callback();
    }).catch((err) => {
      callback(err);
    });

  }).catch((err) => {
    callback(`Unable to find user ${username}`);
  });
};

RestrictionSchema.statics.checkRestricted = function (x, y, callback) {
  this.findOne({
    startX: { $lte: x },
    startY: { $lte: y },
    endX: { $gte: x },
    endY: { $gte: y },
  }, function (err, restriction) {
    if (err) return callback(err);
    callback(null, restriction !== null);
  });
};

RestrictionSchema.statics.checkIntersects = function (start, end, callback) {
  if (config.allow_restriction_intersect) return callback(false);

  this.findOne({
    $or: [
      {
        $and: [
          { startX: { $lte: start.x } },
          { startY: { $lte: start.y } },
          { endX: { $gte: start.x } },
          { endY: { $gte: start.y } }
        ],
      },
      {
        $and: [
          { startX: { $lte: end.x } },
          { startY: { $lte: end.y } },
          { endX: { $gte: end.x } },
          { endY: { $gte: end.y } }
        ]
      }
    ]
  }, function (err, restriction) {
    if (err) return callback(err);
    callback(restriction !== null);
  });
};

module.exports = mongoose.model('Restriction', RestrictionSchema);