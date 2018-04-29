const _ = require('underscore')
const midi = require('easymidi')

const GridScript = require('../lib/grid-script')
const PatternRecorder = require('../lib/pattern-recorder')
const liveosc = require('../lib/liveosc')

module.exports = class DrumRack2 extends GridScript{
  init() {
    this.output = new midi.Output(this.config.midiout, true)
    this.input = new midi.Input(this.config.midiin, true)
    this.patternRecorders = []
    this.tinyBuffer = []
    this.shorterBuffer = []
    this.shortBuffer = []
    this.longBuffer = []
    this.tinyBufferPosition = -1
    this.shorterBufferPosition = -1
    this.shortBufferPosition = -1
    this.longBufferPosition = -1
    this.tinyLength = 48
    this.shorterLength = 96
    this.shortLength = 192
    this.longLength = 384
    this.snapshotId = 0
    this.skipNextRelease = false
    this.duplicateFrom = false

    _.each(_.range(15), (i) => {
      this.patternRecorders[i] = []
      this.set(i, 2, 1)
      _.each(_.range(15), (j) => {
        this.patternRecorders[i][j] = new PatternRecorder()
        this.patternRecorders[i][j].on('recordedEvent', (type, ev) => {
          if (i != this.snapshotId) {
            return
          }
          if (ev.s == 1) {
            this.flashLed(i, 0, this.patternRecorders[i][j].recording)
          }
          if (type == 'key') {
            this.key(ev, {skipRecord: true})
          }
        })
      })
      this.patternRecorders[i][0].length = this.tinyLength
      this.patternRecorders[i][1].length = this.shorterLength
      this.patternRecorders[i][2].length = this.shorterLength
      this.patternRecorders[i][3].length = this.shorterLength
      this.patternRecorders[i][4].length = this.shorterLength
      this.patternRecorders[i][5].length = this.shorterLength
      this.patternRecorders[i][6].length = this.shorterLength
      this.patternRecorders[i][7].length = this.shorterLength
      this.patternRecorders[i][8].length = this.shortLength
      this.patternRecorders[i][9].length = this.shortLength
      this.patternRecorders[i][10].length = this.shortLength
      this.patternRecorders[i][11].length = this.shortLength
      this.patternRecorders[i][12].length = this.shortLength
      this.patternRecorders[i][13].length = this.shortLength
      this.patternRecorders[i][14].length = this.longLength
    })

    this.input.on('noteon', (data) => {
      let press = this.noteToLed(data)
      if (press) {
        this.set(press.x, press.y, 1)
      }
    })

    this.input.on('noteoff', (data) => {
      let press = this.noteToLed(data)
      if (press) {
        this.set(press.x, press.y, 0)
      }
    })

    this.input.on('clock', () => {
      this.tinyBufferPosition++
      this.shorterBufferPosition++
      this.shortBufferPosition++
      this.longBufferPosition++
      if (this.tinyBufferPosition == this.tinyLength) {
        this.tinyBufferPosition = 0
      }
      if (this.shorterBufferPosition == this.shorterLength) {
        this.shorterBufferPosition = 0
      }
      if (this.shortBufferPosition == this.shortLength) {
        this.shortBufferPosition = 0
      }
      if (this.longBufferPosition == this.longLength) {
        this.longBufferPosition = 0
      }
      this.tinyBuffer[this.tinyBufferPosition] = []
      this.shorterBuffer[this.shorterBufferPosition] = []
      this.shortBuffer[this.shortBufferPosition] = []
      this.longBuffer[this.longBufferPosition] = []
      _.each(this.patternRecorders, (arrays, i) => {
        _.each(this.patternRecorders[i], (patrec) => {
          patrec.tick()
        })
      })
    })

    this.input.on('position', (ev) => {
      if (ev.lsb === 0 && ev.msb === 0) {
        _.each(this.patternRecorders, (arrays, i) => {
          _.each(this.patternRecorders[i], (patrec) => {
            patrec.reset()
          })
        })
      }
      this.tinyBufferPosition = -1
      this.shorterBufferPosition = -1
      this.shortBufferPosition = -1
      this.longBufferPosition = -1
    })

    this.set(this.device.sizeX - 1, 0, 1)
    this.set(this.device.sizeX - 1, 1, 0)
    this.set(this.device.sizeX - 1, 2, 0)
    this.set(this.snapshotId, 7, 1)
  }

  end() {
    this.input.close()
    this.output.close()
  }

  key(press, opts) {
    opts = opts || {}

    let patternRecording = false
    _.each(this.patternRecorders[this.snapshotId], (patrec) => {
      if (patrec.recording) {
        patternRecording = true
      }
    })

    if (press.x == this.device.sizeX - 1 && press.y < 3 && press.s == 1) {
      this.pager.change(press.y)
      return
    }

    if (press.y === 0) {
      if (press.s == 1) {
        if (this.patternRecorders[this.snapshotId][press.x].hasNotes) {
          return
        }
        this.set(press.x, 1, 1)
        this.set(press.x, 2, 1)
        if (press.x <= 1) {
          this.patternRecorders[this.snapshotId][press.x].queue = _.clone(this.tinyBuffer)
          this.patternRecorders[this.snapshotId][press.x].position = this.tinyBufferPosition
        } else if (press.x <= 7) {
          this.patternRecorders[this.snapshotId][press.x].queue = _.clone(this.shorterBuffer)
          this.patternRecorders[this.snapshotId][press.x].position = this.shorterBufferPosition
        } else if (press.x <= 13) {
          this.patternRecorders[this.snapshotId][press.x].queue = _.clone(this.shortBuffer)
          this.patternRecorders[this.snapshotId][press.x].position = this.shortBufferPosition
        } else {
          this.patternRecorders[this.snapshotId][press.x].queue = _.clone(this.longBuffer)
          this.patternRecorders[this.snapshotId][press.x].position = this.longBufferPosition
        }
        this.patternRecorders[this.snapshotId][press.x].hasNotes = true
      }
    }

    else if (press.y == 1) {
      if (press.s == 1) {
        this.patternRecorders[this.snapshotId][press.x].clear()
        this.patternRecorders[this.snapshotId][press.x].recording = 0
        this.patternRecorders[this.snapshotId][press.x].muted = 0
        this.set(press.x, 0, 0)
        this.set(press.x, 1, 0)
        this.set(press.x, 2, 1)
      }
    }

    else if (press.y == 2) {
      if (press.s == 1) {
        if (this.patternRecorders[this.snapshotId][press.x].muted) {
          this.patternRecorders[this.snapshotId][press.x].muted = 0
          this.set(press.x, 2, 1)
        } else {
          this.patternRecorders[this.snapshotId][press.x].muted = 1
          this.set(press.x, 2, 0)
        }
      }
    }

    else if (press.y >= 3 && press.y != 7) {
      this.playNote(press)
      _.each(this.patternRecorders[this.snapshotId], (patrec, i) => {
        if (patrec.recording) {
          if (patrec.hasNotes) {
            this.set(i, 1, 1)
          }
          if (!opts.skipRecord) {
            patrec.recordEvent('key', press)
          }
        }
      })
      if (!patternRecording && !opts.skipRecord) {
        this.addToBuffers(press)
      }
    }

    else if (press.y == 7 && press.s == 1) {
      if (this.duplicateFrom !== false) {
        return
      }
      this.duplicateFrom = press.x
    }

    else if (press.y == 7 && press.s == 0) {
      if (this.skipNextRelease) {
        this.skipNextRelease = false
        return
      }
      if (press.x === this.duplicateFrom) {
        this.duplicateFrom = false
      }
      if (this.duplicateFrom !== false) {
        console.log(`duplicate ${this.duplicateFrom} to ${press.x}`)
        this.duplicatePatterns(this.duplicateFrom, press.x)
        this.duplicateFrom = false
        this.skipNextRelease = true
      }
      this.snapshotId = press.x
      this.redraw()
    }
  }

  duplicatePatterns(from, to) {
    for (let x = 0; x < 15; x++) {
      this.patternRecorders[to][x].queue = _.clone(this.patternRecorders[from][x].queue)
      this.patternRecorders[to][x].playing = this.patternRecorders[from][x].playing
      this.patternRecorders[to][x].hasNotes = this.patternRecorders[from][x].hasNotes
      this.patternRecorders[to][x].muted = this.patternRecorders[from][x].muted
      this.patternRecorders[to][x].pressedKeys = _.clone(this.patternRecorders[from][x].pressedKeys)
    }
  }

  redraw() {
    for (let x = 0; x < 15; x++) {
      this.set(x, 0, 0)
      this.set(x, 1, this.patternRecorders[this.snapshotId][x].hasNotes ? 1 : 0)
      this.set(x, 2, this.patternRecorders[this.snapshotId][x].muted ? 0 : 1)
      this.set(x, 3, 0)
      this.set(x, 4, 0)
      this.set(x, 5, 0)
      this.set(x, 6, 0)
      this.set(x, 7, x == this.snapshotId ? 1 : 0)
    }
  }

  addToBuffers(press) {
    if (
      this.tinyBufferPosition == -1 ||
      this.shorterBufferPosition == -1 ||
      this.shortBufferPosition == -1 ||
      this.longBufferPosition == -1
    ) {
      return
    }

    if (!this.tinyBuffer[this.tinyBufferPosition]) {
      this.tinyBuffer[this.tinyBufferPosition] = []
    }
    if (!this.shorterBuffer[this.shorterBufferPosition]) {
      this.shorterBuffer[this.shorterBufferPosition] = []
    }
    if (!this.shortBuffer[this.shortBufferPosition]) {
      this.shortBuffer[this.shortBufferPosition] = []
    }
    if (!this.longBuffer[this.longBufferPosition]) {
      this.longBuffer[this.longBufferPosition] = []
    }

    if (!_.findWhere(this.tinyBuffer[this.tinyBufferPosition], {type: 'key', event: press})) {
      this.tinyBuffer[this.tinyBufferPosition].push({
        type: 'key',
        event: press
      })
    }
    if (!_.findWhere(this.shorterBuffer[this.shorterBufferPosition], {type: 'key', event: press})) {
      this.shorterBuffer[this.shorterBufferPosition].push({
        type: 'key',
        event: press
      })
    }
    if (!_.findWhere(this.shortBuffer[this.shortBufferPosition], {type: 'key', event: press})) {
      this.shortBuffer[this.shortBufferPosition].push({
        type: 'key',
        event: press
      })
    }
    if (!_.findWhere(this.longBuffer[this.longBufferPosition], {type: 'key', event: press})) {
      this.longBuffer[this.longBufferPosition].push({
        type: 'key',
        event: press
      })
    }
  }

  noteToLed(note) {
    let y = note.channel + 3
    let x = (note.note - 36)
    return {x:x, y:y}
  }

  flashLed(x, y, state) {
    if (state == 1) {
      this.set(x, y, 0)
      setTimeout(() => {
        this.set(x, y, 1)
      }, 20)
    } else {
      this.set(x, y, 1)
      setTimeout(() => {
        this.set(x, y, 0)
      }, 20)
    }
  }

  playNote(press) {
    let note = press.x + 36
    let channel = press.y - 3
    let type
    let velocity
    if (press.s == 1) {
      type = 'noteon'
      velocity = 127
    } else {
      type = 'noteoff'
      velocity = 0
    }
    this.output.send(type, {
      channel: channel,
      note: note,
      velocity: velocity
    })
  }
}
