"use strict";

var CustomIndex = require("./custom_index");

var SimpleIndex = function(graph, name, options) {
  options = options || {};
  CustomIndex.call(this, graph, name, options);
};

SimpleIndex.Prototype = function() {
  this.__add = function(key, value) {
    this.data[key] = value;
  };
  this.__remove = function(key, value) {
    delete this.data[key];
  };
};

SimpleIndex.Prototype.prototype = CustomIndex.prototype;
SimpleIndex.prototype = new SimpleIndex.Prototype();

module.exports = SimpleIndex;
