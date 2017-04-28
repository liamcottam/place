const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var BanSchema = new Schema({
  ip: {
    type: String,
    required: true,
    unique: true
  }
});

BanSchema.statics.addBan = function (ip, callback) {
  let ban = this({ ip: ip });
  ban.save().then(() => {
    callback();
  }).catch((err) => {
    callback(err);
  });
};

BanSchema.statics.checkBanned = function (ip, callback) {
  this.findOne({ ip: ip }).then((ban) => {
    callback(ban !== null);
  }).catch((err) => {
    console.error(err);
    callback(false);
  });
}

module.exports = mongoose.model('Ban', BanSchema);