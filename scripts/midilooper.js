var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var events = require('../lib/events');
var liveosc = require('../lib/liveosc');

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
  this.tempo = 120.0;
  this.looperOverdub = false;
  this.looperBeat = 0;
  this.songSelect = 0;
  device.set(this.instrument, 0, 1);
  var self = this;
  _.each(_.range(8), function (i) {
    self.patternRecorders[i] = [];
    self.patternMutes[i] = 1;
    self.device.set(i, 2, 1);
    self.patternModes[i] = 0;
    self.device.set(self.songSelect, 7, 1);
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

  liveosc.song().on('ready', _.bind(function () {
    liveosc.song().on('beat', _.bind(function () {
      if (this.looperOverdub && this.looperBeat + 16 == liveosc.song().beat) {
        this.looperOverdub = false;
        this.sendLooperNote(0);
      }
    }, this));

    liveosc.device(0, 'master').on('param', _.bind(function (params) {
      if (params.value === 0) {
        this.device.set(3, 3, 0);
        this.device.set(4, 3, 0);
        this.device.set(5, 3, 0);
      }
      if (params.value === 1) {
        this.device.set(3, 3, 1);
        this.device.set(4, 3, 0);
        this.device.set(5, 3, 0);
      }
      if (params.value === 2) {
        this.device.set(3, 3, 0);
        this.device.set(4, 3, 0);
        this.device.set(5, 3, 1);
      }
      if (params.value === 3) {
        this.device.set(3, 3, 1);
        this.device.set(4, 3, 1);
        this.device.set(5, 3, 0);
      }
      if (params.value != 2) {
        return;
      }
      for (var x = 0; x < 8; x++) {
        events.emit('midilooper:resetEffects', x);
        _.each(self.patternRecorders[x], function (patrec, i) {
          patrec.clear();
          patrec.recording = 0;
          patrec.playing = 0;
          self.device.set(x, i + 4, 0);
        });
        self.device.set(x, 1, 0);
        this.allNotesOff();
      }
    }, this));
  }, this));

  this.device.on('key', _.bind(this.onKey, this));
  this.input.on('clock', _.bind(this.onClock, this));
  this.input.on('position', _.bind(this.onPosition, this));

  liveosc.song().on('clip:state', _.bind(this.onClipState, this));
  liveosc.song().on('tempo', _.bind(function (tempo) {
    this.tempo = tempo.value;
  }, this));

  this.keyboard.on('noteon', function (note) {
    self.onNote(note, 'noteon');
  });

  this.keyboard.on('noteoff', function (note) {
    if (note.channel == 15) {
      var press = self.noteToLed(data);
      self.device.set(press.x, press.y, 1);
    } else {
      self.onNote(note, 'noteoff');
    }
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
  // this.setClearButton(this.instrument);
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
    events.emit('midilooper:resetEffects', press.x);
    // var self = this;
    // _.each(this.patternRecorders[press.x], function (patrec, i) {
    //   patrec.clear();
    //   patrec.recording = 0;
    //   patrec.playing = 0;
    //   self.device.set(press.x, i + 4, 0);
    // });
    // self.device.set(press.x, 1, 0);
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
    if (press.x < 3) {
      this.launchClip(press);
    }
    if (press.x == 3) {
      this.sendLooperNote(0);
    }
    if (press.x == 4) {
      this.looperOverdub = true;
      this.looperBeat = liveosc.song().beat;
      this.sendLooperNote(1);
    }
    if (press.x == 5) {
      this.sendLooperNote(2);
    }
    if (press.x == 6) {
      this.tempoDown();
    }
    if (press.x == 7) {
      this.tempoUp();
    }
  }
  if (press.y > 3 && press.y != 7) {
    var clearPatrec = this.patternRecorders[press.x][press.y - 4];
    if (clearPatrec.playing) {
      clearPatrec.clear();
      clearPatrec.recording = 0;
      clearPatrec.playing = 0;
      this.device.set(press.x, press.y, 0);
      // this.setClearButton(press.x);
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
    // this.setClearButton(press.x);
  }
  if (press.y == 7) {
    this.device.set(this.songSelect, 7, 0);
    this.device.set(press.x, 7, 1);
    this.songSelect = press.x;
    this.output.send({
      type: 'cc',
      value: press.x,
      channel: 14
    });
  }
};

// Script.prototype.setClearButton = function (col) {
//   var isEmpty = true;
//   for (var p = 0; p < 4; p++) {
//     var patrec = this.patternRecorders[col][p];
//     if (patrec.hasNotes) {
//       isEmpty = false;
//     }
//   }
//   if (isEmpty) {
//     this.device.set(col, 1, 0);
//   } else {
//     this.device.set(col, 1, 1);
//   }
// };

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

Script.prototype.launchClip = function (press) {
  if (press.s != 1) {
    return;
  }
  var trackId = 0;
  var clipId = press.x;
  var clip = liveosc.clip(clipId, trackId);
  if (clip) {
    clip.play();
  }
};

Script.prototype.onClipState = function (data) {
  if (data.trackId != 0 || data.id >= 6) {
    return;
  }
  if (data.value == 2) {
    this.device.set(data.id, 3, 1);
  } else {
    this.device.set(data.id, 3, 0);
  }
};

Script.prototype.tempoDown = function () {
  liveosc.song().setTempo(this.tempo - 5);
};

Script.prototype.tempoUp = function () {
  liveosc.song().setTempo(this.tempo + 5);
};

Script.prototype.sendLooperNote = function (num) {
  this.output.send({
    type: 'noteon',
    channel: 15,
    note: num,
    velocity: 127
  });
  this.output.send({
    type: 'noteoff',
    channel: 15,
    note: num,
    velocity: 127
  });
}

Script.prototype.allNotesOff = function () {
  for (var c = 0; c < 4; c++) {
    for (var n = 0; n < 128; n++) {
      this.output.send({
        type: 'noteoff',
        channel: c,
        note: n,
        velocity: 127
      });
    }
  }
};

module.exports = Script;
