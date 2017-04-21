/**
 * Based on https://github.com/dynasticdevelop/place/blob/master/models/pixel.js
 * 
 * Which is licensed under AGPL v3.0 and can be viewed here https://www.gnu.org/licenses/agpl-3.0.en.html
 */
const mongoose = require('mongoose');
const PixelArchive = require('./PixelArchive');
const Schema = mongoose.Schema;

var colorPieceValidator = function (c) {
  return Number.isInteger(c) && c >= 0 && c <= 255;
}

var PixelSchema = new Schema({
  xPos: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  yPos: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  colorR: {
    type: Number,
    required: true,
    validate: {
      validator: colorPieceValidator,
      message: '{VALUE} is not a valid color'
    }
  },
  colorG: {
    type: Number,
    required: true,
    validate: {
      validator: colorPieceValidator,
      message: '{VALUE} is not a valid color'
    }
  },
  colorB: {
    type: Number,
    required: true,
    validate: {
      validator: colorPieceValidator,
      message: '{VALUE} is not a valid color'
    }
  },
  createdAt: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value'
    }
  },
  username: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  anon: {
    type: Boolean,
    required: true
  },
});

PixelSchema.statics.addPixel = function (data, callback) {
  this.findOneAndUpdate({
    xPos: data.x,
    yPos: data.y
  }, {
      colorR: data.color.r,
      colorG: data.color.g,
      colorB: data.color.b,
      createdAt: Date.now(),
      username: data.username,
      ip: data.ip,
      anon: data.anon
    }, {
      upsert: true
    }, function (err, pixel) {
      if (err) return callback(err);
      callback();

      // Archive the previous pixel if there was one before it
      if (pixel) {
        new PixelArchive(pixel.toObject()).save(function (err) {
          if (err) console.error(err);
        });
      }
    });
};

PixelSchema.statics.getAllPixels = function (addPixelToImage) {
  return new Promise((resolve, reject) => {
    this.find().lean().cursor()
      .on('data', (pixel) => {
        addPixelToImage(pixel);
      })
      .on('error', (err) => {
        return reject(err);
      })
      .on('end', function () {
        resolve();
      });
  });
};

module.exports = mongoose.model('Pixel', PixelSchema);