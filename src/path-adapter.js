"use strict";

var Substance = require('substance');

/**
 * An adapter to access an object via path.
 */
function PathAdapter() {}

PathAdapter.Prototype = function() {

  this._resolve = function(path, create) {
    var lastIdx = path.length-1;
    var context = this;
    for (var i = 0; i < lastIdx; i++) {
      var key = path[i];
      if (context[key] === undefined) {
        if (create) {
          context[key] = {};
        } else {
          return undefined;
        }
      }
      context = context[key];
    }
    return context;
  };

  this.get = function(path) {
    if (Substance.isString(path)) {
      return this[path];
    } else {
      var key = path[path.length-1];
      return this._resolve(path)[key];
    }
  };

  this.set = function(path, value) {
    if (Substance.isString(path)) {
      this[path] = value;
    } else {
      var key = path[path.length-1];
      this._resolve(path, true)[key] = value;
    }
  };

  this.delete = function(path) {
    if (Substance.isString(path)) {
      delete this[path];
    } else {
      var key = path[path.length-1];
      delete this._resolve(path)[key];
    }
  };
};

Substance.initClass( PathAdapter );

module.exports = PathAdapter;
