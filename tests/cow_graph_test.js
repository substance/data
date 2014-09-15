"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var GraphManipulationTest = require('./graph_manipulation_test');
var Data = require('../index');
var COWGraph = Data.COWGraph;
var Operator = require('substance-operator');

var COWGraphTest = function() {
  GraphManipulationTest.call(this);
};

COWGraphTest.Prototype = function() {

  this.actions = [
    "Primitives should fulfill strict equality (stay the same)", function() {
      var cow = new COWGraph(this.graph);
      cow.create({
        type: 'node',
        id: 'n1',
        name: 'foo'
      });
      assert.isEqual('foo', cow.get(['n1', 'name']));
      assert.isEqual(11, cow.get(['the_numbers', 'val']));
      assert.isEqual(true, cow.get(['the_booleans', 'val']));
    },
    "Arrays should be copied on access", function() {
      var cow = new COWGraph(this.graph);
      assert.isEqual(this.graph.nodes.the_numbers.arr, cow.nodes.the_numbers.arr);
      var cow_arr = cow.get(['the_numbers', 'arr']);
      assert.isFalse(this.graph.nodes.the_numbers.arr === cow_arr);
      assert.isTrue( _.isArray(cow_arr) );
      assert.isArrayEqual(this.graph.nodes.the_numbers.arr, cow_arr);
    },
    "Dates should be copied on access", function() {
      var cow = new COWGraph(this.graph);
      assert.isEqual(this.graph.nodes.the_dates.val, cow.nodes.the_dates.val);
      var original_date = this.graph.get(['the_dates', 'val']);
      var cow_date = cow.get(['the_dates', 'val']);
      assert.isFalse(original_date === cow_date);
      assert.isTrue( _.isDate(cow_date) );
      assert.isEqual(original_date.getTime(), cow_date.getTime());
    },
    "Accessing non existing properties should return 'undefined'", function() {
      var cow = new COWGraph(this.graph);
      assert.isUndefined(cow.get(['a', 'b', 'c', 'd']));
    },
    "Create should not affect original graph", function() {
      var cow = new COWGraph(this.graph);
      cow.create({
        type: 'node',
        id: 'n1',
        name: 'foo'
      });
      assert.isDefined(cow.get(['n1', 'name']));
      assert.isUndefined(this.graph.get(['n1', 'name']));
    },
    "Delete should not affect original graph", function() {
      var cow = new COWGraph(this.graph);
      cow.delete('the_strings');
      assert.isUndefined(cow.get('the_strings'));
      assert.isDefined(this.graph.get('the_strings'));
    },
    "Set property should not affect original", function() {
      var cow = new COWGraph(this.graph);
      var path = ['the_strings', 'name'];
      cow.set(path, 'aaa');
      assert.isEqual('Strings', this.graph.get(path));
      assert.isEqual('aaa', cow.get(path));
    },
    "Update property should not affect original", function() {
      var cow = new COWGraph(this.graph);
      var path = ['the_strings', 'name'];
      cow.update(path, Operator.TextOperation.Insert(0, 'abc'));
      assert.isEqual('Strings', this.graph.get(path));
      assert.isEqual('abcStrings', cow.get(path));
    },
    "Nested COW graphs: changes should not affect parent", function() {
      var cow = new COWGraph(this.graph);
      var cow2 = new COWGraph(this.graph);
      // create
      cow2.create({
        type: 'node',
        id: 'n1',
        name: 'foo'
      });
      assert.isDefined(cow2.get(['n1', 'name']));
      assert.isUndefined(cow.get(['n1', 'name']));
      // delete
      cow2.delete('the_numbers');
      assert.isUndefined(cow2.get('the_numbers'));
      assert.isDefined(cow.get('the_numbers'));
      // set
      var path = ['the_strings', 'name'];
      cow2.set(path, 'aaa');
      assert.isEqual('Strings', cow.get(path));
      assert.isEqual('aaa', cow2.get(path));
    }
  ];

};
COWGraphTest.Prototype.prototype = GraphManipulationTest.prototype;
COWGraphTest.prototype = new COWGraphTest.Prototype();

module.exports = COWGraphTest;
