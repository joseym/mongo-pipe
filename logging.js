const chalk = require('chalk');
const path = require('path');

let warn = chalk.bold.red;
let info = chalk.bold.blue;
let debug = chalk.bold.green;
let blue = chalk.blue;

function log(...args){
  let rel_path = path.relative(process.cwd(), __called_filename);
  if(DEBUG) args.push(blue(`[ ${rel_path}:${__linenumber} ]`));
  console.log.apply(console, args);
}

log.warn = function(...args){
  args.unshift(warn('WARNING:'));
  LOG_LEVEL >= 0 && log.apply(log, args);
};

log.info = function(...args){
  args.unshift(info('INFO:'));
  LOG_LEVEL >= 1 && log.apply(log, args);
};

log.debug = function(...args){
  args.unshift(debug('DEBUG:'));
  LOG_LEVEL >= 2 && log.apply(log, args);
};

log.announce = function(...args){
  args.unshift(info('MESSAGE:'));
  console.log.apply(console, args);
}

module.exports = log
