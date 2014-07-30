var midi = require('../lib/midi');

var Script = function (device, config) {
  console.log(config);
  var output = new midi.Output('scripz triggers', true);
  device.on('key', function (press) {
    console.log(device.ledState);
    var note = (press.y * device.sizeX) + press.x;
    var type;
    var velocity;
    if (press.s == 1) {
      type = 'noteon';
      velocity = 127;
    } else {
      type = 'noteoff';
      velocity = 64;
    }
    output.send({
      type: type,
      channel: 0,
      note: note,
      velocity: velocity
    });
    device.set(press);
  });
};

module.exports = Script;
