global.parseBoolean = function(val) {
  if (typeof val === "boolean") {
    return val;
  } else if (typeof val === "string") {
    if (!isNaN(val)) return fromNumber(val);
    return fromString(val);
  } else if (typeof val === "number") {
    return fromNumber(val);
  }
  return Boolean(val);
};

var fromNumber = function (val) {
  return val > 0;
};

var fromString = function (val) {
  if (val.trim().length === 0) return false;
  return !(val.trim().toLowerCase() === "false");
};

String.prototype.toObject = function(obj, value) {
  var names = this.split('.');
  // If a value is given, remove the last name and keep it for later:
  var lastName = arguments.length === 2 ? names.pop() : false;
  // Walk the hierarchy, creating new objects where needed.
  // If the lastName was removed, then the last object is not set yet:
  for( var i = 0; i < names.length; i++ ) {
    obj = obj[ names[i] ] = obj[ names[i] ] || {};
  }
  // If a value was given, set it to the last name:
  if( lastName ) obj = obj[ lastName ] = value;
  // Return the last object in the hierarchy:
  return obj;
};

// get call numbers
Object.defineProperty(global, '__stack', {
  get: function(){
    var orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack){ return stack; };
    var err = new Error;
    Error.captureStackTrace(err, arguments.callee);
    var stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  }
});

Object.defineProperty(global, '__linenumber', {
  get: function(){
    let index = /module\.js$/.test(__stack[3].getFileName()) ? 2 : 3;
    return __stack[index].getLineNumber();
  }
});

Object.defineProperty(global, '__called_filename', {
  get: function(){
    let index = /module\.js$/.test(__stack[3].getFileName()) ? 2 : 3;
    return __stack[index].getFileName();
  }
});
