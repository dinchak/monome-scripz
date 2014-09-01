var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;

function PatternRecorder(opts) {
  opts = opts || {};
  this.queue = {};
  this.position = -1;
  this.length = opts.length || 96;
  this.playing = 1;
  this.recording = 0;
  this.muted = 0;
  this.hasNotes = false;
  this.pressedKeys = [];
  this.emitter = new EventEmitter();
  this.on = this.emitter.on;
  this.emit = this.emitter.emit;
}

PatternRecorder.prototype.tick = function () {
  this.position++;
  if (this.position == this.length) {
    this.position = 0;
  }
  if (!this.playing) {
    return;
  }
  var self = this;
  _.each(this.queue[this.position], function (ev) {
    if (ev.type == 'key' && ev.event.s == 1) {
      self.pressedKeys.push(ev);
    } else if (ev.type == 'key' && ev.event.s === 0) {
      var press = _.find(self.pressedKeys, function (recEv) {
        return recEv.event.x == ev.x && recEv.event.y == ev.y;
      });
      self.pressedKeys = _.without(self.pressedKeys, press);
    }
    if (!self.muted) {
      self.emit('recordedEvent', ev.type, ev.event);
    }
  });
};

PatternRecorder.prototype.reset = function () {
  this.position = -1;
};

PatternRecorder.prototype.recordEvent = function (type, ev) {
  if (!this.recording) {
    return;
  }
  if (!this.queue[this.position]) {
    this.queue[this.position] = [];
  }
  if (!_.findWhere(this.queue[this.position], ev)) {
    this.hasNotes = true;
    this.queue[this.position].push({
      type: type,
      event: ev
    });
  }
};

PatternRecorder.prototype.releasePressedKeys = function () {
  var self = this;
  _.each(this.pressedKeys, function (ev) {
    var releaseEvent = _.clone(ev.event);
    releaseEvent.s = 0;
    self.emit('recordedEvent', ev.type, releaseEvent);
  });
};

PatternRecorder.prototype.clear = function () {
  this.releasePressedKeys();
  _.each(this.queue, function (events, i) {
    this.queue[i] = [];
  }, this);
  this.hasNotes = false;
};

module.exports = PatternRecorder;
