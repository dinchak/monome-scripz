var _ = require('underscore');
var midi = require('../lib/midi');
var liveosc = require('../lib/liveosc');

var Script = module.exports = function () {};

Script.prototype.init = function () {
  this.output = new midi.Output(this.config.midiout, true);
  this.input = new midi.Input(this.config.midiin, true);
  liveosc.song().on('ready', function () {
    liveosc.song().on('beat', this.onBeat.bind(this));
  }.bind(this));
  this.set(this.device.sizeX - 1, 0, 0);
  this.set(this.device.sizeX - 1, 1, 0);
  this.set(this.device.sizeX - 1, 2, 1);
};

Script.prototype.key = function (press) {
  console.log('press on mixer');
  console.log(press);

  if (press.s != 1) {
    return;
  }

  if (press.x == this.device.sizeX - 1 && press.y < 3) {
    this.pager.change(press.y);
  }
};

Script.prototype.onBeat = function () {
  console.log('beat');
};