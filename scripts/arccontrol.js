var _ = require('underscore');
var midi = require('../lib/midi');
var events = require('../lib/events');
var liveosc = require('../lib/liveosc');

var Script = function (device, config, ledState) {
  this.device = device;
  console.log(device.model);
  this.config = config;
  this.ledState = ledState;
  this.instrument = 0;
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.buffers = [];
  this.bufferRecording = [];
  this.bufferRecordStart = [];
  this.bufferPosition = -1;
  this.bufferLength = 192;
  this.position = [];

  for (var i = 0; i < 8; i++) {
    this.position[i] = [];
    this.buffers[i] = [];
    this.bufferRecording[i] = [];
    this.bufferRecordStart[i] = [];
    for (var n = 0; n < device.encoders; n++) {
      this.position[i][n] = 0;
      this.buffers[i][n] = [];
      this.bufferRecording[i][n] = false;
      this.bufferRecordStart[i][n] = 0;
      for (var p = 0; p < this.bufferLength; p++) {
        this.buffers[i][n][p] = -1;
      }
    }
  }

  for (var n = 0; n < this.device.encoders; n++) {
    var levels = [15];
    for (var i = 1; i < 64; i++) {
      levels.push(0);
    }
    this.device.map(n, levels);
  }

  liveosc.song().on('ready', _.bind(function () {
    liveosc.device(1, 'master').on('param', _.bind(function (params) {
      if (params.value == 2) {
        for (var inst = 0; inst < 8; inst++) {
          this.resetEffects(inst);
          for (var n = 0; n < this.device.encoders; n++) {
            var levels = [15];
            for (var i = 1; i < 64; i++) {
              levels.push(0);
            }
            this.device.map(n, levels);
          }
        }
      }
    }, this));
  }, this));

  device.on('delta', _.bind(function (e) {
    if (!this.bufferRecording[this.instrument][e.n]) {
      for (var p = 0; p < this.bufferLength; p++) {
        this.buffers[this.instrument][e.n][p] = -1;
      }
    }
    this.position[this.instrument][e.n] += e.d;
    if (this.position[this.instrument][e.n] < 0) {
      this.position[this.instrument][e.n] = 0;
    }
    if (this.position[this.instrument][e.n] > 63) {
      this.position[this.instrument][e.n] = 63;
    }
    var levels = [15];
    for (var i = 1; i < 64; i++) {
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
          if (this.bufferRecordStart[i][n] == this.bufferPosition) {
            this.bufferRecording[i][n] = false;
          }
        } else {
          var posNow = this.buffers[i][n][this.bufferPosition];
          if (i == this.instrument && posNow > -1) {
            var levels = [15];
            if (lastPosition != posNow) {
              for (var l = 1; l < 64; l++) {
                levels.push(posNow >= l ? 15 : 0);
              }
              this.device.map(n, levels);
            }
          }
          if (posNow > -1 && lastPosition != posNow) {
            this.ccOut(i, n, posNow);
          }
        }
      }
    }
  }, this));

  device.on('key', _.bind(function (e) {
    if (e.s == 1) {
      for (var p = 0; p < this.bufferLength; p++) {
        this.buffers[this.instrument][e.n][p] = -1;
      }
      this.bufferRecordStart[this.instrument][e.n] = this.bufferPosition;
      this.bufferRecording[this.instrument][e.n] = true;
    }
  }, this))

  this.input.on('cc', _.bind(this.ccIn, this));

  events.on('midilooper:setInstrument', _.bind(this.setInstrument, this));

  events.on('midilooper:resetEffects', _.bind(this.resetEffects, this));
};

Script.prototype.ccOut = function (instrument, n, pos) {
  var ccValue = pos * 2;
  var ctrl = instrument * 4 + n;
  this.output.send({
    type: 'cc',
    channel: 0,
    controller: ctrl + 4,
    value: ccValue
  });
};

Script.prototype.ccIn = function (msg) {
  var pos = parseInt(msg.value / 2, 10);
  if (!this.position[msg.channel]) {
    return;
  }
  var ctrl = msg.controller - 4;
  var instrument = Math.floor(ctrl / 8);
  var encoder = ctrl % 4;
  if (instrument >= 8) {
    return;
  }
  this.position[instrument][encoder] = pos;
  var levels = [15];
  for (var i = 1; i < 64; i++) {
    levels.push(pos >= i ? 15 : 0);
  }
  if (this.instrument == instrument) {
    this.device.map(msg.controller, levels);
  }
};

Script.prototype.setInstrument = function (instrument) {
  this.instrument = instrument;
  for (var n = 0; n < this.device.encoders; n++) {
    var levels = [15];
    var pos = this.position[instrument][n];
    for (var i = 1; i < 64; i++) {
      levels.push(pos >= i ? 15 : 0);
    }
    this.device.map(n, levels);
  }
};

Script.prototype.resetEffects = function (i) {
  for (var n = 0; n < this.device.encoders; n++) {
    this.position[i][n] = 0;
    this.buffers[i][n] = [];
    this.bufferRecording[i][n] = false;
    this.bufferRecordStart[i][n] = 0;
    for (var p = 0; p < this.bufferLength; p++) {
      this.buffers[i][n][p] = -1;
    }
    this.ccOut(i, n, 0);
  }
};

module.exports = Script;
