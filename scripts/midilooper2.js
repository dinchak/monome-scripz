var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var events = require('../lib/events');
var liveosc = require('../lib/liveosc');

var Script = module.exports = function () {};

Script.prototype.init = function () {
  this.output = new midi.Output(this.config.midiout, true);
  this.input = new midi.Input(this.config.midiin, true);
  this.keyboard = new midi.Input(this.config.keyboard);
  this.patternRecorders = [];
  this.patternMutes = [];
  this.shortBuffer = [];
  this.longBuffer = [];
  this.tick = -1;
  this.shortLength = 384;
  this.longLength = 768;
  this.shortBufferPosition = -1;
  this.longBufferPosition = -1;
  this.instrument = 0;
  this.patch = [];
  this.pattern = 0;
  this.tempo = 120.0;
  this.scale = 0;
  this.scaleNotesOn = [];
  this.chordMode = 0;
  this.chordNotesOn = [];
  this.scales = [
  // C  C# D  D# E  F  F# G  G# A  A# B
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1], // C
    [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1], // G
    [0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1], // D
    [0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1], // A
    [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1], // E
    [0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1], // B
    [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1], // F#
    [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0], // C#
    [1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0], // G#
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0], // D#
    [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0], // A#
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0], // F
  ];
  this.chordTable = [];
  for (var i = 0; i < 140; i++) {
    this.chordTable[i] = 2 + Math.floor(Math.random() * 3);
  }

  // first instrument, first patch
  this.set(0, 0, 1);
  
  var self = this;
  _.each(_.range(8), function (i) {
    self.patch[i] = 0;
    self.patternRecorders[i] = [];
    self.patternMutes[i] = 1;
    self.scaleNotesOn[i] = [];
    self.chordNotesOn[i] = [];
    self.set(12, i, 1);
    _.each(_.range(8), function (j) {
      self.patternRecorders[i][j] = new PatternRecorder();
      if (j < 4) {
        self.patternRecorders[i][j].length = self.shortLength;
      } else {
        self.patternRecorders[i][j].length = self.longLength;
      }
      self.patternRecorders[i][j].playing = 0;
      self.patternRecorders[i][j].on('recordedEvent', function (type, ev) {
        // self.setNotesOn(ev.s ? 'noteon' : 'noteoff', ev.note, i);
        self.output.send({
          type: ev.s ? 'noteon' : 'noteoff',
          channel: i,
          note: ev.note,
          velocity: ev.velocity
        });
      });
    });
  });

  this.input.on('clock', _.bind(this.onClock, this));
  this.input.on('position', _.bind(this.onPosition, this));

  liveosc.song().on('tempo', _.bind(function (tempo) {
    this.tempo = tempo.value;
  }, this));

  this.keyboard.on('noteon', function (note) {
    self.onNote(note, 'noteon');
  });

  this.keyboard.on('noteoff', function (note) {
    self.onNote(note, 'noteoff');
  });

  this.set(this.device.sizeX - 1, 0, 0);
  this.set(this.device.sizeX - 1, 1, 1);
  this.set(this.device.sizeX - 1, 2, 0);
  this.set(this.device.sizeX - 2, 0, 1);
  this.set(this.device.sizeX - 3, 0, 1);
};

