"use strict";

// Import
// ========

var _    = require('underscore');
var Test = require('substance-test');
var assert = Test.assert;
var Data = require('../index');
var Chronicle = require("substance-chronicle");


// Test
// ========

var SCHEMA = {
  id: "test_schema",
  version: "1.0.0",
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

var GraphIndexTest = function() {
  Test.call(this);
};

GraphIndexTest.Prototype = function() {

  this.setup = function() {
    this.graph = new Data.Graph(SCHEMA, {chronicle: Chronicle.create({mode: Chronicle.HYSTERICAL})});
    this.schema = this.graph.schema;
    this.all = this.graph.addIndex("all", {
      types: ["foo", "bar"]
    });
    this.foos = this.graph.addIndex( "foos", {
      types: ["foo"]
    });
    this.bars = this.graph.addIndex( "bars", {
      types: ["bar"]
    });
    this.byCategory = this.graph.addIndex( "by_category", {
      types: ["foo", "bar"],
      property: "category"
    });
  };

  function getIds(arr) {
    return _.map(arr, function(n) { return n.id; }).sort();
  }

  this.actions = [

    "Created nodes should be added to indexes", function() {
      var node = {
        id: "foo1",
        type: "foo",
        category: "bla"
      };
      this.graph.create(node);

      node = {
        id: "bar1",
        type: "bar",
        category: "blupp"
      };
      this.graph.create(node);

      var all = getIds(this.all.get());
      assert.isArrayEqual(["bar1", "foo1"], all);

      var foos = getIds(this.foos.get());
      assert.isArrayEqual(["foo1"], foos);

      var bars = getIds(this.bars.get());
      assert.isArrayEqual(["bar1"], bars);

      var by_bla = getIds(this.byCategory.get("bla"));
      assert.isArrayEqual(["foo1"], by_bla);

      var by_blupp = getIds(this.byCategory.get("blupp"));
      assert.isArrayEqual(["bar1"], by_blupp);
    },

    "Deleted nodes should be removed from indexes", function() {
      this.graph.delete("foo1");

      var all = getIds(this.all.get());
      assert.isArrayEqual(["bar1"], all);

      var foos = getIds(this.foos.get());
      assert.isArrayEqual([], foos);

      var bars = getIds(this.bars.get());
      assert.isArrayEqual(["bar1"], bars);

      var by_bla = getIds(this.byCategory.get("bla"));
      assert.isArrayEqual([], by_bla);

      var by_blupp = getIds(this.byCategory.get("blupp"));
      assert.isArrayEqual(["bar1"], by_blupp);
    },

    "Updates of indexed properties should update indexes", function() {
      this.graph.set(["bar1", "category"], "bla");

      var all = getIds(this.all.get());
      assert.isArrayEqual(["bar1"], all);

      var foos = getIds(this.foos.get());
      assert.isArrayEqual([], foos);

      var bars = getIds(this.bars.get());
      assert.isArrayEqual(["bar1"], bars);

      var by_bla = getIds(this.byCategory.get("bla"));
      assert.isArrayEqual(["bar1"], by_bla);

      var by_blupp = getIds(this.byCategory.get("blupp"));
      assert.isArrayEqual([], by_blupp);
    },

    "Be smart about missing properties on nodes", function() {
      // Missing the category property
      var node = {
        id: "foo2",
        type: "foo"
      };
      this.graph.create(node);

      // Index remains untouched
      var by_bla = getIds(this.byCategory.get("bla"));
      assert.isArrayEqual(["bar1"], by_bla);
      var by_blupp = getIds(this.byCategory.get("blupp"));
      assert.isArrayEqual([], by_blupp);
    }
  ];
};
GraphIndexTest.Prototype.prototype = Test.prototype;
GraphIndexTest.prototype = new GraphIndexTest.Prototype();

module.exports = GraphIndexTest;
