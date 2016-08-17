try {
  require('dotenv').config({ silent: true, path: require('path').join(__dirname, './.env' ) });
} catch (e) {}

require('./_utils');
const argv = require('yargs').argv;

global.LOG_LEVEL = argv.verbose || parseInt(process.env.LOG_LEVEL);
global.DEBUG = argv.debug || parseBoolean(process.env.DEBUG);
global.log = require('./logging.js');

module.exports = {
  export: require('./dump'),
  import: require('./restore')
};

// series([
//   // connect
//   (callback) => {
//     return connect(url, callback);
//   },
//   (callback) => {
//     return connect.addConnection(local, 'local', callback);
//   },
//   (callback) => {
//     return connect.addConnection(staging, 'staging', callback);
//   }
// ], (err, results) => {
//
//   let backup = new (require('./dump'))('rezflow');
//   backup.on('end', function(){
//     console.log('done writing');
//   });
//   // s3.upload({ Body: backup.pipe(zlib.createGzip()) })
//   //   .send(function(err, data) { process.exit(0) });
//
//   let load = new (require('./restore'))('staging');
//   load.on('data', function(data){
//     console.log(data.data._id)
//   });
//   load.on('end', function(){
//     process.exit(0);
//   });
//
// });
