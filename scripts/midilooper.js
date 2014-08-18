var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');

var Script = function (device, config, ledState) {
  this.device = device;
  this.config = config;
  this.ledState = ledState;
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.keyboard = new midi.Input(config.keyboard);
  this.patternRecorders = [];
  this.patternModes = [];
  this.shortBuffer = [];
  this.longBuffer = [];
  this.shortBufferPosition = -1;
  this.longBufferPosition = -1;
  this.instrument = 0;
  this.pattern = 0;
  device.set(this.instrument, 0, 1);
  var self = this;
  _.each(_.range(8), function (i) {
    self.patternRecorders[i] = [];
    self.device.set(i, 2, 1);
    self.patternModes[i] = 1;
    self.device.set(i, 3, 1);
    _.each(_.range(4), function (j) {
      self.patternRecorders[i][j] = new PatternRecorder();
      if (j < 2) {
        self.patternRecorders[i][j].length = 192;
      } else {
        self.patternRecorders[i][j].length = 384;
      }
      self.patternRecorders[i][j].on('recordedEvent', function (type, ev) {
        self.output.send({
          type: ev.s ? 'noteon' : 'noteoff',
          channel: Math.floor(i / 2),
          note: ev.note,
          velocity: ev.velocity
        });
      });
    });
  });

  this.device.on('key', _.bind(this.onKey, this));
  this.input.on('clock', _.bind(this.onClock, this));
  this.keyboard.on('noteon', function (note) {
    self.onNote(note, 'noteon');
  });
  this.keyboard.on('noteoff', function (note) {
    self.onNote(note, 'noteoff');
  });
};

Script.prototype.onNote = function (note, type, opts) {
  opts = opts || {};
  var event = _.extend(note, {s: type == 'noteon' ? 1 : 0});
  var patrec = this.patternRecorders[this.instrument][this.pattern];
  if (patrec.recording) {
    if (patrec.hasNotes) {
      this.device.set(this.instrument, this.pattern, 1);
    }
    if (!opts.skipRecord) {
      patrec.recordEvent('key', event);
    }
  }
  this.output.send({
    type: type,
    channel: Math.floor(this.instrument / 2),
    note: note.note,
    velocity: note.velocity
  });
  if (this.patternModes[this.instrument] == 1 && !opts.skipRecord) {
    this.addToBuffers(event);
  }
};

Script.prototype.addToBuffers = function (press) {
  if (this.shortBufferPosition == -1 || this.longBufferPosition == -1) {
    return;
  }
  if (!this.shortBuffer[this.shortBufferPosition]) {
    this.shortBuffer[this.shortBufferPosition] = [];
  }
  if (!this.longBuffer[this.longBufferPosition]) {
    this.longBuffer[this.longBufferPosition] = [];
  }
  if (!_.findWhere(this.shortBuffer[this.shortBufferPosition], {type: 'key', event: press})) {
    this.shortBuffer[this.shortBufferPosition].push({
      type: 'key',
      event: press
    });
  }
  if (!_.findWhere(this.longBuffer[this.longBufferPosition], {type: 'key', event: press})) {
    this.longBuffer[this.longBufferPosition].push({
      type: 'key',
      event: press
    });
  }
};

Script.prototype.onKey = function (press) {
  if (press.s === 0) {
    return;
  }
  if (press.y === 0) {
    this.device.set(this.instrument, 0, 0);
    for (var i = 0; i < 4; i++) {
      this.patternRecorders[this.instrument][i].recording = 0;
    }
    this.instrument = press.x;
    this.device.set(this.instrument, 0, 1);
  }
  if (press.y == 1) {
    var self = this;
    _.each(this.patternRecorders[this.instrument], function (patrec, i) {
      patrec.clear();
      patrec.recording = 0;
      self.device.set(self.instrument, i + 4, 0);
    });
  }
  if (press.y == 2) {
    var patrec = this.patternRecorders[this.instrument][this.pattern];
    if (patrec.muted) {
      patrec.muted = 0;
      this.device.set(this.instrument, 2, 1);
    } else {
      patrec.muted = 1;
      patrec.releasePressedKeys();
      this.device.set(this.instrument, 2, 0);
    }
  }
  if (press.y == 3) {
    if (this.patternModes[press.x] == 1) {
      this.patternModes[press.x] = 0;
      this.device.set(press.x, 3, 0);
    } else {
      this.patternModes[press.x] = 1;
      this.device.set(press.x, 3, 1);
    }
  }
  if (press.y > 3) {
    this.patternRecorders[this.instrument][this.pattern].recording = 0;
    this.instrument = press.x;
    this.pattern = press.y - 4;
    var patrec = this.patternRecorders[this.instrument][this.pattern];
    if (this.patternModes[press.x] == 1) {
      patrec.recording = 1;
      this.device.set(press.x, press.y, 1);
    } else {
      if (this.pattern === 0 || this.pattern == 1) {
        patrec.queue = _.clone(this.shortBuffer);
        patrec.position = this.shortBufferPosition;
      } else if (this.pattern == 2 || this.pattern == 3) {
        patrec.queue = _.clone(this.longBuffer);
        patrec.position = this.longBufferPosition;
      }
      patrec.hasNotes = true;
      this.device.set(press.x, press.y, 1);
    }
  }
};

Script.prototype.onClock = function () {
  this.shortBufferPosition++;
  this.longBufferPosition++;
  if (this.shortBufferPosition == 192) {
    this.shortBufferPosition = 0;
  }
  if (this.longBufferPosition == 384) {
    this.longBufferPosition = 0;
  }
  this.shortBuffer[this.shortBufferPosition] = [];
  this.longBuffer[this.longBufferPosition] = [];
  _.each(this.patternRecorders, function (patterns) {
    _.each(patterns, function (patrec) {
      patrec.tick();
    });
  });
};

Script.prototype.onPosition = function (ev) {
  if (ev.lsb === 0 && ev.msb === 0) {
    _.each(this.patternRecorders, function (patrec) {
      patrec.reset();
    });
  }
};

module.exports = Script;
