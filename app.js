var fs = require('fs');
var _ = require('underscore');
var chalk = require('chalk');
var argv = require('minimist')(process.argv.slice(2));
var serialosc = require('serialosc');
var Pager = require('./lib/pager');

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

    if (device.type == 'grid') {
      device.all(0);
    }

    if (device.type == 'arc') {
      for (var i = 0; i < device.encoders; i++) {
        device.all(i, 0);
      }
    }

    var pager = new Pager(device);
    devices.push(pager);
    _.each(config[device.id].scripts, function (scriptConfig, scriptId) {
      var Script = require('./scripts/' + scriptConfig.script);
      var script = new Script();
      script.config = scriptConfig.config;
      script.pager = pager;
      script.device = device;
      pager.addScript(script);
      if (typeof script.init == 'function') {
        script.init();
      }
    });
  }
});
serialosc.start();
