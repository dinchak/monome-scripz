var fs = require('fs');
var _ = require('underscore');
var chalk = require('chalk');
var argv = require('minimist')(process.argv.slice(2));

var Pager = require('./lib/pager');
var SerialOSC = require('../node-serialosc/index');
var serialosc = new SerialOSC();

var config = {};

if (argv._[0]) {
  var configFile = __dirname + '/' + argv._[0];
  try {
    config = JSON.parse(fs.readFileSync(configFile));
  } catch (err) {
    console.log(chalk.red.bold('Error parsing config file'));
    console.log(err);
    process.exit();
  }
}

console.log(
  chalk.cyan('-') +
  chalk.cyan.bold('*') +
  chalk.cyan('-') +
  chalk.white.bold(' scripz ') +
  chalk.cyan('-') +
  chalk.cyan.bold('*') +
  chalk.cyan('-')
);

var devices = [];
serialosc.on('device:add', function (device) {
  console.log('found ' + chalk.magenta.bold(device.id) + ' (' + chalk.magenta(device.type) + ') @ ' + chalk.green(device.host) + ':' + chalk.green.bold(device.port));
  if (config[device.id]) {
    if (config[device.id].hasOwnProperty('rotation')) {
      device.setRotation(config[device.id].rotation);
    }
    device.all(0);

    var pager = new Pager(device);
    devices.push(pager);
    _.each(config[device.id].scripts, function (script, scriptNum) {
      var scriptDevice = _.extend(_.clone(device), {
        set: function () {
          var args = Array.prototype.slice.call(arguments, 0);
          args.unshift(scriptNum);
          device.set.apply(device, args);
        },
        all: function () {
          var args = Array.prototype.slice.call(arguments, 0);
          args.unshift(scriptNum);
          device.all.apply(device, args);
        },
        map: function () {
          var args = Array.prototype.slice.call(arguments, 0);
          args.unshift(scriptNum);
          device.map.apply(device, args);
        },
        row: function () {
          var args = Array.prototype.slice.call(arguments, 0);
          args.unshift(scriptNum);
          device.row.apply(device, args);
        },
        col: function () {
          var args = Array.prototype.slice.call(arguments, 0);
          args.unshift(scriptNum);
          device.row.apply(device, args);
        }
      });
      var ledState = pager.createLedState();
      pager.ledState.push(ledState);
      var Script = require('./scripts/' + script.script);
      var scrip = new Script(scriptDevice, script.config, ledState);
      pager.scripts.push(scrip);
    });
  }
});
serialosc.start();
