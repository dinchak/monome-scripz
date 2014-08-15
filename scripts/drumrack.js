var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');

var Script = function (device, config) {
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.device = device;
  this.config = config;
  this.patternRecorders = [];
  this.buffer = [];
  this.bufferPosition = -1;
  var self = this;

  _.each(_.range(8), function (i) {
    self.patternRecorders[i] = new PatternRecorder();
    self.patternRecorders[i].on('recordedEvent', function (type, ev) {
      self.device.emit(type, ev, {skipRecord: true});
    });
  });
  self.patternRecorders[0].length = 192;
  self.patternRecorders[1].length = 192;
  self.patternRecorders[2].length = 384;
  self.patternRecorders[3].length = 384;
  self.patternRecorders[4].length = 192;
  self.patternRecorders[5].length = 192;
  self.patternRecorders[6].length = 192;
  self.patternRecorders[7].length = 192;

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
    self.bufferPosition++;
    if (self.bufferPosition == 192) {
      self.bufferPosition = 0;
    }
    self.buffer[self.bufferPosition] = [];
    _.each(self.patternRecorders, function (patrec) {
      patrec.tick();
    });
  });

  this.input.on('position', function (ev) {
    if (ev.lsb === 0 && ev.msb === 0) {
      _.each(self.patternRecorders, function (patrec) {
        patrec.reset();
      });
    }
  });
};

Script.prototype.handlePress = function (press, opts) {
  opts = opts || {};
  var patternRecording = false;
  _.each(this.patternRecorders, function (patrec) {
    if (patrec.recording) {
      patternRecording = true;
    }
  });
  if (press.y === 0) {
    if (press.x < 4) {
      if (press.s == 1) {
        if (this.patternRecorders[press.x].recording) {
          this.patternRecorders[press.x].recording = 0;
        } else {
          this.patternRecorders[press.x].recording = 1;
          this.patternRecorders[press.x].muted = 0;
          this.device.set(press.x, 2, 1);
        }
        this.device.set(press.x, press.y, this.patternRecorders[press.x].recording);
      }
    } else {
      if (this.patternRecorders.hasNotes) {
        return;
      }
      this.device.set(press.x, 1, 1);
      this.device.set(press.x, 2, 1);
      this.patternRecorders[press.x].queue = _.clone(this.buffer);
      this.patternRecorders[press.x].hasNotes = true;
      this.patternRecorders[press.x].position = this.bufferPosition;
    }
  }
  if (press.y == 1) {
    if (press.s == 1) {
      this.patternRecorders[press.x].clear();
      this.patternRecorders[press.x].recording = 0;
      this.device.set(press.x, 0, 0);
      this.device.set(press.x, 1, 0);
      this.device.set(press.x, 2, 0);
    }
  }
  if (press.y == 2) {
    if (press.s == 1) {
      if (this.patternRecorders[press.x].muted) {
        this.patternRecorders[press.x].muted = 0;
        this.device.set(press.x, 2, 1);
      } else {
        this.patternRecorders[press.x].muted = 1;
        this.device.set(press.x, 2, 0);
      }
    }
  }
  if (press.y >= 3) {
    this.playNote(press);
    _.each(this.patternRecorders, function (patrec, i) {
      if (patrec.recording) {
        if (patrec.hasNotes) {
          this.device.set(i, 1, 1);
        }
        if (!opts.skipRecord) {
          patrec.recordEvent('key', press);
        }
      }
    }, this);
    if (!patternRecording) {
      this.addToBuffer(press);
    }
  }
};

Script.prototype.addToBuffer = function (press) {
  if (this.bufferPosition == -1) {
    return;
  }
  if (!this.buffer[this.bufferPosition]) {
    this.buffer[this.bufferPosition] = [];
  }
  if (!_.findWhere(this.buffer[this.bufferPosition], {type: 'key', event: press})) {
    this.buffer[this.bufferPosition].push({
      type: 'key',
      event: press
    });
  }
};

Script.prototype.noteToLed = function(note) {
  console.log(note);
  var y = Math.floor((note.note - 36) / this.device.sizeX);
  y += this.device.sizeY - 4;
  var x = (note.note - 36) % this.device.sizeX;
  return {x:x, y:y};
};

Script.prototype.playNote = function(press) {
  var note = ((press.y - this.device.sizeY + 4) * this.device.sizeX) + press.x + 36;
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
    channel: press.y == 3 ? 1 : 0,
    note: note,
    velocity: velocity
  });
};

module.exports = Script;
