"use strict";

var _ = require('underscore');

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
      this.type = ['graph'];
      this.baseType = 'graph';
    } else {
      this.type = this.graph.schema.getPropertyType(this.context.type, this.key);
      this.baseType = _.isArray(this.type) ? this.type[0] : this.type;
    }
  };

  this.get = function() {
    var value = this.context[this.key];
    if (this.baseType !== 'graph') {
      value = this.graph.schema.ensureType(this.baseType, value);
      this.context[this.key] = value;
    }
    return value;
  };

  this.set = function(value) {
    this.context[this.key] = this.graph.schema.parseValue(this.baseType, value);
  };

};

Property.prototype = new Property.Prototype();

module.exports = Property;