Script.prototype.key = function (press) {
  if (press.s === 0) {
    return;
  }

  if (press.x == this.device.sizeX - 1 && press.y < 3) {
    this.pager.change(press.y);
    return;
  }

  if (press.x == this.device.sizeX - 1 && press.y == 3) {
    return;
  }

  if (press.x < 4) {
    this.setInstrumentPatch(press);
    return;
  }

  if (press.x == 12) {
    var mute = this.patternMutes[press.y];
    if (mute == 1) {
      this.set(press.x, press.y, 0);
      this.patternMutes[press.y] = 0;
    } else {
      this.set(press.x, press.y, 1);
      this.patternMutes[press.y] = 1;
    }
    for (var p = 0; p < 8; p++) {
      var patrec = this.patternRecorders[press.y][p];
      if (mute) {
        patrec.muted = 1;
        patrec.releasePressedKeys();
      } else {
        patrec.muted = 0;
      }
    }
    return;
  }

  if (press.x == 13) {
    this.set(press.x, this.chordMode, 0);
    this.setChordMode(press.y);
    this.set(press.x, this.chordMode, 1);
    return;
  }

  if (press.x > 3 && press.x < 12) {
    var clearPatrec = this.patternRecorders[press.y][press.x - 4];
    if (clearPatrec.playing) {
      clearPatrec.clear();
      clearPatrec.playing = 0;
      this.set(press.x, press.y, 0);
      return;
    }
    if (this.instrument != press.y) {
      this.setInstrument(press.y);
    }
    this.pattern = press.x - 4;
    var patrec = this.patternRecorders[this.instrument][this.pattern];
    if (patrec.hasNotes) {
      patrec.playing = 1;
      return;
    }
    if (this.pattern < 4) {
      patrec.queue = _.clone(this.shortBuffer);
      patrec.position = this.shortBufferPosition;
    } else {
      patrec.queue = _.clone(this.longBuffer);
      patrec.position = this.longBufferPosition;
    }
    patrec.playing = 1;
    patrec.hasNotes = true;
    this.set(press.x, press.y, 1);
  }

  if (press.x == 14) {
    this.unsetScale();
    this.scale = press.y;
    this.setScale(press.y);
    this.set(press.x, press.y, 1);
    return;
  }

  if (press.x == 15) {
    this.unsetScale();
    this.setScale(8 + (press.y - 4));
    this.set(press.x, press.y, 1);
    return;
  }
};

Script.prototype.setChordMode = function (mode) {
  this.chordMode = mode;
  var removeNotes = [];
  for (var i = 0; i < 8; i++) {
    for (var n = 0; n < this.chordNotesOn[i].length; n++) {
      var note = this.chordNotesOn[i][n];
      this.output.send({
        type: 'noteoff',
        note: note,
        velocity: 127,
        channel: i
      });
      removeNotes.push({
        instrument: i,
        note: note
      });
    }
  }
  for (var i = 0; i < removeNotes.length; i++) {
    var instrument = removeNotes[i].instrument;
    var note = removeNotes[i].note;
    this.chordNotesOn[instrument] = _.without(this.chordNotesOn[instrument], note);
  }
};

Script.prototype.setScale = function (scale) {
  this.scale = scale;
  var removeNotes = [];
  for (var i = 0; i < 8; i++) {
    for (var n = 0; n < this.scaleNotesOn[i].length; n++) {
      var note = this.scaleNotesOn[i][n];
      if (!this.scales[this.scale][note % 12]) {
        this.output.send({
          type: 'noteoff',
          note: note,
          velocity: 127,
          channel: i
        });
        removeNotes.push({
          instrument: i,
          note: note
        });
      }
    }
  }
  for (var i = 0; i < removeNotes.length; i++) {
    var instrument = removeNotes[i].instrument;
    var note = removeNotes[i].note;
    this.scaleNotesOn[instrument] = _.without(this.scaleNotesOn[instrument], note);
  }
}

Script.prototype.unsetScale = function () {
  var scaleX = this.scale >= 8 ? 15 : 14;
  var scaleY = this.scale >= 8 ? (this.scale % 8) + 4 : this.scale % 8;
  this.set(scaleX, scaleY, 0);
};

Script.prototype.adhereToScale = function (note) {
  var scaledNote = note % 12;
  if (this.scale == 6 && scaledNote == 5) {
    return note + 1;
  }
  if (!this.scales[this.scale][scaledNote]) {
    if (this.scale > 6) {
      if (this.scales[this.scale][scaledNote - 1]) {
        return note - 1;
      }
      if (this.scales[this.scale][scaledNote + 1]) {
        return note + 1;
      }
    } else {
      if (this.scales[this.scale][scaledNote + 1]) {
        return note + 1;
      }
      if (this.scales[this.scale][scaledNote - 1]) {
        return note - 1;
      }

    }
  }
  return note;
};

Script.prototype.setScaleNotesOn = function (type, note, instrument) {
  if (type == 'noteon') {
    if (this.scaleNotesOn[instrument].indexOf(note) == -1) {
      this.scaleNotesOn[instrument].push(note);
    }
  } else if (type == 'noteoff') {
    this.scaleNotesOn[instrument] = _.without(this.scaleNotesOn[instrument], note);
  }
};

