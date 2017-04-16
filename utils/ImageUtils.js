const Jimp = require('jimp');
const Pixel = require('../models/pixel');

function ImageUtils(app) {
  new Jimp(app.config.width, app.config.height, app.config.clearColor, function (err, image) {
    if (err) throw err;

    Pixel.getAllPixels(pixel => {
      var rgb = Jimp.rgbaToInt(pixel.colorR, pixel.colorG, pixel.colorB, 255);
      image.setPixelColor(rgb, pixel.xPos, pixel.yPos);
    }).then(function () {
      console.log('Image loaded');
      app.image = image;
    }).catch(err => {
      throw err;
      process.exit(1);
    });
  });
}

module.exports = ImageUtils;