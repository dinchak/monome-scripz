var midi = require('midi');
var EventEmitter = require('events').EventEmitter;

var Input = function (name, virtual) {
  this._input = new midi.input();
  this._input.ignoreTypes(false, false, false);
  if (virtual) {
    this._input.openVirtualPort(name);
  } else {
    var numInputs = this._input.getPortCount();
    var found = false;
    for (var i = 0; i < numInputs; i++) {
      if (name == this._input.getPortName(i)) {
        found = true;
        this._input.openPort(i);
      }
    }
    if (!found) {
      throw new Error('No MIDI input found with name: ' + name);
    }
  }
  var self = this;
  this._input.on('message', function (deltaTime, bytes) {
    var data = self.parseMessage(bytes);
    self.emit(data.type, data.msg);
  });
};

Input.prototype = Object.create(EventEmitter.prototype);

Input.prototype.parseMessage = function (bytes) {
  var types = {
    0x08: 'noteoff',
    0x09: 'noteon',
    0x0A: 'poly aftertouch',
    0x0B: 'cc',
    0x0C: 'program',
    0x0D: 'channel aftertouch',
    0x0E: 'pitch',
  };
  var extendedTypes = {
    0xF0: 'sysex',
    0xF1: 'mtc',
    0xF2: 'position',
    0xF3: 'select',
    0xF6: 'tune',
    0xF7: 'sysex end',
    0xF8: 'clock',
    0xFA: 'start',
    0xFB: 'continue',
    0xFC: 'stop',
    0xFF: 'reset'
  };
  var type = 'unknown';
  var msg = {};
  if (bytes[0] >= 0xF0) {
    type = extendedTypes[bytes[0]];
  } else {
    type = types[bytes[0] >> 4];
    msg.channel = bytes[0] % 16;
  }
  if (type == 'noteoff' || type == 'noteon') {
    msg.note = bytes[1];
    msg.velocity = bytes[2];
  }
  if (type == 'cc') {
    msg.controller = bytes[1];
    msg.value = bytes[2];
  }
  if (type == 'poly aftertouch') {
    msg.note = bytes[1];
    msg.pressure = bytes[2];
  }
  if (type == 'channel aftertouch') {
    msg.pressure = bytes[1];
  }
  if (type == 'program') {
    msg.number = bytes[1];
  }
  if (type == 'pitch' || type == 'position') {
    msg.lsb = bytes[1];
    msg.msb = bytes[2];
  }
  if (type == 'select') {
    msg.song = bytes[1];
  }
  return {
    type: type,
    msg: msg
  };
};

exports.Input = Input;

var Output = function (name, virtual) {
  this._output = new midi.output();
  if (virtual) {
    this._output.openVirtualPort(name);
  } else {
    var numOutputs = this._output.getPortCount();
    var found = false;
    for (var i = 0; i < numOutputs; i++) {
      if (name == this._output.getPortName(i)) {
        found = true;
        this._output.openPort(i);
      }
    }
    if (!found) {
      throw new Error('No MIDI output found with name: ' + name);
    }
  }
};

Output.prototype.send = function (msg) {
  this._output.sendMessage(this.parseMessage(msg));
};

Output.prototype.parseMessage = function (msg) {
  var types = {
    'noteoff': 0x08,
    'noteon': 0x09,
    'poly aftertouch': 0x0A,
    'cc': 0x0B,
    'program': 0x0C,
    'channel aftertouch': 0x0D,
    'pitch': 0x0E
  };
  var extendedTypes = {
    'sysex': 0xF0,
    'mtc': 0xF1,
    'position': 0xF2,
    'select': 0xF3,
    'tune': 0xF6,
    'sysex end': 0xF7,
    'clock': 0xF8,
    'start': 0xFA,
    'continue': 0xFB,
    'stop': 0xFC,
    'reset': 0xFF
  };

  var bytes = [];
  if (types[msg.type]) {
    bytes.push((types[msg.type] << 4) + msg.channel);
  } else if (extendedTypes[msg.type]) {
    bytes.push(extendedTypes[msg.type]);
  } else {
    throw new Error('Unknown midi message type: ' + msg.type);
  }

  if (msg.type == 'noteoff' || msg.type == 'noteon') {
    bytes.push(msg.note);
    bytes.push(msg.velocity);
  }
  if (msg.type == 'cc') {
    bytes.push(msg.controller);
    bytes.push(msg.value);
  }
  if (msg.type == 'poly aftertouch') {
    bytes.push(msg.note);
    bytes.push(msg.pressure);
  }
  if (msg.type == 'channel aftertouch') {
    bytes.push(msg.pressure);
  }
  if (msg.type == 'program') {
    bytes.push(msg.number);
  }
  if (msg.type == 'pitch' || msg.type == 'position') {
    bytes.push(msg.lsb);
    bytes.push(msg.msb);
  }
  if (msg.type == 'select') {
    bytes.push(msg.song);
  }
  return bytes;
};

exports.Output = Output;
