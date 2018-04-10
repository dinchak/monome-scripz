var _ = require('underscore');
var midi = require('../lib/midi');
var PatternRecorder = require('../lib/pattern-recorder');
var liveosc = require('../lib/liveosc');

var Script = module.exports = function () {};

Script.prototype.init = function () {
  this.output = new midi.Output(this.config.midiout, true);
  this.input = new midi.Input(this.config.midiin, true);
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

  var self = this;

  _.each(_.range(15), function (i) {
    self.patternRecorders[i] = new PatternRecorder();
    self.set(i, 2, 1);
    self.patternRecorders[i].on('recordedEvent', function (type, ev) {
      if (ev.s == 1) {
        self.flashLed(i, 0, self.patternRecorders[i].recording);
      }
      if (type == 'key') {
        self.key(ev, {skipRecord: true});
      }
    });
  });

  this.patternRecorders[0].length = self.tinyLength;
  this.patternRecorders[1].length = self.tinyLength;
  this.patternRecorders[2].length = self.tinyLength;
  this.patternRecorders[3].length = self.tinyLength;
  this.patternRecorders[4].length = self.shorterLength;
  this.patternRecorders[5].length = self.shorterLength;
  this.patternRecorders[6].length = self.shorterLength;
  this.patternRecorders[7].length = self.shorterLength;
  this.patternRecorders[8].length = self.shortLength;
  this.patternRecorders[9].length = self.shortLength;
  this.patternRecorders[10].length = self.shortLength;
  this.patternRecorders[11].length = self.shortLength;
  this.patternRecorders[12].length = self.longLength;
  this.patternRecorders[13].length = self.longLength;
  this.patternRecorders[14].length = self.longLength;

  this.input.on('noteon', function (data) {
    var press = self.noteToLed(data);
    if (press) {
      self.set(press.x, press.y, 1);
    }
  });

  this.input.on('noteoff', function (data) {
    var press = self.noteToLed(data);
    if (press) {
      self.set(press.x, press.y, 0);
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
    self.tinyBufferPosition = -1;
    self.shorterBufferPosition = -1;
    self.shortBufferPosition = -1;
    self.longBufferPosition = -1;
  });

  this.set(this.device.sizeX - 1, 0, 1);
  this.set(this.device.sizeX - 1, 1, 0);
  this.set(this.device.sizeX - 1, 2, 0);
};

Script.prototype.key = function (press, opts) {
  opts = opts || {};

  var patternRecording = false;
  _.each(this.patternRecorders, function (patrec) {
    if (patrec.recording) {
      patternRecording = true;
    }
  });

  if (press.x == this.device.sizeX - 1 && press.y < 3 && press.s == 1) {
    this.pager.change(press.y);
    return;
  }

  if (press.y === 0) {
    if (press.s == 1) {
      if (this.patternRecorders[press.x].hasNotes) {
        return;
      }
      this.set(press.x, 1, 1);
      this.set(press.x, 2, 1);
      if (press.x <= 3) {
        this.patternRecorders[press.x].queue = _.clone(this.tinyBuffer);
        this.patternRecorders[press.x].position = this.tinyBufferPosition;
      } else if (press.x <= 7) {
        this.patternRecorders[press.x].queue = _.clone(this.shorterBuffer);
        this.patternRecorders[press.x].position = this.shorterBufferPosition;
      } else if (press.x <= 11) {
        this.patternRecorders[press.x].queue = _.clone(this.shortBuffer);
        this.patternRecorders[press.x].position = this.shortBufferPosition;
      } else {
        this.patternRecorders[press.x].queue = _.clone(this.longBuffer);
        this.patternRecorders[press.x].position = this.longBufferPosition;
      }
      this.patternRecorders[press.x].hasNotes = true;
    }
  }

  else if (press.y == 1) {
    if (press.s == 1) {
      this.patternRecorders[press.x].clear();
      this.patternRecorders[press.x].recording = 0;
      this.patternRecorders[press.x].muted = 0;
      this.set(press.x, 0, 0);
      this.set(press.x, 1, 0);
      this.set(press.x, 2, 1);
    }
  }

  else if (press.y == 2) {
    if (press.s == 1) {
      if (this.patternRecorders[press.x].muted) {
        this.patternRecorders[press.x].muted = 0;
        this.set(press.x, 2, 1);
      } else {
        this.patternRecorders[press.x].muted = 1;
        this.set(press.x, 2, 0);
      }
    }
  }

  else if (press.y >= 3) {
    this.playNote(press);
    _.each(this.patternRecorders, function (patrec, i) {
      if (patrec.recording) {
        if (patrec.hasNotes) {
          this.set(i, 1, 1);
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
};

Script.prototype.addToBuffers = function (press) {
  if (
    this.tinyBufferPosition == -1 ||
    this.shorterBufferPosition == -1 ||
    this.shortBufferPosition == -1 ||
    this.longBufferPosition == -1
  ) {
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
  var y = note.channel + 3;
  var x = (note.note - 36);
  return {x:x, y:y};
};

Script.prototype.flashLed = function (x, y, state) {
  var self = this;
  if (state == 1) {
    this.set(x, y, 0);
    setTimeout(function() {
      self.set(x, y, 1);
    }, 20);
  } else {
    this.set(x, y, 1);
    setTimeout(function() {
      self.set(x, y, 0);
    }, 20);
  }
};

Script.prototype.playNote = function (press) {
  var note = press.x + 36;
  var channel = press.y - 3;
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
    channel: channel,
    note: note,
    velocity: velocity
  });
};