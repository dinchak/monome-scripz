var Pager = function (device) {
  this.device = device;
  this.scripts = [];
  this.ledState = [];

  var pager = this;

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

Pager.prototype.createLedState = function () {
  var ledState = [];
  for (var y = 0; y < this.device.sizeY; y++) {
    ledState[y] = [];
    for (var x = 0; x < this.device.sizeX; x++) {
      ledState[y][x] = -1;
    }
  }
  return ledState;
};

module.exports = Pager;
