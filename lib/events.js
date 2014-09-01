var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();

exports.on = function (ev, cb) {
  emitter.on(ev, cb);
};

exports.off = function (ev, cb) {
  emitter.removeListener(ev, cb);
};

exports.emit = function (ev, data) {
  emitter.emit(ev, data);
};
