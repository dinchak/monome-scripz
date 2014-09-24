var _ = require('underscore');
var midi = require('../lib/midi');
var events = require('../lib/events');

var Script = function (device, config, ledState) {
  this.device = device;
  this.config = config;
  this.ledState = ledState;
  this.instrument = 0;
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.buffers = [];
  this.bufferRecording = [];
  this.bufferPosition = -1;
  this.bufferLength = 192;
  this.position = [];

  for (var i = 0; i < 8; i++) {
    this.position[i] = [];
    this.buffers[i] = [];
    this.bufferRecording[i] = [];
    for (var n = 0; n < device.encoders; n++) {
      this.position[i][n] = 0;
      this.buffers[i][n] = [];
      this.bufferRecording[i][n] = false;
      for (var p = 0; p < this.bufferLength; p++) {
        this.buffers[i][n][p] = 0;
      }
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

  this.input.on('clock', _.bind(function () {
    this.bufferPosition++;
    if (this.bufferPosition == this.bufferLength) {
      this.bufferPosition = 0;
    }
    var lastPosition = this.bufferPosition - 1;
    for (var i = 0; i < 8; i++) {
      for (var n = 0; n < device.encoders; n++) {
        if (this.bufferRecording[i][n]) {
          this.buffers[i][n][this.bufferPosition] = this.position[i][n];
        } else {
          var posNow = this.buffers[i][n][this.bufferPosition];
          if (i == this.instrument && posNow) {
            var levels = [];
            if (lastPosition != posNow) {
              for (var l = 0; l < 64; l++) {
                levels.push(posNow >= l ? 15 : 0);
              }
              this.device.map(n, levels);
            }
          }
          if (posNow && lastPosition != posNow) {
            this.ccOut(i, n, posNow);
          }
        }
      }
    }
  }, this));

  device.on('key', _.bind(function (e) {
    if (e.s == 1) {
      if (this.bufferRecording[this.instrument][e.n]) {
        this.bufferRecording[this.instrument][e.n] = false;
      } else {
        for (var p = 0; p < this.bufferLength; p++) {
          this.buffers[this.instrument][e.n][p] = 0;
        }
        this.bufferRecording[this.instrument][e.n] = true;
      }
    }
  }, this))

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
