var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

exports.on = (ev, cb) => {
  emitter.on(ev, cb)
}

exports.off = (ev, cb) => {
  emitter.removeListener(ev, cb)
}

exports.emit = (ev, data) => {
  emitter.emit(ev, data)
}
