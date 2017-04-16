const fs = require('fs');
const Jimp = require('jimp');
const config = require('./config');

var width = 1250;
var height = 1250;
var data = fs.readFileSync('board.dat', 'binary');

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

var position = 0;
var date = Date.now();

try {
  fs.unlinkSync('board.json');
} catch (err) {
  // File doesn't exist
}

var writeStream = fs.createWriteStream('board.json');
writeStream.write('[');

for (var y = 0; y < height; y++) {
  for (var x = 0; x < width; x++) {
    var position = (y * height) + x;
    var paletteColor = data.charCodeAt(position);
    if (paletteColor == 0)
      continue;

    var rgb = hexToRgb(config.palette[paletteColor]);

    let object = {
      xPos: x,
      yPos: y,
      colorR: rgb.r,
      colorG: rgb.g,
      colorB: rgb.b,
      username: 'admin',
      createdAt: date,
      ip: '127.0.0.1'
    }

    writeStream.write(JSON.stringify(object) + ',\n');
  }
}

writeStream.write(']');
writeStream.end();

console.log("Finished: please import the database with 'mongoimport --db place --collection pixels --drop --file board.json'")