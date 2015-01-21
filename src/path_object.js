"use strict";

/**
 * A wrapper for an object that provides a path based manipulation API.
 * Particularly, this is used at places where we want to implement Copy'on'write data structures.
 */
var PathObject = function _PathObject(data) {
  this.data = data || {};
};

PathObject.Prototype = function() {

  this._resolve = function(path, create) {
    var lastIdx = path.length-1;
    var context = this.data;
    for (var i = 0; i < lastIdx; i++) {
      var key = path[i];
      if (context[key] === undefined) {
        if (create) {
          context[key] = {};
        } else {
          return {};
        }
      }
      context = context[key];
    }
    return context;
  };

  this.get = function(path) {
    var key = path[path.length-1];
    return this._resolve(path)[key];
  };

  this.set = function(path, value) {
    var key = path[path.length-1];
    this._resolve(path, true)[key] = value;
  };

  this.delete = function(path) {
    var key = path[path.length-1];
    delete this._resolve(path, true)[key];
  };
};
PathObject.prototype = new PathObject.Prototype();
PathObject.prototype.constructor = PathObject;

module.exports = PathObject;
