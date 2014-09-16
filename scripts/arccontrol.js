var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var events = require('../lib/events');

var Script = function (device, config, ledState) {
  this.device = device;
  this.config = config;
  this.ledState = ledState;
  this.instrument = 0;
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);

  this.position = [];

  for (var i = 0; i < 8; i++) {
    this.position[i] = [];
    for (var n = 0; n < device.encoders; n++) {
      this.position[i][n] = 0;
    }
  }

  device.on('delta', _.bind(function (e) {
    this.position[this.instrument][e.n] += e.d;
    if (this.position[this.instrument][e.n] < 0) {
      this.position[this.instrument][e.n] = 0;
    }
    if (this.position[this.instrument][e.n] > 63) {
      this.position[this.instrument][e.n] = 63;
    }
    var levels = [];
    for (var i = 0; i < 64; i++) {
      levels.push(this.position[this.instrument][e.n] >= i ? 15 : 0);
    }
    device.map(e.n, levels);
    this.ccOut(this.instrument, e.n, this.position[this.instrument][e.n]);
  }, this));

  this.input.on('cc', _.bind(this.ccIn, this));

  events.on('midilooper:setInstrument', _.bind(this.setInstrument, this));
};

Script.prototype.ccOut = function (instrument, n, pos) {
  var ccValue = pos * 2;
  this.output.send({
    type: 'cc',
    channel: instrument,
    controller: n,
    value: ccValue
  });
};

Script.prototype.ccIn = function (msg) {
  var pos = parseInt(msg.value / 2, 10);
  if (!this.position[msg.channel]) {
    return;
  }
  if (msg.controller > this.device.encoders) {
    return;
  }
  this.position[msg.channel][msg.controller] = pos;
  var levels = [];
  for (var i = 0; i < 64; i++) {
    levels.push(pos >= i ? 15 : 0);
  }
  if (this.instrument == msg.channel) {
    this.device.map(msg.controller, levels);
  }
};

Script.prototype.setInstrument = function (instrument) {
  this.instrument = instrument;
  for (var n = 0; n < this.device.encoders; n++) {
    var levels = [];
    var pos = this.position[instrument][n];
    for (var i = 0; i < 64; i++) {
      levels.push(pos >= i ? 15 : 0);
    }
    this.device.map(n, levels);
  }
};

module.exports = Script;
