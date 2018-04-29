const _ = require('underscore')
const LiveOSC = require('liveosc')

let liveosc = new LiveOSC({debug: false})

exports.song = () => {
  return liveosc.song
}

exports.track = (id) => {
  let props = {id: id}

  if (typeof id == 'string') {
    props = {name: id}
  }

  return _.findWhere(liveosc.song.tracks, props)
}

exports.clip = (id, trackId) => {
  let props = {id: id}

  if (typeof id == 'string') {
    props = {name: id}
  }

  if (!liveosc.song.tracks[trackId]) {
    return undefined
  }

  return _.findWhere(liveosc.song.tracks[trackId].clips, props)
}

exports.return = (id) => {
  let props = {id: id}

  if (typeof id == 'string') {
    props = {name: id}
  }

  return _.findWhere(liveosc.song.returns, props)
}

exports.device = (id, type, trackId) => {
  let props = {id: id}

  if (typeof id == 'string') {
    props = {name: id}
  }

  let devices = null

  if (type == 'master') {
    devices = liveosc.song.devices
  }

  if (type == 'return' && liveosc.song.returns[trackId]) {
    devices = liveosc.song.returns[trackId].devices
  }

  if (type == 'track' && liveosc.song.tracks[trackId]) {
    devices = liveosc.song.tracks[trackId].devices
  }
  
  if (devices) {
    return _.findWhere(devices, props)
  } else {
    return undefined
  }
}
