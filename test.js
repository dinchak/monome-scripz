var SerialOSC = require('node-serialosc');
var serialosc = new SerialOSC();
var triggers = require('./scripts/triggers');
serialosc.on('device:add', function (device) {
  triggers.init(device);
});
serialosc.start();
