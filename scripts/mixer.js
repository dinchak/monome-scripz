var _ = require('underscore');
var midi = require('../lib/midi');
var liveosc = require('../lib/liveosc');

var Script = module.exports = function () {};

Script.prototype.init = function () {
  this.output = new midi.Output(this.config.midiout, true);
  this.input = new midi.Input(this.config.midiin, true);
  this.tick = -1;
  this.input.on('clock', this.onClock.bind(this));
  this.input.on('position', this.onPosition.bind(this));
  this.fingersHeld = [];
  this.clockDivisions = [3, 6, 12, 24, 48];
  this.set(this.device.sizeX - 1, 0, 0);
  this.set(this.device.sizeX - 1, 1, 0);
  this.set(this.device.sizeX - 1, 2, 1);
  this.fingerOn = true;
  this.faderCC = [];
  this.faderLED = []
  this.faderIntervals = [];
  this.toggles = [];
  for (var i = 0; i < 15; i++) {
    if (i < 5) {
      this.faderCC[i] = 127;
      this.faderLED[i] = 7;
    } else {
      this.faderCC[i] = 0;
      this.faderLED[i] = 0;
    }
    this.drawFaderState(i);
    this.toggles[i] = 0;
  }
  this.wander = [64, 64, 64, 64, 64];
  this.wanderDir = [-1, -1, 1, 1, -1];
};

Script.prototype.key = function (press) {
  if (press.s != 1) {
    return;
  }

  if (press.x < 15 && press.y < 7) {
    this.handleFader(press);
  }

  if (press.y == 7) {
    if (press.x < 5 || press.x > 9) {
      this.toggleButton(press.x);
    } else {
      this.midiButton(press.x);
    }
  }

  if (press.x == this.device.sizeX - 1 && press.y < 3) {
    this.pager.change(press.y);
  }
};

Script.prototype.toggleButton = function (button) {
  if (this.toggles[button]) {
    this.toggles[button] = 0;
  } else {
    this.toggles[button] = 1;
  }
  this.set(button, 7, this.toggles[button]);
  this.output.send({
    type: 'cc',
    controller: button,
    channel: 14,
    value: this.toggles[button] * 127
  });
};

Script.prototype.midiButton = function (button) {
  this.output.send({
    type: 'cc',
    controller: button,
    channel: 14,
    value: 127
  });
  this.output.send({
    type: 'cc',
    controller: button,
    channel: 14,
    value: 0
  });
};

Script.prototype.handleFader = function (press) {
  var fader = press.x;
  var value = this.faderPressToValue(press.y);
  var prevValue = this.faderCC[fader];
  this.interpolateFader(fader, prevValue, value);
};

Script.prototype.interpolateFader = function (fader, prevValue, value) {
  if (this.faderIntervals[fader]) {
    clearInterval(this.faderIntervals[fader]);
  }
  this.faderIntervals[fader] = setInterval(function () {
    if (prevValue < value) {
      this.faderCC[fader]++;
    } else if (prevValue > value) {
      this.faderCC[fader]--;
    }
    var led = this.faderValueToPress(this.faderCC[fader]);
    if (this.faderLED[fader] != led) {
      this.faderLED[fader] = led;
      this.drawFaderState(fader);
    }
    this.output.send({
      type: 'cc',
      controller: fader,
      channel: 15,
      value: this.faderCC[fader]
    });
    if (this.faderCC[fader] == value) {
      clearInterval(this.faderIntervals[fader]);
    }
  }.bind(this), 3);
};

Script.prototype.drawFaderState = function (fader) {
  var led = this.faderValueToPress(this.faderCC[fader]);
  for (var i = 0; i < 7; i++) {
    if (led >= 6 - i) {
      this.set(fader, i, 1);
    } else {
      this.set(fader, i, 0);
    }
  }
}

Script.prototype.faderPressToValue = function (pressValue) {
  return Math.floor(127 * (6 - pressValue) / 6);
};

Script.prototype.faderValueToPress = function (value) {
  return Math.ceil(value * 6 / 127);
};

Script.prototype.onClock = function () {
  this.tick++;
  if (this.fingerOn) {
    for (var i = 0; i < this.clockDivisions.length; i++) {
      var division = this.clockDivisions[i];
      if (this.tick % division == 0) {
        if (Math.floor(Math.random() * (50 - division)) == 0) {
          this.holdFinger(division);
        }
      }
    }    
  }
  this.unholdFingers();
  this.turnadoWander();
};

Script.prototype.holdFinger = function (division) {
  var numToHold = 1 + Math.floor(Math.random() * 3);
  for (var i = 0; i < numToHold; i++) {
    var note = 36 + Math.floor(Math.random() * 70);
    this.fingersHeld.push({
      note: note,
      stopAt: this.tick + division
    });
    this.output.send({
      type: 'noteon',
      channel: 15,
      note: note,
      velocity: 127
    });
  }
};

Script.prototype.unholdFingers = function () {
  var toRemove = [];
  for (var i = 0; i < this.fingersHeld.length; i++) {
    var held = this.fingersHeld[i];
    if (held.stopAt == this.tick) {
      toRemove.push(held);
    }
  }

  for (var i = 0; i < toRemove.length; i++) {
    var held = toRemove[i];
    this.fingersHeld = _.without(this.fingersHeld, held);
    this.output.send({
      type: 'noteoff',
      channel: 15,
      note: held.note,
      velocity: 127
    });
  }
};

Script.prototype.onPosition = function (ev) {
  if (ev.lsb === 0 && ev.msb === 0) {
    this.tick = -1;
  }
};

Script.prototype.turnadoWander = function () {
  for (var i = 0; i < 5; i++) {
    if (this.faderCC[i + 5] == 0) {
      continue;
    }
    if (Math.floor(Math.random() * 10) == 0) {
      if (this.wanderDir[i] == -1) {
        this.wanderDir[i] = 1;
      } else {
        this.wanderDir[i] = -1;
      }
    }
    this.wander[i] += this.wanderDir[i];
    if (this.wander[i] < 0) {
      this.wander[i] = 0;
    }
    if (this.wander[i] > 127) {
      this.wander[i] = 127;
    }
    if (this.wander[i] == 0) {
      this.wanderDir[i] = 1;
    }
    if (this.wander[i] == 127) {
      this.wanderDir[i] = -1;
    }
    this.output.send({
      type: 'cc',
      controller: i,
      channel: 13,
      value: this.wander[i]
    });
  }
};
