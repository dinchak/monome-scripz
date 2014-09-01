var Pager = function (device) {
  this.device = device;
  this.scripts = [];
  this.ledState = [];

  if (device.type == 'grid') {
    this.setupGrid();
  }

  if (device.type == 'arc') {
    this.setupArc();
  }

};

Pager.prototype.setupGrid = function () {
  var pager = this;
  var device = this.device;

  var protoSet = device.set;
  device.set = function (scriptNum, data) {
    var state = pager.ledState[scriptNum];
    if (typeof data == 'number') {
      data = {
        x: arguments[1],
        y: arguments[2],
        s: arguments[3]
      };
    }
    state[data.y][data.x] = data.s;
    protoSet.call(device, data);
  };

  var protoAll = device.all;
  device.all = function (scriptNum, s) {
    var state = pager.ledState[scriptNum];
    for (var y = 0; y < this.sizeY; y++) {
      for (var x = 0; x < this.sizeX; x++) {
        state[y][x] = s;
      }
    }
    protoAll.call(device, s);
  };

  var protoMap = device.map;
  device.map = function (scriptNum, xOffset, yOffset, arr) {
    var state = pager.ledState[scriptNum];
    for (var y = 0; y < 8; y++) {
      if (typeof arr[y] == 'number') {
        for (var x = 0; x < 8; x++) {
          state[y][x] = arr[y] & Math.pow(2, x);
        }
      } else {
        for (var x = 0; x < 8; x++) {
          state[y][x] = arr[y][x];
        }
      }
    }
    protoMap.call(device, xOffset, yOffset, arr);
  };

  var protoRow = device.row;
  device.row = function (scriptNum, xOffset, y, s) {
    var state = pager.ledState[scriptNum];
    for (var x = xOffset; x < xOffset + 8; x++) {
      state[y][x] = s & Math.pow(2, x);
    }
    protoRow.call(device, xOffset, y, s);
  };

  var protoCol = device.col;
  device.col = function (scriptNum, x, yOffset, s) {
    var state = pager.ledState[scriptNum];
    for (var y = yOffset; y < yOffset + 8; y++) {
      state[y][x] = s & Math.pow(2, y);
    }
    protoCol.call(device, x, yOffset, s);
  };
};

Pager.prototype.setupArc = function () {
  var pager = this;
  var device = this.device;

  var protoSet = device.set;
  device.set = function (scriptNum, data) {
    var state = pager.ledState[scriptNum];
    if (typeof data == 'number') {
      data = {
        n: arguments[1],
        x: arguments[2],
        l: arguments[3]
      };
    }
    state[data.n][data.x] = data.l;
    protoSet.call(device, data);
  };

  var protoAll = device.all;
  device.all = function (scriptNum, n, l) {
    var state = pager.ledState[scriptNum];
    for (var x = 0; x < 64; x++) {
      state[n] = l;
    }
    protoAll.call(device, n, l);
  };

  var protoMap = device.map;
  device.map = function (scriptNum, n, levels) {
    var state = pager.ledState[scriptNum];
    for (var x = 0; x < 64; x++) {
      state[n] = levels[x];
    }
    protoMap.call(device, n, levels);
  };

  var protoRange = device.range;
  device.range = function (scriptNum, n, x1, x2, l) {
    var state = pager.ledState[scriptNum];
    for (var x = x1; x < x2; x++) {
      state[n][x] = l;
    }
    protoRange.call(device, n, x1, x2, l);
  };

};

Pager.prototype.createGridLedState = function () {
  var ledState = [];
  for (var y = 0; y < this.device.sizeY; y++) {
    ledState[y] = [];
    for (var x = 0; x < this.device.sizeX; x++) {
      ledState[y][x] = -1;
    }
  }
  return ledState;
};

Pager.prototype.createArcLedState = function () {
  var ledState = [];
  for (var n = 0; n < this.device.encoders; n++) {
    ledState[n] = [];
  }
  return ledState;
};

module.exports = Pager;
