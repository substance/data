"use strict";

var Operator = require('substance-operator');

var PersistenceAdapter = function(delegate, nodes) {
  this.delegate = delegate;
  this.nodes = nodes;
};

PersistenceAdapter.__prototype__ = function() {

  this.get = function(path) {
    return this.delegate.get(path);
  };

  this.create = function(__, value) {
    this.delegate.create(__, value);
    this.nodes.set(value.id, value);
  };

  this.set = function(path, value) {
    this.delegate.set(path, value);
    // TODO: is it ok to store the value as node???
    var nodeId = path[0];
    var updated = this.delegate.get([nodeId]);
    this.nodes.set(nodeId, updated);
  };

  this.delete = function(__, value) {
    this.delegate.delete(__, value);
    this.nodes.delete(value.id);
  };

  this.inplace = function() {
    return false;
  };
};
PersistenceAdapter.__prototype__.prototype = Operator.ObjectOperation.Object.prototype;
PersistenceAdapter.prototype = new PersistenceAdapter.__prototype__();

module.exports = PersistenceAdapter;
