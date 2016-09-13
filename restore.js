const _ = require('highland');
const eachSeries = require('async/eachSeries');
const series = require('async/series');
const bson = require('bson');
let BSON = new bson.BSONPure.BSON();
const bs = require('bson-stream');

const _connect = (url, callback) => {
  if(url.constructor === Function) {
    [ url, callback ] = [ null, url ];
  }
  return require('./connect')(url, (err, database, alias) => {
    callback(err, database, alias)
  })
};

let _connection;
let pre_write = [];

module.exports = class Restore {

  constructor(alias) {
    this.restoreStream = _.pipeline(new bs());
    this.test = _connect((err, database, _alias) => {
      if(!_alias) _alias = alias
      _connection = database.connections[_alias];
    })
    return this._init()
  }

  setIndexes(collection, indexes){

    eachSeries(indexes, (index, cb) => {
      if(index.name === '_id_') return setImmediate(cb);
      let key = index.key;
      delete index.ns;
      delete index.key;
      _connection.collection(collection, (err, col) => {
        if(err) {
          console.error(err);
          process.exit(1);
        }
        col.ensureIndex(key, index, (indexErr, inserted) => {
          if(indexErr) {
            console.error(indexErr);
            process.exit(1);
          }
        })
      });
    });

  }

  static modify(collection, obj) {
    pre_write.push({ collection: collection, object: obj });
  }

  insertDocuments(collection, document){
    // Loops over each preinsert object and uses it to modify the document before insert
    eachSeries(pre_write, (obj, nextModifier) => {
      if(!obj.collection || obj.collection === collection) _.extend(obj.object, document);
      nextModifier();
    }, (err) => {

      _connection.collection(collection)
        .update({ _id: document._id }, { '$set': document }, { upsert: true }, (err, saved) => {
          if(err) {
            console.error(err);
            process.exit(1);
          }
          this.restoreStream.resume();
        });

    });
  }

  _init(){
    // this.preInsert = [];

    this.restoreStream.on('data', (data) => {
      if(data.object_type){
        if(data.object_type === 'index'){
          this.setIndexes(data.collection, data.data);
        } else {
          this.restoreStream.pause();
          this.insertDocuments(data.collection, data.data);
        }
      }
    });

    this.restoreStream.on('end', function(){
      _connection.close();
    })

    this.restoreStream.on('error', function(err){
      _connection.close();
      console.error(err);
    })

    return this.restoreStream;

  }

};
