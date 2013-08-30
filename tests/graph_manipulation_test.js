"use strict";

// Import
// ========

var _    = require('underscore');
var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var Operator = require('substance-operator');
var Data = require('../index');


// Test
// ========

var SCHEMA = {
  id: "test_schema",
  version: "1.0.0",
  types: {
    node: {
      properties: {
        name: "string",
      }
    },
    strings: {
      parent: "node",
      properties: {
        val: ["string"],
        arr: ["array", "string"]
      }
    },
    numbers: {
      parent: "node",
      properties: {
        val: ["number"],
        arr: ["array", "number"]
      }
    },
    booleans: {
      parent: "node",
      properties: {
        val: ["boolean"],
        arr: ["array", "boolean"]
      }
    },
    dates: {
      parent: "node",
      properties: {
        val: ["date"],
        arr: ["array", "date"]
      }
    },
    custom: {
      parent: "node",
      properties: {
        val: ["object"],
      }
    },
    item: {},
    linked_item: {
      parent: "item",
      properties: {
        next: "item"
      }
    },
    collection: {
      properties: {
        items: ["array", "item"]
      }
    },
    table: {
      properties: {
        items: ["array", "array", "item"]
      }
    }
  },
};

function getIds(arr) {
  return _.map(arr, function(n) { return n.id; });
}

var GraphManipulationTest = function() {

  this.setup = function() {
    this.graph = new Data.Graph(SCHEMA);
    this.schema = this.graph.schema;

    this.graph.create({
      id: "the_strings",
      type: "strings",
      name: "Strings",
      val: "foo",
      arr: ["bla","blupp"]
    });

    this.graph.create({
      id: "the_numbers",
      type: "numbers",
      name: "Numbers",
      val: 11,
      arr: [1,2,3]
    });

    this.graph.create({
      id: "the_booleans",
      type: "booleans",
      name: "Booleans",
      val: true,
      arr: [false, true]
    });

    this.graph.create({
      id: "the_dates",
      type: "dates",
      name: "Dates",
      val: new Date(1000),
      arr: [new Date(1000),new Date(2000)]
    });

    this.graph.create({
      id: "the_custom",
      type: "custom",
      name: "Custom",
      val: { a: { foo: "bar"}, bla: "blupp" },
    });

    this.graph.create({id: "i1", type: "linked_item", next: null});
    this.graph.create({id: "i2", type: "linked_item", next: "i1"});
    this.graph.create({id: "i3", type: "linked_item", next: "i2"});
    this.graph.create({id: "c1", type: "collection", items: ["i1", "i3"]});
    this.graph.create({id: "t1", type: "table", items: [["i1", "i3"], ["i2", "i3"]]});

  };

  this.actions = [

    "Node creation.", function() {
      var node = {
        id: "n1",
        type: "numbers",
        name: "Numbers 1",
        foo: "bar",
        val: 11,
        arr: [1,2,3]
      };
      this.graph.create(node);

      // the node should be accessible via id now
      var newNode = this.graph.get(node.id);
      assert.isDefined(newNode);

      assert.isEqual(node.name, newNode.name);
      assert.isEqual(node.val, newNode.val);
      assert.isArrayEqual(node.arr, newNode.arr);

      // the node is newly created
      node.bla = "blupp";
      assert.isUndefined(newNode.bla);

      // ... and values are deeply cloned
      node.arr.push(4);
      assert.isFalse(_.isEqual(node.arr, newNode.arr));

      // only properties that are specified in the schema should be copied
      assert.isUndefined(newNode.foo);
    },

    "Node creation: 'id' and 'type' are mandatory", function() {
      assert.exception(function() {
        this.graph.create({});
      }, this);
    },

    "Node creation: 'type' must be defined in schema", function() {
      var node = {id: "aaa", type: "unknown_type"};
      assert.exception(function() {
        this.graph.create(node);
      }, this);
    },

    "Node creation: should use default values for incomplete data", function() {
      var node = {
        id: "n2",
        type: "numbers",
      };
      this.graph.create(node);

      var newNode = this.graph.get(node.id);

      assert.isEqual("", newNode.name);
      assert.isEqual(0, newNode.val);
      assert.isArrayEqual([], newNode.arr);
    },

    "Node deletion", function() {
      var id = "n1";
      this.graph.delete(id);
      assert.isUndefined(this.graph.get(id));
    },

    "Node creation: should reject duplicate creations", function() {
      var node = {
        id: "n2",
        type: "numbers",
      };
      assert.exception(function() {
        this.graph.create(node);
        this.graph.create(node);
      }, this);
    },

    "Reset fixture", function() {
      this.setup();
    },

    "Update 'object'", function() {
      // Maybe it would be helpful to have some convenience mechanism
      // to create node property updates more easily

      var valueUpdate = Operator.TextOperation.fromOT("bar", [1, -1, "e", 1, "ry"]);
      var propertyUpdate = Operator.ObjectOperation.Update(["a", "foo"], valueUpdate);
      this.graph.update(["the_custom", "val"], propertyUpdate);

      var custom = this.graph.get("the_custom");
      assert.isEqual("berry", custom.val.a.foo);
    },

    "Update 'array'", function() {
      this.graph.update(["the_numbers", "arr"], ["+", 3, 4]);

      var numbers = this.graph.get("the_numbers");
      assert.isArrayEqual([1,2,3,4], numbers.arr);
    },

    "Update 'string'", function() {
      this.graph.update(["the_strings", "val"], [3, "tball"]);

      var strings = this.graph.get("the_strings");
      assert.isEqual("football", strings.val);
    },

    "Update 'number'", function() {
      this.graph.set(["the_numbers", "val"], 42);

      var numbers = this.graph.get("the_numbers");
      assert.isEqual(42, numbers.val);
    },

    "Update 'boolean'", function() {
      this.graph.set(["the_booleans", "val"], false);

      var booleans = this.graph.get("the_booleans");
      assert.isEqual(false, booleans.val);
    },

    "Update 'date'", function() {
      var date = new Date(1111);
      this.graph.set(["the_dates", "val"], date);

      var dates = this.graph.get("the_dates");
      assert.isEqual(date.getTime(), dates.val.getTime());
    },

    "Query: resolve referenced nodes", function() {
      var path = ["i2", "next"];
      var val = this.graph.get(path);
      assert.isEqual("i1", val);

      var node = this.graph.query(path);
      assert.isEqual("i1", node.id);
    },

    "Query: resolve arrays of references", function() {
      var path = ["c1", "items"];
      var val = this.graph.get(path);
      assert.isArrayEqual(["i1", "i3"], val);

      var nodes = this.graph.query(path);
      var ids = getIds(nodes);
      assert.isArrayEqual(["i1", "i3"], ids);

      path = ["t1", "items"];
      nodes = this.graph.query(path);
      ids = [getIds(nodes[0]), getIds(nodes[1])];
      assert.isDeepEqual([["i1", "i3"], ["i2", "i3"]], ids);
    }
  ];
};

registerTest(['Substance.Data', 'Graph Manipulation'], new GraphManipulationTest());
