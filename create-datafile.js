var config = require('./config');
var fs = require('fs');

var numElements = config.width * config.height;
var array = new Uint32Array(numElements);
for (var i = 0; i < numElements; i++) {
  array[i] = 0;
}

fs.writeFile(config.boardFilename, new Buffer(array), function (err) {
  if (err) {
    console.error('Failed to create data file');
    throw err;
  }

  console.log('Success!');
});