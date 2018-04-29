const fs = require('fs');

const _ = require('underscore');
const chalk = require('chalk');
const program = require('commander')
const serialosc = require('serialosc');

const Pager = require('./lib/pager');

let config = {};
let pagers = []

program
  .version('1.0.0')
  .option('-c, --config <file>', 'JSON config file')
  .parse(process.argv)

if (!program.config) {
  program.outputHelp()
  process.exit()
}

start()

process.on('SIGINT', () => {
  console.log('shutting down...')
  for (let pager of pagers) {
    pager.clear()
    pager.end()
  }
  setTimeout(() => {
    process.exit()
  }, 20)
})

function start() {
  try {
    let configFile = __dirname + '/' + program.config;
    config = JSON.parse(fs.readFileSync(configFile));
    intro()
    init()
  } catch (err) {
    console.log(chalk.red.bold('Error parsing config file'));
    console.log(err.stack)
    process.exit();
  }
}

function intro() {
  console.log(
    chalk.cyan('-') + chalk.cyan.bold('*') + chalk.cyan('-') +
    chalk.white.bold(' scripz ') +
    chalk.cyan('-') + chalk.cyan.bold('*') + chalk.cyan('-')
  )
}

function deviceName(device) {
  return chalk.magenta.bold(device.id) +
    ' (' + chalk.magenta(device.type) + 
    ') @ '+ chalk.green(device.host) + 
    ':' + chalk.green.bold(device.port)
}

function init() {
  serialosc.on('device:add', (device) => {
    console.log('found ' + deviceName(device))
    
    if (config[device.id]) {
      if (config[device.id].hasOwnProperty('rotation')) {
        device.setRotation(config[device.id].rotation)
      }

      let pager = new Pager(device)
      pager.clear()
      
      pagers.push(pager)
      
      _.each(config[device.id].scripts, (scriptConfig, scriptId) => {
        let Script = require('./scripts/' + scriptConfig.script);
        let script = new Script();
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
}