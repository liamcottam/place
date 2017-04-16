/**
 * Based on https://github.com/dynasticdevelop/place/blob/master/models/pixel.js
 * 
 * Which is licensed under AGPL v3.0 and can be viewed here https://www.gnu.org/licenses/agpl-3.0.en.html
 */
const mongoose = require('mongoose');
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
});

PixelSchema.statics.addPixel = function (color, x, y, username, ip) {
  this.findOneAndUpdate({
    xPos: x,
    yPos: y
  }, {
      colorR: color.r,
      colorG: color.g,
      colorB: color.b,
      createdAt: Date.now(),
      username: username,
      ip: ip
    }, {
      upsert: true
    }).exec();
};

PixelSchema.statics.getAllPixels = function (addPixelToImage) {
  return new Promise((resolve, reject) => {
    this.find().cursor()
      .on('data', function (pixel) {
        addPixelToImage(pixel);
      })
      .on('error', function (err) {
        return reject(err);
      })
      .on('end', function () {
        resolve();
      });
  });
};

module.exports = mongoose.model('Pixel', PixelSchema);