Script.prototype.setChordNotesOn = function (type, note, instrument) {
  if (type == 'noteon') {
    if (this.chordNotesOn[instrument].indexOf(note) == -1) {
      this.chordNotesOn[instrument].push(note);
    }
  } else if (type == 'noteoff') {
    this.chordNotesOn[instrument] = _.without(this.chordNotesOn[instrument], note);
  }
};

Script.prototype.setInstrument = function (instrument) {
  this.set(this.patch[this.instrument], this.instrument, 0);
  this.instrument = instrument;
  this.set(this.patch[this.instrument], this.instrument, 1);
};

Script.prototype.setInstrumentPatch = function (press) {
  this.set(this.patch[this.instrument], this.instrument, 0);
  this.instrument = press.y;
  this.patch[this.instrument] = press.x;
  this.set(this.patch[this.instrument], this.instrument, 1);
  this.output.send({
    type: 'cc',
    channel: this.instrument,
    controller: 0,
    value: this.patch[this.instrument]
  });
};

Script.prototype.onNote = function (note, type, opts) {
  if (note.note < 0 || note.note > 127) {
    return;
  }
  if (note.velocity < 0) {
    note.velocity = 0;
  }
  if (note.velocity > 127) {
    note.velocity = 127;
  }
  opts = opts || {};
  var event = _.extend(note, {s: type == 'noteon' ? 1 : 0});
  var patrec = this.patternRecorders[this.instrument][this.pattern];
  note.note = this.adhereToScale(note.note);
  this.setScaleNotesOn(type, note.note, this.instrument);
  this.output.send({
    type: type,
    channel: this.instrument,
    note: note.note,
    velocity: note.velocity
  });
  if (!opts.skipChordMode) {
    this.applyChordMode(note, type, opts);
  } else {
    this.setChordNotesOn(type, note.note, this.instrument);
  }
  if (!opts.skipRecord) {
    this.addToBuffers(event);
  }
};

Script.prototype.getChordNotes = function (note) {
  var notes = [];
  if (this.chordMode == 1) {
    notes.push(this.adhereToScale(note + 4));
    notes.push(this.adhereToScale(note + 7));
  }
  if (this.chordMode == 2) {
    notes.push(this.adhereToScale(note + 3));
    notes.push(this.adhereToScale(note + 7));
  }
  if (this.chordMode == 3) {
    notes.push(this.adhereToScale(note + 4));
    notes.push(this.adhereToScale(note + 7));
    notes.push(this.adhereToScale(note + 11));
  }
  if (this.chordMode == 4) {
    notes.push(this.adhereToScale(note + 3));
    notes.push(this.adhereToScale(note + 7));
    notes.push(this.adhereToScale(note + 10));
  }
  if (this.chordMode == 5) {
    notes.push(this.adhereToScale(note + 4));
    notes.push(this.adhereToScale(note + 7));
    notes.push(this.adhereToScale(note + 11));
    notes.push(this.adhereToScale(note + 14));
  }
  if (this.chordMode == 6) {
    notes.push(this.adhereToScale(note + 3));
    notes.push(this.adhereToScale(note + 7));
    notes.push(this.adhereToScale(note + 10));
    notes.push(this.adhereToScale(note + 14));
  }
  if (this.chordMode == 7) {
    for (var i = 0; i < this.chordTable[note]; i++) {
      var random = this.adhereToScale(note + ((i * 3) + this.chordTable[note + i]));
      if (notes.indexOf(random) == -1) {
        notes.push(random);
      }
    }
  }
  return notes;
};

Script.prototype.applyChordMode = function (note, type, opts) {
  var notes = this.getChordNotes(note.note);
  for (var i = 0; i < notes.length; i++) {
    this.onNote({
      note: notes[i],
      velocity: note.velocity
    }, type, _.extend(opts, {skipChordMode: true}));
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
    for (var p = 0; p < 8; p++) {
      if (this.patternRecorders[i][p].playing) {
        if (this.tick % 24 < 4) {
          this.set(p + 4, i, 0);
        } else {
          this.set(p + 4, i, 1);
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

Script.prototype.notesOff = function (c) {
  for (var n = 0; n < 128; n++) {
    this.output.send({
      type: 'noteoff',
      channel: c,
      note: n,
      velocity: 127
    });
  }
};

Script.prototype.allNotesOff = function () {
  for (var c = 0; c < 8; c++) {
    this.notesOff(c);
  }
};

module.exports = Script;
