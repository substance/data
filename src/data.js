"use strict";

var Substance = require('substance');
var PathAdapter = Substance.PathAdapter;
var EventEmitter = Substance.EventEmitter;

function Data(options) {
  EventEmitter.call(this);

  options = options || {};

  // the nodeFactory is used to wrap plain JSON data into rich objects
  // during creation (or when a create operation is replayed)
  this.nodeFactory = options.nodeFactory;
  this.seed = options.seed;

  this.nodes = {};
  this.init();
}

Data.Prototype = function() {

  this.create = function(node) {
    if (this.contains(node.id)) {
      throw new Error("Node already exists: " + node.id);
    }
    if (this.nodeFactory) {
      node = this.nodeFactory(node);
    }
    if (!node.id || !node.type) {
      throw new Error("Node id and type are mandatory.");
    }
    this.nodes[node.id] = node;
    return node;
  };

  this.delete = function(id) {
    var oldVal = this.nodes[id];
    delete this.nodes[id];
    return oldVal;
  };

  this.set = function(path, newValue) {
    var oldValue = this.nodes.get(path);
    this.nodes.set(path, newValue);
    return oldValue;
  };

  this.update = function(path, diffOp) {
    var oldValue = this.nodes.get(path);
    var newValue = diffOp.apply(oldValue);
    this.nodes.set(path, newValue);
    return oldValue;
  };

  this.get = function(path) {
    return this.nodes.get(path);
  };

  this.toJSON = function() {
    return {
      schema: [this.schema.id, this.schema.version],
      nodes: Substance.deepclone(this.nodes)
    };
  };

  this.contains = function(id) {
    return (!!this.nodes[id]);
  };

  this.reset = function() {
    this.init();
  };

  // Graph initialization.
  this.init = function() {
    if (this.seed) {
      var nodes = this.seed.nodes;
      if (this.nodeFactory) {
        this.nodes = new PathAdapter();
        Substance.each(nodes, function(node) {
          var richNode = this.nodeFactory(node);
          if (richNode) {
            this.nodes[node.id] = richNode;
          } else {
            console.error('Could not create node instance for', node);
          }
        }, this);
      } else {
        this.nodes = Substance.extend(new PathAdapter(), this.seed.nodes);
      }
    } else {
    }
  };
};

Substance.inherit(Data, EventEmitter);

module.exports = Data;
