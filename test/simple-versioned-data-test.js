"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var Operator = require('substance-operator');
var Data = require('../versioned');

var SimpleDataTest = function() {
  Test.call(this);
};

SimpleDataTest.Prototype = function() {

  this.setup = function() {
    this.graph = new Data();
  };

  this.actions = [

    "Node creation", function() {
      var graph = new Data();
      var node = {
        id: "n1",
        type: "sometype"
      };
      graph.create(node);
      var newNode = graph.get(node.id);
      assert.isDefined(newNode);
    },

    "Node creation: 'id' and 'type' are mandatory", function() {
      var graph = new Data();
      assert.exception(function() {
        graph.create({});
      });
    },

    "Node deletion", function() {
      var graph = new Data({ seed : {
        nodes: { "n1": { id: "n1", type: "sometype" } }
      } });
      var id = "n1";
      graph.delete(id);
      assert.isUndefined(graph.get(id));
    },

    "Node creation: should reject duplicate creations", function() {
      var graph = new Data();
      var node = {
        id: "n2",
        type: "numbers",
      };
      assert.exception(function() {
        graph.create(node);
        graph.create(node);
      });
    },

    "Update string property", function() {
      var graph = new Data({ seed : {
        nodes: { "n1": { id: "n1", type: "sometype", value: "foo" } }
      } });
      var path = ["n1", "value"];
      graph.update(path, Operator.TextOperation.Insert(2, "t"));
      assert.isEqual("foto", graph.get(path));
    },

    "Update array property", function() {
      var graph = new Data({ seed : {
        nodes: { "n1": { id: "n1", type: "sometype", value: [1,2,3] } }
      } });
      var path = ["n1", "value"];
      graph.update(path, Operator.ArrayOperation.Delete(1, 2));
      assert.isArrayEqual([1,3], graph.get(path));
    },

    "Update object properties using 'set'", function() {
      var graph = new Data({ seed : {
        nodes: { "n1": { id: "n1", type: "sometype", value: { "foo" : "bar" } } }
      } });
      var path = ["n1", "value", "foo"];
      graph.set(path, "blupp");
      assert.isArrayEqual("blupp", graph.get(path));
    },
  ];
};
SimpleDataTest.Prototype.prototype = Test.prototype;
SimpleDataTest.prototype = new SimpleDataTest.Prototype();

module.exports = SimpleDataTest;
