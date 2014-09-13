"use strict";

var _ = require("underscore");

var Property = function(graph, path) {
  if (!path) {
    throw new Error("Illegal argument: path is null/undefined.");
  }
  this.graph = graph;
  this.path = path;
  this.init();
};

Property.Prototype = function() {

  this.init = function() {
    this.context = this.graph.nodes;
    this.key = this.path[this.path.length-1];
    for (var i = 0; i < this.path.length - 1; i++) {
      this.context = this.context[this.path[i]];
      if (this.context === undefined || this.context === null) {
        this.context = [];
        this.baseType = undefined;
        return;
      }
    }
    if (this.context === this.graph.nodes) {
      this.baseType = 'graph';
    } else {
      this.baseType = this.graph.schema.getPropertyBaseType(this.context.type, this.key);
    }
  }

  this.get = function() {
    return this.context[this.key];
  };

  this.set = function(value) {
    this.context[this.key] = this.graph.schema.parseValue(this.baseType, value);
  };

  this.getType = function() {
    return this.baseType;
  };
};

Property.prototype = new Property.Prototype();

module.exports = Property;
