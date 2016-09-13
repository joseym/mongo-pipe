try {
  require('dotenv').config({ silent: true, path: require('path').join(__dirname, './.env' ) });
} catch (e) {}

require('./_utils');
const argv = require('yargs').argv;

global.LOG_LEVEL = argv.verbose || parseInt(process.env.LOG_LEVEL);
global.DEBUG = argv.debug || parseBoolean(process.env.DEBUG);
global.log = require('./logging.js');

new (require('./restore'))().insert();

module.exports = {
  export: require('./dump'),
  import: require('./restore')
};
