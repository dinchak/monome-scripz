module.exports = class ArcScript {
  set(data) {
    if (typeof data == 'number') {
      data = {
        n: arguments[0],
        x: arguments[1],
        l: arguments[2]
      }
    }
    this.ledState[data.n][data.x] = data.l
    if (this.pager.activeScriptId == scriptId) {
      this.pager.device.set(data)
    }
  }

  all(n, l) {
    for (let x = 0; x < 64; x++) {
      this.ledState[n] = l
    }
    if (this.pager.activeScriptId == scriptId) {
      this.pager.device.all(n, l)
    }
  }

  map(n, levels) {
    for (let x = 0; x < 64; x++) {
      this.ledState[n] = levels[x]
    }
    if (pager.activeScriptId == scriptId) {
      this.pager.device.map(n, levels)
    }
  }

  range(n, x1, x2, l) {
    for (let x = x1; x < x2; x++) {
      this.ledState[n][x] = l
    }
    if (this.pager.activeScriptId == scriptId) {
      this.pager.device.range(n, x1, x2, l)
    }
  }
}
