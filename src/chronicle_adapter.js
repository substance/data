"use strict";

var Chronicle = require('substance-chronicle');
var Operator = require('substance-operator');

var ChronicleAdapter = function(graph) {
  this.graph = graph;
  this.graph.state = "ROOT";
};

ChronicleAdapter.__prototype__ = function() {

  this.apply = function(op) {
    // Note: we call the Graph.apply intentionally, as the chronicled change
    // should be an ObjectOperation
    //console.log("ChronicleAdapter.apply, op=", op);
    this.graph.__apply__(op);
    this.graph.updated_at = new Date(op.timestamp);
  };

  this.invert = function(change) {
    return Operator.ObjectOperation.fromJSON(change).invert();
  };

  this.transform = function(a, b, options) {
    return Operator.ObjectOperation.transform(a, b, options);
  };

  this.reset = function() {
    this.graph.reset();
  };

  this.getState = function() {
    return this.graph.state;
  };

  this.setState = function(state) {
    this.graph.state = state;
  };
};

ChronicleAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
ChronicleAdapter.prototype = new ChronicleAdapter.__prototype__();

module.exports = ChronicleAdapter;
