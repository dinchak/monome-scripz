module.exports = class Pager {
  constructor(device) {
    this.device = device
    this.scripts = []
    this.ledStates = []
    this.activeScriptId = 0
    if (device.type == 'grid') {
      this.initGridEvents()
    }
    if (device.type == 'arc') {
      this.initArcEvents()
    }  
  }

  end() {
    for (let script of this.scripts) {
      if (typeof script.end == 'function') {
        script.end()
      }
    }
  }

  clear() {
    if (this.device.type == 'grid') {
      this.device.all(0)
    }
    if (this.device.type == 'arc') {
      for (var i = 0; i < this.device.encoders; i++) {
        this.device.all(i, 0)
      }
    }
  }

  initGridEvents() {
    this.device.on('key', (data) => {
      let activeScript = this.scripts[this.activeScriptId];
      if (typeof activeScript.key == 'function') {
        activeScript.key(data)
      }
    });
    
    this.device.on('tilt', (data) => {
      let activeScript = this.scripts[this.activeScriptId]
      if (typeof activeScript.tilt == 'function') {
        activeScript.tilt(data)
      }
    })  
  }

  initArcEvents() {
    this.device.on('key', (data) => {
      let activeScript = this.scripts[this.activeScriptId]
      if (typeof activeScript.key == 'function') {
        activeScript.key(data)
      }
    });
    this.device.on('delta', function (data) {
      let activeScript = this.scripts[this.activeScriptId];
      if (typeof activeScript.delta == 'function') {
        activeScript.delta(data)
      }
    })
  }

  addScript(script) {
    let ledState
    if (this.device.type == 'grid') {
      ledState = this.createGridLedState();
    }
    if (this.device.type == 'arc') {
      ledState = this.createArcLedState();
    }
    script.pager = this
    script.scriptId = this.scripts.length
    script.ledState = ledState
    this.scripts.push(script)
    this.ledStates.push(ledState)
  }

  change(scriptId) {
    if (!this.scripts[scriptId]) {
      return
    }
    this.activeScriptId = scriptId;
    if (this.device.type == 'grid') {
      this.redrawGridLedState()
    }
    if (this.device.type == 'arc') {
      this.redrawArcLedState()
    }  
  }

  redrawGridLedState() {
    let script = this.scripts[this.activeScriptId]
    let ledState = this.ledStates[this.activeScriptId]
    script.mapAll(ledState)
  }

  redrawArcLedState() {
    let ledState = this.ledStates[this.activeScriptId]
    for (let n = 0; n < this.device.encoders; n++) {
      let s = []
      for (let l = 0; l < 64; l++) {
        s[l] = ledState[n][l]
      }
      this.device.map(n, s)
    }
  }

  createGridLedState() {
    let ledState = []
    for (let y = 0; y < this.device.sizeY; y++) {
      ledState[y] = []
      for (let x = 0; x < this.device.sizeX; x++) {
        ledState[y][x] = 0
      }
    }
    return ledState
  }
  
  createArcLedState() {
    let ledState = []
    for (let n = 0; n < this.device.encoders; n++) {
      ledState[n] = []
      for (let l = 0; l < 64; l++) {
        ledState[n][l] = 0
      }
    }
    return ledState
  }

}
