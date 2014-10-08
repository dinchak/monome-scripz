var midi = require('midi');
var input = new midi.input();

for (var i = 0; i < input.getPortCount(); i++) {
  console.log(input.getPortName(i));
}
