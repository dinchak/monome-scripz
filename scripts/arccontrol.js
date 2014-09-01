var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var events = require('../lib/events');

var Script = function (device, config, ledState) {

  this.position = [];

  for (var i = 0; i < device.encoders; i++) {
    this.position[i] = 0;
  }

  device.on('delta', _.bind(function (e) {
    this.position[e.n] += e.d;
    if (this.position[e.n] < 0) {
      this.position[e.n] = 0;
    }
    if (this.position[e.n] > 63) {
      this.position[e.n] = 63;
    }
    device.range(e.n, 0, this.position[e.n], 3);
  }, this));
};

module.exports = Script;
