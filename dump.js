const chalk = require('chalk');
const _ = require('highland');
const eachSeries = require('async/eachSeries');
const forEachOf = require('async/eachOfSeries')
const series = require('async/series');
const _connect = (url, callback) => {
  if(url.constructor === Function) {
    [ url, callback ] = [ null, url ];
  }
  return require('./connect')(url, (err, database, alias) => {
    callback(err, database, alias)
  })
};

const bson = require('bson');
let BSON = new bson.BSONPure.BSON();

let _connection;

let _check = {};

module.exports = class Dump {

  constructor(alias) {
    _connect((err, database) => {
      _connection = database.connections[alias];
    });
    this.stream = _();
    return this._init();
  }

  _init(){

    this.stream.on('end', function(){
      let message = "\n";
      forEachOf(_check, function(val, key, cb){
        message += '  collection[' + chalk.bold.blue(key) + '] : ' + chalk.white(val) + '\n'
        return cb();
      }, function(){
        log.debug(message);
      })
      _connection.close()
    });

    _connection.collections((err, collections) => {
      let _col = {};
      return eachSeries(collections, (collection, nextCollection) => {

        if (collection.collectionName.match(/^system\./)) {
          return setImmediate(nextCollection);
        }

        return series([
          // Get Indexes
          (cb) => {
            collection.indexInformation({ full: true }, (err, info) => {
              if (err) return cb(err);
              this.stream.write(BSON.serialize({
                object_type: 'index',
                collection: collection.collectionName,
                data: info
              }, false, true, false));
              return cb(null);
            });
          },
          // Get documents
          (cb) => {
            var self = this;
            let cursor = collection.find({}, { raw: true });
            return loopDocs();
            function loopDocs(){
              cursor.nextObject((err, doc) => {
                if(!doc) return cb(null);

                self.stream.write(BSON.serialize({
                  object_type: 'document',
                  collection: collection.collectionName,
                  data: BSON.deserialize(doc)
                }, false, true, false));

                _check[collection.collectionName] = _check[collection.collectionName] || 0;
                _check[collection.collectionName]++;

                return setImmediate(loopDocs);

              });
            }
          }

        ], (err) => {
          return nextCollection();
        });

      }, (err) => {
        this.stream.end();
      });

    });

    return this.stream;

  }

};
