var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var liveosc = require('../lib/liveosc');

var Script = function (device, config, ledState) {
  this.device = device;
  this.config = config;
  this.ledState = ledState;
  this.output = new midi.Output(config.out, true);
  this.input = new midi.Input(config.in, true);
  this.patternRecorders = [];
  this.tinyBuffer = [];
  this.shorterBuffer = [];
  this.shortBuffer = [];
  this.longBuffer = [];
  this.tinyBufferPosition = -1;
  this.shorterBufferPosition = -1;
  this.shortBufferPosition = -1;
  this.longBufferPosition = -1;
  this.tinyLength = 48;
  this.shorterLength = 96;
  this.shortLength = 192;
  this.longLength = 384;
  this.fingerOctave = 1;
  this.fingerState = [];
  var self = this;

  liveosc.song().on('ready', function () {
    liveosc.device(0, 'master').on('param', function (params) {
      if (params.value != 2) {
        return;
      }
      for (var i = 0; i < 8; i++) {
        self.patternRecorders[i].clear();
        self.patternRecorders[i].recording = 0;
        self.patternRecorders[i].muted = 0;
        self.device.set(i, 0, 0);
        self.device.set(i, 1, 0);
        self.device.set(i, 2, 0);
      }
    });
  });

  _.each(_.range(8), function (i) {
    self.patternRecorders[i] = new PatternRecorder();
    self.device.set(i, 2, 1);
    self.patternRecorders[i].on('recordedEvent', function (type, ev) {
      if (ev.s == 1) {
        self.flashLed(i, 0, self.patternRecorders[i].recording);
      }
      self.device.emit(type, ev, {skipRecord: true});
    });
  });

  self.patternRecorders[0].length = self.tinyLength;
  self.patternRecorders[1].length = self.tinyLength;
  self.patternRecorders[2].length = self.shorterLength;
  self.patternRecorders[3].length = self.shorterLength;
  self.patternRecorders[4].length = self.shortLength;
  self.patternRecorders[5].length = self.shortLength;
  self.patternRecorders[6].length = self.longLength;
  self.patternRecorders[7].length = self.longLength;

  this.device.on('key', function (press, opts) {
    self.handlePress(press, opts);
  });

  this.input.on('noteon', function (data) {
    var press = self.noteToLed(data);
    if (press) {
      self.device.set(press.x, press.y, 1);
    }
  });

  this.input.on('noteoff', function (data) {
    var press = self.noteToLed(data);
    if (press) {
      self.device.set(press.x, press.y, 0);
    }
  });

  this.input.on('clock', function () {
    self.tinyBufferPosition++;
    self.shorterBufferPosition++;
    self.shortBufferPosition++;
    self.longBufferPosition++;
    if (self.tinyBufferPosition == self.tinyLength) {
      self.tinyBufferPosition = 0;
    }
    if (self.shorterBufferPosition == self.shorterLength) {
      self.shorterBufferPosition = 0;
    }
    if (self.shortBufferPosition == self.shortLength) {
      self.shortBufferPosition = 0;
    }
    if (self.longBufferPosition == self.longLength) {
      self.longBufferPosition = 0;
    }
    self.tinyBuffer[self.tinyBufferPosition] = [];
    self.shorterBuffer[self.shorterBufferPosition] = [];
    self.shortBuffer[self.shortBufferPosition] = [];
    self.longBuffer[self.longBufferPosition] = [];
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
    if (press.s == 1) {
      if (this.patternRecorders[press.x].hasNotes) {
        return;
      }
      this.device.set(press.x, 1, 1);
      this.device.set(press.x, 2, 1);
      if (press.x <= 1) {
        this.patternRecorders[press.x].queue = _.clone(this.tinyBuffer);
        this.patternRecorders[press.x].position = this.tinyBufferPosition;
      } else if (press.x <= 3) {
        this.patternRecorders[press.x].queue = _.clone(this.shorterBuffer);
        this.patternRecorders[press.x].position = this.shorterBufferPosition;
      } else if (press.x <= 5) {
        this.patternRecorders[press.x].queue = _.clone(this.shortBuffer);
        this.patternRecorders[press.x].position = this.shortBufferPosition;
      } else {
        this.patternRecorders[press.x].queue = _.clone(this.longBuffer);
        this.patternRecorders[press.x].position = this.longBufferPosition;
      }
      this.patternRecorders[press.x].hasNotes = true;
    }
  }
  if (press.y == 1) {
    if (press.s == 1) {
      this.patternRecorders[press.x].clear();
      this.patternRecorders[press.x].recording = 0;
      this.device.set(press.x, 0, 0);
      this.device.set(press.x, 1, 0);
      this.patternRecorders[press.x].muted = 0;
      this.device.set(press.x, 2, 1);
    }
  }
  if (press.y == 2) {
    if (press.s == 1) {
      if (this.patternRecorders[press.x].muted) {
        this.patternRecorders[press.x].muted = 0;
        this.device.set(press.x, 2, 1);
      } else {
        this.patternRecorders[press.x].muted = 1;
        this.patternRecorders[press.x].releasePressedKeys();
        this.device.set(press.x, 2, 0);
      }
    }
  }
  if (press.y == 3 && press.x <= 1) {
    if (press.s == 1) {
      if (press.x == 0) {
        this.fingerOctave--;
        if (this.fingerOctave < 0) {
          this.fingerOctave = 0;
        }
      }
      if (press.x == 1) {
        this.fingerOctave++;
        if (this.fingerOctave > 2) {
          this.fingerOctave = 2;
        }
      }
      this.drawFingerState();
      this.drawFingerOctave();
    }
  } else if (press.y == 3) {
    var slot = (this.fingerOctave * 6) + press.x - 2;
    if (press.s != 1) {
      return;
    }
    if (this.fingerState[slot]) {
      this.fingerState[slot] = false;
      this.playNote({x: press.x, y: press.y, s: 0});
      this.device.set(press.x, press.y, 0);
    } else {
      this.fingerState[slot] = true;
      this.playNote({x: press.x, y: press.y, s: 1});
      this.device.set(press.x, press.y, 1);
    }

  } else if (press.y > 3) {
    this.playNote(press);
    if (press.y >= 4) {
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
      if (!patternRecording && !opts.skipRecord) {
        this.addToBuffers(press);
      }
    }
  }
};

Script.prototype.addToBuffers = function (press) {
  if (this.tinyBufferPosition == -1 || this.shorterBufferPosition == -1 || this.shortBufferPosition == -1 || this.longBufferPosition == -1) {
    return;
  }
  if (!this.tinyBuffer[this.tinyBufferPosition]) {
    this.tinyBuffer[this.tinyBufferPosition] = [];
  }
  if (!this.shorterBuffer[this.shorterBufferPosition]) {
    this.shorterBuffer[this.shorterBufferPosition] = [];
  }
  if (!this.shortBuffer[this.shortBufferPosition]) {
    this.shortBuffer[this.shortBufferPosition] = [];
  }
  if (!this.longBuffer[this.longBufferPosition]) {
    this.longBuffer[this.longBufferPosition] = [];
  }
  if (!_.findWhere(this.tinyBuffer[this.tinyBufferPosition], {type: 'key', event: press})) {
    this.tinyBuffer[this.tinyBufferPosition].push({
      type: 'key',
      event: press
    });
  }
  if (!_.findWhere(this.shorterBuffer[this.shorterBufferPosition], {type: 'key', event: press})) {
    this.shorterBuffer[this.shorterBufferPosition].push({
      type: 'key',
      event: press
    });
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

Script.prototype.noteToLed = function (note) {
  if (note.channel == 0) {
    var y = Math.floor((note.note - 36) / this.device.sizeX);
    y += this.device.sizeY - 4;
    var x = (note.note - 36) % this.device.sizeX;
    return {x:x, y:y};
  }
  // } else if (note.channel == 1) {
  //   var y = 3;
  //   var x = (note.note - 48 - (this.fingerOctave * 6));
  //   return {x:x, y:y};
  // }
};

Script.prototype.flashLed = function (x, y, state) {
  var self = this;
  if (state == 1) {
    this.device.set(x, y, 0);
    setTimeout(function() {
      self.device.set(x, y, 1);
    }, 20);
  } else {
    this.device.set(x, y, 1);
    setTimeout(function() {
      self.device.set(x, y, 0);
    }, 20);
  }
};

Script.prototype.playNote = function (press) {
  var note;
  if (press.y > 3) {
    note = ((press.y - this.device.sizeY + 4) * this.device.sizeX) + press.x + 36;
  } else {
    note = press.x + 48 + (this.fingerOctave * 6);
  }
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

Script.prototype.drawFingerState = function () {
  for (var i = 0; i < 6; i++) {
    var idx = i + (this.fingerOctave * 6);
    var slot = this.fingerState[idx];
    if (slot) {
      this.device.set(i + 2, 3, 1);
    } else {
      this.device.set(i + 2, 3, 0);
    }
  }
};

Script.prototype.drawFingerOctave = function () {
  if (this.fingerOctave == 0) {
    this.device.set(0, 3, 1);
    this.device.set(1, 3, 0);
  }
  if (this.fingerOctave == 1) {
    this.device.set(0, 3, 0);
    this.device.set(1, 3, 0);
  }
  if (this.fingerOctave == 2) {
    this.device.set(0, 3, 0);
    this.device.set(1, 3, 1);
  }
};

module.exports = Script;
