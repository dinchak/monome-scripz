var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');

var Script = function (device, config) {
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.device = device;
  this.config = config;
  this.patternRecorders = [];
  var self = this;

  _.each(_.range(4), function (i) {
    self.patternRecorders[i] = new PatternRecorder();
    self.patternRecorders[i].on('recordedEvent', function (type, ev) {
      self.device.emit(type, ev, {skipRecord: true});
    });
  });
  self.patternRecorders[0].length = 192;
  self.patternRecorders[1].length = 192;
  self.patternRecorders[2].length = 96;
  self.patternRecorders[3].length = 384;

  this.device.on('key', function (press, opts) {
    self.handlePress(press, opts);
  });

  this.input.on('noteon', function (data) {
    var press = self.noteToLed(data);
    self.device.set(press.x, press.y, 1);
  });

  this.input.on('noteoff', function (data) {
    var press = self.noteToLed(data);
    self.device.set(press.x, press.y, 0);
  });

  this.input.on('clock', function () {
    _.each(self.patternRecorders, function (patrec) {
      patrec.tick();
    });
  });

  this.input.on('position', function (ev) {
    if (ev.lsb == 0 && ev.msb == 0) {
      _.each(self.patternRecorders, function (patrec) {
        patrec.reset();
      });
    }
  });
};

Script.prototype.handlePress = function (press, opts) {
  opts = opts || {};
  if (press.y == 4) {
    if (press.x < 4) {
      if (press.s == 1) {
        this.patternRecorders[press.x].clear();
        this.device.set(press.x, press.y, 0);
      }
    }
  }
  if (press.y == 5) {
    if (press.x < 4) {
      if (press.s == 1) {
        if (this.patternRecorders[press.x].recording) {
          this.patternRecorders[press.x].recording = 0;
        } else {
          this.patternRecorders[press.x].recording = 1;
        }
        this.device.set(press.x, press.y, this.patternRecorders[press.x].recording);
      }
    }
  }
  if (press.y >= 6) {
    this.playNote(press);
    _.each(this.patternRecorders, function (patrec, i) {
      if (patrec.recording) {
        if (!patrec.hasNotes) {
          this.device.set(i, 4, 1);
        }
        if (!opts.skipRecord) {
          patrec.recordEvent('key', press);
        }
      }
    }, this);
  }
};

Script.prototype.noteToLed = function(note) {
  var y = Math.floor((note.note - 36) / this.device.sizeX);
  y += this.device.sizeY - 2;
  var x = (note.note - 36) % this.device.sizeX;
  return {x:x, y:y};
};

Script.prototype.playNote = function(press) {
  var note = ((press.y - this.device.sizeY + 2) * this.device.sizeX) + press.x + 36;
  var type;
  var velocity;
  if (press.s == 1) {
    type = 'noteon';
    velocity = 127;
  } else {
    type = 'noteoff';
    velocity = 0;
  }
  this.output.send({
    type: type,
    channel: 0,
    note: note,
    velocity: velocity
  });
};

module.exports = Script;
