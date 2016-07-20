let database;
const _ = require('highland');
const MongoClient = require('mongodb');

const _mongoConnect = function(url, alias, cb){
  MongoClient.connect(url, function(err, db){
    if(err) return cb(err);
    database = {
      connections: (database && database.connections) || {}
    };
    alias = alias || db.databaseName;
    url = url.replace(/\/\/.+:.+@/, '//');
    log.debug(`connecting to "${url}" and aliasing as "${alias}"`);
    database.connections[alias] = db;
    return cb(null, database, alias);
  });
};

function _throwIfMissing(param){
  throw new Error(`${param} is a required parameter`)
}

function _noop(){};

const connect = (url = _throwIfMissing('url'), alias, cb = _noop) => {
  if(alias.constructor === Function) [ url, alias, cb ] = [ url, null, alias];
  if(database !== undefined){
    return cb(null, database);
  } else {
    return _mongoConnect(url, alias, cb);
  }
};

connect.addConnection = (url = _throwIfMissing('url'), alias, cb = _noop) => {
  if(alias.constructor === Function) [ url, alias, cb ] = [ url, null, alias];
  return _mongoConnect(url, alias, cb);
};

module.exports = connect;
