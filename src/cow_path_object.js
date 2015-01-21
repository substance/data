"use strict";

var _ = require('underscore');
var PathObject = require('./path_object');

var COW_ID = 0;

var COWPathObject = function _COWPathObject(original) {
  this.COW_ID = COW_ID++;
  this.data = Object.create(original);
};

COWPathObject.Prototype = function() {

  this._resolve = function(path, create) {
    var lastIdx = path.length-1;
    var context = this.data;
    for (var i = 0; i < lastIdx; i++) {
      var key = path[i];
      if (context[key] === undefined && create) {
        context[key] = {};
      }
      // Note: if we are shadowing an already shadowed object
      // the only way to detect this is to compare the COW object's ID
      else if (context[key].__COW__ !== this.COW_ID) {
        context[key] = COWPathObject.wrapObject(context[key], this.COW_ID);
      }
      context = context[key];
    }
    return context;
  };

  this.get = function(path) {
    var key = path[path.length-1];
    return PathObject.prototype._resolve.call(this, path)[key];
  };

  this.set = function(path, value) {
    var key = path[path.length-1];
    this._resolve(path, true)[key] = value;
  };

  this.delete = function(path) {
    var key = path[path.length-1];
    this._resolve(path, true)[key] = undefined;
  };
};
COWPathObject.Prototype.prototype = PathObject.prototype;
COWPathObject.prototype = new COWPathObject.Prototype();
COWPathObject.prototype.constructor = COWPathObject;

COWPathObject.wrapObject = function(obj, COW_ID) {
  var result;
  if (obj === undefined || obj === null) return obj;
  if ( _.isArray(obj) ) {
    result = obj.slice(0);
  } else if (_.isDate(obj)) {
    return new Date(obj);
  } else if (_.isObject(obj)) {
    if (obj.copyOnWriteClone) {
      result = obj.copyOnWriteClone();
    } else {
      result = Object.create(obj);
    }
    // add a toJSON implementation which extends the JSON representation of the shadowed object
    result.toJSON = function() {
      var proto = Object.getPrototypeOf(this);
      var protoJSON = proto.toJSON ? proto.toJSON() : proto;
      return _.extend({}, protoJSON, this);
    };
  } else {
    return obj;
  }
  result.__COW__ = COW_ID;
  return result;
};

module.exports = COWPathObject;
