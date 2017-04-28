const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var PixelSchema = new Schema({
  xPos: {
    type: Number,
    required: true
  },
  yPos: {
    type: Number,
    required: true
  },
  colorR: {
    type: Number,
    required: true
  },
  colorG: {
    type: Number,
    required: true
  },
  colorB: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Number,
    required: true
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
    required: false
  }
});

module.exports = mongoose.model('ArchivedPixel', PixelSchema);