#!/usr/bin/env node
require('dotenv').config({ silent: true, path: require('path').join(__dirname, './../.env' ) });
require('./../_utils');

global.argv = process._yargs = require('yargs')
  .usage('Usage: $0 <cmd> [options]')
  .command('import', 'Import a data file from <source>')
  .command('export', 'Export a data file from <source>')
  .count('verbose').alias('verbose', 'v')
  .option('source', {
    description: 'Location of data source or backup',
    default: 's3',
    alias: 's'
  })
  .option('destination', {
    description: 'Destination of backup file',
    default: 's3',
    alias: 'd'
  })
  .example('import --source s3 --destination staging', 'Restore backup from s3 onto the staging db')
  .boolean('debug')
  .help('help')
  .argv;

global.LOG_LEVEL = argv.verbose || parseInt(process.env.LOG_LEVEL);
global.DEBUG = argv.debug || parseBoolean(process.env.DEBUG);
global.log = require('./../logging.js');

const series = require('async/series');
const connect = require('./../connect');
const moment = require('moment-timezone');
const zlib = require('zlib');

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

let now = moment().tz("America/Los_Angeles");
let date = now.format('YYYY-MM-DD');
let hour = now.format('HH:mm:ss');
let s3;
let s3_params = {
  Bucket: process.env.AWS_S3_BUCKET
};

series([
  // connect
  (callback) => {
    switch (argv.source) {
      case 's3':
        s3_params.Key = `2016-07-19/2016-07-19 14:53:35.db.gz`;
        return callback(null, 's3');
        break;
      case 'production':
        return connect(process.env.PRODUCTION_DB, 'source', callback)
      case 'staging':
        return connect(process.env.LOCAL_DB, 'source', callback)
        // return connect(process.env.STAGING_DB, 'source', callback)
    }
  },
  (callback) => {
    switch (argv.destination) {
      case 's3':
        s3_params.Key = `${date}/${date} ${hour}.db.gz`;
        return callback(null, 's3');
        break;
      case 'production':
        return connect.addConnection(process.env.PRODUCTION_DB, 'destination', callback)
      case 'staging':
        return connect.addConnection(process.env.LOCAL_DB, 'destination', callback)
        // return connect.addConnection(process.env.STAGING_DB, 'destination', callback)
    }
  }
], (err, results) => {

  let s3 = new AWS.S3({ params: s3_params });

  let source = results[0].constructor === String ?
    results[0] : new (require('./../dump'))('source');

  let destination = results[1].constructor === String ?
    results[1] : new (require('./../restore'))('destination');

  if(source === 's3'){
    log.announce(`Importing backup from "Amazon S3" to "${argv.destination}".`)
    source = s3.getObject().createReadStream().pipe(zlib.createGunzip());
  } else {
    log.announce(`Exporting "${argv.source}" database to "${argv.destination}".`)
  }

  if(destination === 's3'){
    s3.upload({ Body: source.pipe(zlib.createGzip()) })
      .send((err, data) => {
        process.exit(0);
      });
  } else {
    source.pipe(destination);
    source.on('end', () => {});

    destination.on('end', () => {
      process.exit(0);
    });
  }

})
