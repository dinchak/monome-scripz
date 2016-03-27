var _ = require('underscore');
var LiveOSC = require('liveosc');
var liveosc = new LiveOSC({debug:false});

exports.song = function () {
  return liveosc.song;
};

exports.track = function (id) {
  var props = {id: id};
  if (typeof id == 'string') {
    props = {name: id};
  }
  return _.findWhere(liveosc.song.tracks, props);
};

exports.clip = function (id, trackId) {
  var props = {id: id};
  if (typeof id == 'string') {
    props = {name: id};
  }
  if (!liveosc.song.tracks[trackId]) {
    return undefined;
  }
  return _.findWhere(liveosc.song.tracks[trackId].clips, props);
};

exports.return = function (id) {
  var props = {id: id};
  if (typeof id == 'string') {
    props = {name: id};
  }
  return _.findWhere(liveosc.song.returns, props);
};

exports.device = function (id, type, trackId) {
  var props = {id: id};
  if (typeof id == 'string') {
    props = {name: id};
  }
  var devices = null;
  if (type == 'master') {
    devices = liveosc.song.devices;
  }
  if (type == 'return' && liveosc.song.returns[trackId]) {
    devices = liveosc.song.returns[trackId].devices;
  }
  if (type == 'track' && liveosc.song.tracks[trackId]) {
    devices = liveosc.song.tracks[trackId].devices;
  }
  if (devices) {
    return _.findWhere(devices, props);
  } else {
    return undefined;
  }
};
