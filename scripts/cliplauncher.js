var liveosc = require('../lib/liveosc');

var Script = function (device, config) {
  console.log(config);

  function refreshClipState() {
    var map = [];
    for (var y = 0; y < device.sizeY; y++) {
      map[y] = [];
      for (var x = 0; x < device.sizeX; x++) {
        var clip = liveosc.clip(y, x);
        if (clip) {
          map[y].push(clip.state ? 1 : 0);
        } else {
          map[y].push(0);
        }
      }
    }
    device.map(0, 0, map);
  }

  liveosc.song().on('ready', refreshClipState);
  liveosc.song().on('clip:state', function (data) {
    device.set(data.trackId, data.id, data.value ? 1 : 0);
  });

  device.on('key', function (press) {
    var trackId = press.x;
    var clipId = press.y;
    if (press.s == 1) {
      var clip = liveosc.clip(clipId, trackId);
      if (clip) {
        clip.play();
      }
    }
  });

  refreshClipState();
};

module.exports = Script;
