var midi = require('./lib/midi');
var input = new midi.Input('IAC Driver Clock');

input.on('noteon', function (data) {
  console.log(data);
});

