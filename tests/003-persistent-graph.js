"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var Operator = require('substance-operator');
var Data = require('../index');
var MemoryStore = require('substance-store').MemoryStore;


// Test
// ========

var SCHEMA = {
  indexes : {
    "all": {
      "type": "node",
    },
    "foos": {
      "type": "foo",
    },
    "bars": {
      "type": "bar",
    },
    "by_category": {
      "type": "node",
      "properties": ["category"]
    }
  },
  types: {
    node: {
      properties: {
        category: "string"
      }
    },
    foo: {
      parent: "node"
    },
    bar: {
      parent: "node"
    }
  }
};

var PersistentGraphTest = function() {
  Test.call(this);
};

PersistentGraphTest.Prototype = function() {

  this.setup = function() {
    this.store = new MemoryStore();
    this.graph = new Data.Graph(SCHEMA, {store: this.store});
    this.nodes = this.graph.__nodes__;
  };

  var NODE1 = {
    id: "the_foo",
    type: "foo",
    category: "bla"
  };
  var NODE2 = {
    id: "the_bar",
    type: "bar",
    category: "blupp"
  };

  this.actions = [
    "Created node should be persisted", function() {
      this.graph.create(NODE1);
      this.graph.create(NODE2);

      var actual = this.nodes.get(NODE1.id);
      assert.isDeepEqual(NODE1, actual);

      actual = this.nodes.get(NODE2.id);
      assert.isDeepEqual(NODE2, actual);
    },

    "Deleted node should be removed from store", function() {
      this.graph.delete(NODE1.id);

      var actual = this.nodes.get(NODE1.id);
      assert.isUndefined(actual);
    },

    "Update: property updates should be persisted", function() {
      this.graph.update([NODE2.id, "category"], Operator.TextOperation.fromOT("blupp", [2, -3, "a"]));

      var actual = this.nodes.get(NODE2.id);
      assert.isEqual("bla", actual.category);
    },

    "Set: property updates should be persisted", function() {
      this.graph.set([NODE2.id, "category"], "blupp");

      var actual = this.nodes.get(NODE2.id);
      assert.isEqual("blupp", actual.category);
    },

    "Import: persisted graph should be restored", function() {
      var graph = new Data.Graph(SCHEMA, {store: this.store}).load();
      var actual = graph.get(NODE2.id);
      assert.isDeepEqual(NODE2, actual);
    }
  ];
};
PersistentGraphTest.Prototype.prototype = Test.prototype;
PersistentGraphTest.prototype = new PersistentGraphTest.Prototype();

Test.registerTest(['Substance.Data', 'Persistent Graph'], new PersistentGraphTest());
