#!/usr/bin/env node
require('dotenv').config({ silent: true, path: require('path').join(__dirname, './../.env' ) });
require('./../_utils');

global.argv = process._yargs = require('yargs')
  .usage('Usage: $0 <cmd> [options]')
  .command('import', 'Import a data file from <source>')
  .command('export', 'Export a data file from <source>')
  .count('verbose').alias('verbose', 'v')
  .option('modify', {
    description: 'JSON file used to modify each document before writing',
    alias: 'm',
    array: true
  })
  .option('root', {
    description: 'Starting path for all file requests (adding modifiers via json files)',
    default: process.cwd(),
    alias: 'r',
  })
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
  .example('import --source s3 --destination staging --modify maskEmails.json', 'Restore backup from s3 onto the staging db')
  .boolean('debug')
  .help('help')
  .argv;

global.LOG_LEVEL = argv.verbose || parseInt(process.env.LOG_LEVEL);
global.DEBUG = argv.debug || parseBoolean(process.env.DEBUG);
global.log = require('./../logging.js');

const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const series = require('async/series');
const forEachOf = require('async/eachOfSeries')
const connect = require('./../connect');
const moment = require('moment-timezone');
const zlib = require('zlib');
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

let config_path = path.resolve(__dirname, './../config.json');

try {
  global.CONFIG = require(config_path)
} catch (e) {
  global.CONFIG = false;
}

let now = moment().tz("America/Los_Angeles");
let date = now.format('YYYY-MM-DD');
let hour = now.format('HH:mm:ss');
let s3_params = {
  Bucket: process.env.AWS_S3_BUCKET
};

series([
  // look for config
  (callback) => {
    if(!CONFIG){
      log.announce('Please configure your databases.');
      new (require('./wizard'))(function(dbs, query){

        CONFIG = { databases: {} };
        forEachOf(dbs, (db, key, cb) => {
          CONFIG.databases[db.name] = db.url;
          cb();
        });
        console.log('');
        log.announce('Configure AWS');
        query.prompt(this.aws_questions).then((answers) => {

          if(answers.aws) {
            CONFIG.aws = {
              bucket: answers['aws.bucket'],
              secret: answers['aws.secret'],
              access: answers['aws.access']
            }
          } else {
            CONFIG.aws = false;
          }

          console.log('');
          log.announce('Set up import defaults.');
          query.prompt(this.import_questions).then((answers) => {
            CONFIG.restore = {
              source: answers['restore.source'],
              destination: answers['restore.destination']
            }

            console.log('');
            log.announce('Set up export defaults.');
            query.prompt(this.export_questions).then((answers) => {
              CONFIG.dump = {
                source: answers['dump.source'],
                destination: answers['dump.destination']
              }

              CONFIG.databases = JSON.stringify(CONFIG.databases, null, 4);

              ejs.renderFile(path.resolve(__dirname, './../templates/config.json.template'), CONFIG, {}, function(err, str){
                if(!err){
                  return fs.writeFile(path.resolve(process.env.PWD, './config.json'), str, function(err){
                    return callback(err, JSON.parse(str));
                  });
                } else {
                  return callback(err);
                }
              });

            });

          });

        }, (err) => {
          log.warn(err);
        });

      });
    } else {
      return callback(null, CONFIG)
    }
  },
  // connect
  (callback) => {
    switch (argv.source) {
      case 's3':
        s3_params.Key = `2016-09-13 23:00:04.db.gz`;
        return callback(null, 's3');
        break;
      default:
        return connect(CONFIG.databases[argv.source], 'source', callback)
    }
  },
  (callback) => {
    switch (argv.destination) {
      case 's3':
        s3_params.Key = `${date}/${date} ${hour}.db.gz`;
        return callback(null, 's3');
        break;
      default:
        return connect.addConnection(CONFIG.databases[argv.destination], 'destination', callback)
    }
  }
], (err, results) => {

  let start = moment();

  function duration_from_seconds(time){
    return {
      days: Math.floor((((time / 60) / 60) / 24) % 60),
      hours: Math.floor(((time / 60) / 60) % 60),
      minutes: Math.floor(((time / 60)) % 60),
      seconds: Math.floor(time % 60)
    }
  }

  let restore = require('./../restore');
  let dump = require('./../dump');

  forEachOf(argv.modify, (file, i, nextModifier) => {
    let parseModifier = file.match(/^((\w+)?:)?(.*)/);
    let collection = parseModifier[2];
    let object = parseModifier[3];
    try {
      restore.modify(collection, JSON.parse(object));
    } catch (e) {
      restore.modify(collection, require(path.resolve(argv.root, object)));
    } finally {
      nextModifier();
    }
  }, () => {

    if(err) return log.warn(err);

    global.CONFIG = results[0];

    let s3 = new AWS.S3({ params: s3_params });

    let source = results[1].constructor === String ?
    results[1] : new dump('source');

    let destination = results[2].constructor === String ?
    results[2] : new restore('destination');

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
      destination.on('data', (data) => {});
      destination.on('end', () => {

        let seconds = Math.floor(moment().diff(start) / 1000);
        let duration = duration_from_seconds(seconds);
        let duration_message = "";
        if(duration.days) duration_message += `${duration.days} days, `;
        if(duration.hours) duration_message += `${duration.hours} hours, `;
        if(duration.minutes) duration_message += `${duration.minutes} minutes, `;
        if(duration.seconds) duration_message += duration_message !== "" ? `and ${duration.seconds} seconds` : `${duration.seconds} seconds`;
        log.announce(duration_message);
        process.exit(0);

      });
    }
  })

})
