module.exports = class GridScript {
  set(data) {
    if (typeof data == 'number') {
      data = {
        x: arguments[0],
        y: arguments[1],
        s: arguments[2]
      }
    }

    if (data.y < 0 || data.y >= this.pager.device.sizeY) {
      console.trace('out of range data: y=' + data.y)
      return
    }

    if (data.x < 0 || data.x >= this.pager.device.sizeX) {
      console.trace('out of range data: x=' + data.x)
      return
    }

    this.ledState[data.y][data.x] = data.s
    
    if (this.pager.activeScriptId == this.scriptId) {
      this.pager.device.set(data)
    }
  }
  
  all(s) {
    for (let y = 0; y < pager.device.sizeY; y++) {
      for (let x = 0; x < pager.device.sizeX; x++) {
        this.ledState[y][x] = s
      }
    }

    if (pager.activeScriptId == scriptId) {
      this.pager.device.all(s)
    }
  }
  
  map(xOffset, yOffset, arr) {
    for (let y = 0; y < 8; y++) {
      if (typeof arr[y] == 'number') {
        for (let x = 0; x < 8; x++) {
          this.ledState[y][x] = arr[y] & Math.pow(2, x)
        }
      } else {
        for (let x = 0; x < 8; x++) {
          this.ledState[y][x] = arr[y][x]
        }
      }
    }

    if (pager.activeScriptId == scriptId) {
      this.pager.device.map(xOffset, yOffset, arr)
    }
  }
  
  mapAll(arr) {
    let s = {}
    let xOffset = 0
    let yOffset = 0

    for (let y = 0; y < arr.length; y++) {
      if (y % 8 == 0) {
        yOffset = y
      }

      if (!s[yOffset]) {
        s[yOffset] = {}
      }

      let yy = y % 8
      
      for (let x = 0; x < arr[y].length; x++) {
        if (x % 8 == 0) {
          xOffset = x
        }
        
        if (!s[yOffset][xOffset]) {
          s[yOffset][xOffset] = []
        }

        if (!s[yOffset][xOffset][yy]) {
          s[yOffset][xOffset][yy] = []
        }
        
        let xx = x % 8
        
        s[yOffset][xOffset][yy][xx] = arr[y][x]
        this.ledState[y][x] = arr[y][x]

        if ((y + 1) % 8 == 0 && (x + 1) % 8 == 0) {
          if (this.pager.activeScriptId == this.scriptId) {
            this.pager.device.map(xOffset, yOffset, s[yOffset][xOffset])
          }
        }
      }
    }
  }
  
  row(xOffset, y, s) {
    for (let x = xOffset; x < xOffset + 8; x++) {
      this.ledState[y][x] = s & Math.pow(2, x)
    }

    if (pager.activeScriptId == scriptId) {
      this.pager.device.row(xOffset, y, s)
    }
  }
  
  col(x, yOffset, s) {
    for (let y = yOffset; y < yOffset + 8; y++) {
      this.ledState[y][x] = s & Math.pow(2, y)
    }

    if (pager.activeScriptId == scriptId) {
      this.pager.device.col(x, yOffset, s)
    }
  }  
  
}