var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var events = require('../lib/events');

var Script = function (device, config, ledState) {
  this.device = device;
  this.config = config;
  this.ledState = ledState;
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.keyboard = new midi.Input(config.keyboard);
  this.patternRecorders = [];
  this.patternModes = [];
  this.patternMutes = [];
  this.shortBuffer = [];
  this.longBuffer = [];
  this.tick = -1;
  this.shortLength = 384;
  this.longLength = 768;
  this.shortBufferPosition = -1;
  this.longBufferPosition = -1;
  this.instrument = 0;
  this.pattern = 0;
  device.set(this.instrument, 0, 1);
  var self = this;
  _.each(_.range(8), function (i) {
    self.patternRecorders[i] = [];
    self.patternMutes[i] = 0;
    self.device.set(i, 2, 1);
    self.patternModes[i] = 1;
    self.device.set(i, 3, 1);
    _.each(_.range(4), function (j) {
      self.patternRecorders[i][j] = new PatternRecorder();
      if (j < 2) {
        self.patternRecorders[i][j].length = self.shortLength;
      } else {
        self.patternRecorders[i][j].length = self.longLength;
      }
      self.patternRecorders[i][j].playing = 0;
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
  this.input.on('position', _.bind(this.onPosition, this));
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
      this.device.set(this.instrument, this.pattern + 4, 1);
    }
    if (!opts.skipRecord && this.patternModes[this.instrument] == 1) {
      patrec.recordEvent('key', event);
    }
  }
  this.output.send({
    type: type,
    channel: Math.floor(this.instrument / 2),
    note: note.note,
    velocity: note.velocity
  });
  if (!opts.skipRecord) {
    this.addToBuffers(event);
  }
  this.setClearButton(this.instrument);
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

Script.prototype.setInstrument = function (newInstrument) {
  this.device.set(this.instrument, 0, 0);
  for (var i = 0; i < 4; i++) {
    this.patternRecorders[this.instrument][i].recording = 0;
  }
  this.instrument = newInstrument;
  this.device.set(this.instrument, 0, 1);
  events.emit('midilooper:setInstrument', newInstrument);
};

Script.prototype.onKey = function (press) {
  if (press.s === 0) {
    return;
  }
  if (press.y === 0) {
    if (press.x != this.instrument) {
      this.setInstrument(press.x);
    }
  }
  if (press.y == 1) {
    var self = this;
    _.each(this.patternRecorders[press.x], function (patrec, i) {
      patrec.clear();
      patrec.recording = 0;
      patrec.playing = 0;
      self.device.set(press.x, i + 4, 0);
    });
    self.device.set(press.x, 1, 0);
  }
  if (press.y == 2) {
    var mute = this.patternMutes[press.x];
    if (mute == 1) {
      this.device.set(press.x, 2, 0);
      this.patternMutes[press.x] = 0;
    } else {
      this.device.set(press.x, 2, 1);
      this.patternMutes[press.x] = 1;
    }
    for (var p = 0; p < 4; p++) {
      var patrec = this.patternRecorders[press.x][p];
      if (mute) {
        patrec.muted = 1;
        patrec.releasePressedKeys();
      } else {
        patrec.muted = 0;
      }
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
    var clearPatrec = this.patternRecorders[press.x][press.y - 4];
    if (clearPatrec.playing) {
      clearPatrec.clear();
      clearPatrec.recording = 0;
      clearPatrec.playing = 0;
      this.device.set(press.x, press.y, 0);
      this.setClearButton(press.x);
      return;
    }
    for (var i = 0; i < 4; i++) {
      this.patternRecorders[press.x][i].recording = 0;
      this.patternRecorders[press.x][i].playing = 0;
      if (this.patternRecorders[press.x][i].hasNotes) {
        this.device.set(press.x, i + 4, 1);
      }
    }
    if (press.x != this.instrument) {
      this.setInstrument(press.x);
    }
    this.pattern = press.y - 4;
    var patrec = this.patternRecorders[this.instrument][this.pattern];
    if (this.patternModes[press.x] == 1) {
      patrec.recording = 1;
      patrec.playing = 1;
      this.device.set(press.x, press.y, 1);
    } else {
      if (patrec.hasNotes) {
        patrec.playing = 1;
        patrec.recording = 1;
        return;
      }
      if (this.pattern === 0 || this.pattern == 1) {
        patrec.queue = _.clone(this.shortBuffer);
        patrec.position = this.shortBufferPosition;
      } else if (this.pattern == 2 || this.pattern == 3) {
        patrec.queue = _.clone(this.longBuffer);
        patrec.position = this.longBufferPosition;
      }
      patrec.playing = 1;
      patrec.recording = 1;
      patrec.hasNotes = true;
      this.device.set(press.x, press.y, 1);
    }
    this.setClearButton(press.x);
  }
};

Script.prototype.setClearButton = function (col) {
  var isEmpty = true;
  for (var p = 0; p < 4; p++) {
    var patrec = this.patternRecorders[col][p];
    if (patrec.hasNotes) {
      isEmpty = false;
    }
  }
  if (isEmpty) {
    this.device.set(col, 1, 0);
  } else {
    this.device.set(col, 1, 1);
  }
};

Script.prototype.onClock = function () {
  this.shortBufferPosition++;
  this.longBufferPosition++;
  this.tick++;
  if (this.tick == 96) {
    this.tick = 0;
  }
  if (this.shortBufferPosition == this.shortLength) {
    this.shortBufferPosition = 0;
  }
  if (this.longBufferPosition == this.longLength) {
    this.longBufferPosition = 0;
  }
  this.shortBuffer[this.shortBufferPosition] = [];
  this.longBuffer[this.longBufferPosition] = [];
  _.each(this.patternRecorders, function (patterns) {
    _.each(patterns, function (patrec) {
      patrec.tick();
    });
  });
  for (var i = 0; i < 8; i++) {
    for (var p = 0; p < 4; p++) {
      if (this.patternRecorders[i][p].playing) {
        if (this.tick % 24 < 4) {
          this.device.set(i, p + 4, 0);
        } else {
          this.device.set(i, p + 4, 1);
        }
      }
    }
  }
};

Script.prototype.onPosition = function (ev) {
  if (ev.lsb === 0 && ev.msb === 0) {
    _.each(this.patternRecorders, function (patrecs) {
      _.each(patrecs, function (patrec) {
        patrec.reset();
      });
    });
    this.shortBufferPosition = -1;
    this.longBufferPosition = -1;
    this.tick = -1;
  }
};

module.exports = Script;
