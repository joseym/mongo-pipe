require('dotenv').config({ silent: true, path: require('path').join(__dirname, './.env' ) });

const _ = require('highland');
const moment = require('moment-timezone');
const series = require('async/series');
const connect = require('./connect');
const fs = require('fs');

const argv = require('yargs').argv;

const url = process.env.PRODUCTION_DB;
const local = process.env.LOCAL_DB;
const staging = process.env.STAGING_DB;

const bson = require('bson');
let BSON = new bson.BSONPure.BSON();

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

let s3 = new AWS.S3({
  params: {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${date}/${date} ${hour}.db.gz`
  }
});

let now = moment().tz("America/Los_Angeles");
let date = now.format('YYYY-MM-DD');
let hour = now.format('HH:mm:ss');


const progress = require('progress-stream');

let prog = progress({
  time: 100
});

let zlib = require('zlib');

series([
  // connect
  (callback) => {
    return connect(url, callback);
  },
  (callback) => {
    return connect.addConnection(local, 'local', callback);
  },
  (callback) => {
    return connect.addConnection(staging, 'staging', callback);
  }
], (err, results) => {



  let backup = new (require('./dump'))('rezflow');
  backup.on('end', function(){
    console.log('done writing');
  });
  s3.upload({ Body: backup.pipe(zlib.createGzip()) })
    .send(function(err, data) { process.exit(0) });

  // let load = new (require('./restore'))('staging');
  // load.on('data', function(data){
  //   // console.log(data.data._id)
  // });
  // load.on('end', function(){
  //   process.exit(0);
  // });

});
