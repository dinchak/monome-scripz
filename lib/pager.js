var Pager = module.exports = function (device) {
  this.device = device;
  this.scripts = [];
  this.ledStates = [];
  this.activeScriptId = 0;
  if (device.type == 'grid') {
    this.initGridEvents();
  }
  if (device.type == 'arc') {
    this.initArcEvents();
  }
};

Pager.prototype.addScript = function (script) {
  var scriptId = this.scripts.length;
  var ledState;
  if (this.device.type == 'grid') {
    ledState = this.createGridLedState();
    this.initGridScript(scriptId, script, ledState);
  }
  if (this.device.type == 'arc') {
    ledState = this.createArcLedState();
    this.initArcScript(scriptId, script, ledState);
  }
  script.ledState = ledState;
  this.scripts.push(script);
  this.ledStates.push(ledState);
};

Pager.prototype.change = function (scriptId) {
  this.activeScriptId = scriptId;
  if (this.device.type == 'grid') {
    this.redrawGridLedState();
  }
  if (this.device.type == 'arc') {
    this.redrawArcLedState();
  }
};

Pager.prototype.redrawGridLedState = function () {
  var script = this.scripts[this.activeScriptId];
  var ledState = this.ledStates[this.activeScriptId];
  script.mapAll(ledState);
};

Pager.prototype.redrawArcLedState = function () {
  var ledState = this.ledStates[this.activeScriptId];
  for (var n = 0; n < this.device.encoders; n++) {
    var s = [];
    for (var l = 0; l < 64; l++) {
      s[l] = ledState[n][l];
    }
    this.device.map(n, s);
  }
};

Pager.prototype.initGridEvents = function () {
  var pager = this;

  this.device.on('key', function (data) {
    var activeScript = pager.scripts[pager.activeScriptId];
    if (typeof activeScript.key == 'function') {
      activeScript.key(data);
    }
  });
  this.device.on('tilt', function (data) {
    var activeScript = pager.scripts[pager.activeScriptId];
    if (typeof activeScript.tilt == 'function') {
      activeScript.tilt(data);
    }
  });
};

Pager.prototype.initGridScript = function (scriptId, script, ledState) {
  var pager = this;

  script.set = function (data) {
    if (typeof data == 'number') {
      data = {
        x: arguments[0],
        y: arguments[1],
        s: arguments[2]
      };
    }
    if (data.y < 0 || data.y >= pager.device.sizeY) {
      console.trace('out of range data: y=' + data.y);
      return;
    }
    if (data.x < 0 || data.x >= pager.device.sizeX) {
      console.trace('out of range data: x=' + data.x);
      return;
    }
    ledState[data.y][data.x] = data.s;
    if (pager.activeScriptId == scriptId) {
      pager.device.set(data);
    }
  };

  script.all = function (s) {
    for (var y = 0; y < pager.device.sizeY; y++) {
      for (var x = 0; x < pager.device.sizeX; x++) {
        ledState[y][x] = s;
      }
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.all(s);
    }
  };

  script.map = function (xOffset, yOffset, arr) {
    for (var y = 0; y < 8; y++) {
      if (typeof arr[y] == 'number') {
        for (var x = 0; x < 8; x++) {
          ledState[y][x] = arr[y] & Math.pow(2, x);
        }
      } else {
        for (var x = 0; x < 8; x++) {
          ledState[y][x] = arr[y][x];
        }
      }
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.map(xOffset, yOffset, arr);
    }
  };

  script.mapAll = function (arr) {
    var s = {};
    var xOffset = 0;
    var yOffset = 0;
    for (var y = 0; y < arr.length; y++) {
      if (y % 8 == 0) {
        yOffset = y;
      }
      if (!s[yOffset]) {
        s[yOffset] = {};
      }
      var yy = y % 8;
      for (var x = 0; x < arr[y].length; x++) {
        if (x % 8 == 0) {
          xOffset = x;
        }
        if (!s[yOffset][xOffset]) {
          s[yOffset][xOffset] = [];
        }
        if (!s[yOffset][xOffset][yy]) {
          s[yOffset][xOffset][yy] = [];
        }
        var xx = x % 8;
        s[yOffset][xOffset][yy][xx] = arr[y][x];
        ledState[y][x] = arr[y][x];
        if ((y + 1) % 8 == 0 && (x + 1) % 8 == 0) {
          if (pager.activeScriptId == scriptId) {
            pager.device.map(xOffset, yOffset, s[yOffset][xOffset]);
          }
        }
      }
    }
  };

  script.row = function (xOffset, y, s) {
    for (var x = xOffset; x < xOffset + 8; x++) {
      ledState[y][x] = s & Math.pow(2, x);
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.row(xOffset, y, s);
    }
  };

  script.col = function (x, yOffset, s) {
    for (var y = yOffset; y < yOffset + 8; y++) {
      ledState[y][x] = s & Math.pow(2, y);
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.col(x, yOffset, s);
    }
  };
};

Pager.prototype.initArcEvents = function () {
  var pager = this;

  this.device.on('key', function (data) {
    var activeScript = pager.scripts[pager.activeScriptId];
    if (typeof activeScript.key == 'function') {
      activeScript.press(data);
    }
  });
  this.device.on('delta', function (data) {
    var activeScript = pager.scripts[pager.activeScriptId];
    if (typeof activeScript.delta == 'function') {
      activeScript.delta(data);
    }
  })
};

Pager.prototype.initArcScript = function (scriptId, script, ledState) {
  var pager = this;

  script.set = function (data) {
    if (typeof data == 'number') {
      data = {
        n: arguments[0],
        x: arguments[1],
        l: arguments[2]
      }
    }
    ledState[data.n][data.x] = data.l;
    if (pager.activeScriptId == scriptId) {
      pager.device.set(data);
    }
  };

  script.all = function (n, l) {
    for (var x = 0; x < 64; x++) {
      ledState[n] = l;
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.all(n, l);
    }
  };

  script.map = function (n, levels) {
    for (var x = 0; x < 64; x++) {
      ledState[n] = levels[x];
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.map(n, levels);
    }
  };

  script.range = function (n, x1, x2, l) {
    for (var x = x1; x < x2; x++) {
      ledState[n][x] = l;
    }
    if (pager.activeScriptId == scriptId) {
      pager.device.range(n, x1, x2, l);
    }
  };
};

Pager.prototype.createGridLedState = function () {
  var ledState = [];
  for (var y = 0; y < this.device.sizeY; y++) {
    ledState[y] = [];
    for (var x = 0; x < this.device.sizeX; x++) {
      ledState[y][x] = 0;
    }
  }
  return ledState;
};

Pager.prototype.createArcLedState = function () {
  var ledState = [];
  for (var n = 0; n < this.device.encoders; n++) {
    ledState[n] = [];
    for (var l = 0; l < 64; l++) {
      ledState[n][l] = 0;
    }
  }
  return ledState;
};