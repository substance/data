"use strict";

// Import
// ========

var _ = require('underscore');
var util = require('substance-util');
var Test = require('substance-test');
var assert = Test.assert;
var Data = require('../index');
var Operator = require('substance-operator');


var SCHEMA = {
  types: {
    node: {
      properties: {
        val: ["string"],
        arr: ["array", "string"]
      }
    }
  }
};

// Test
// ========

var GraphEventsTest = function() {
  Test.call(this);
};

GraphEventsTest.Prototype = function() {

  _.extend(this, util.Events.Listener);

  this.setup = function() {
    this.graph = new Data.OperationalGraph(SCHEMA);
    this.schema = this.graph.schema;

    this.graph.create({
      id: "foo",
      type: "node",
      val: "foo",
      arr: ["bla","blupp"]
    });
  };

  function _listener() {
    var call_me = function() {
      call_me.called++;
      call_me.args = arguments;
    };
    call_me.called = 0;
    call_me.args = undefined;

    return call_me;
  }

  this.actions = [

    "Notification on Node Creation", function() {
      this.setup();

      var listener = _listener();

      this.listenTo(this.graph, "operation:applied", listener);

      var node = {
        id: "001",
        type: "node",
        val: "0",
        arr: ["1","2"]
      };
      this.graph.create(node);

      assert.isEqual(1, listener.called);
      var op = listener.args[0];
      assert.isEqual("create", op.type);
      assert.isArrayEqual([node.id], op.path);
      assert.isObjectEqual(node, op.val);

      this.stopListening();
    },

    "Notification on Node Deletion", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "operation:applied", listener);

      this.graph.delete("foo");

      assert.isEqual(1, listener.called);
      var op = listener.args[0];
      assert.isArrayEqual(["foo"], op.path);

      this.stopListening();
    },

    "Notification on Property Set", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "operation:applied", listener);

      this.graph.set(["foo", "val"], "bar");

      assert.isEqual(1, listener.called);
      var op = listener.args[0];
      assert.isArrayEqual(["foo", "val"], op.path);
      assert.isEqual("foo", op.original);
      assert.isEqual("bar", op.val);

      this.stopListening();
    },

    "Notification on Property Update", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "operation:applied", listener);

      var str = this.graph.get(["foo", "val"]);
      // Attention: these are actuall two atomic operations: Delete + Insert
      // Thus the listener is called twice
      this.graph.update(["foo", "val"], Operator.TextOperation.Delete(0, 'foo'));
      this.graph.update(["foo", "val"], Operator.TextOperation.Insert(0, 'bar'));

      assert.isEqual(2, listener.called);

      this.stopListening();
    },

    "Notification with Compounds", function() {
      this.setup();

      var update_listener = _listener();

      this.listenTo(this.graph, "operation:applied", update_listener);

      var ops = [
        Operator.ObjectOperation.Set(["foo", "val"], "foo", "bar"),
        Operator.ObjectOperation.Update(["foo", "val"], Operator.TextOperation.Insert(0, "bla")),
      ];
      var compound = Operator.ObjectOperation.Compound(ops);

      this.graph.apply(compound);

      assert.isEqual(2, update_listener.called);

      this.stopListening();
    },

    "Generic Operation Notification", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "operation:applied", listener);

      this.graph.set(["foo", "val"], "bar");

      assert.isEqual(1, listener.called);
      assert.isTrue(listener.args[0] instanceof Operator.Operation);

      this.stopListening();
    },

    "Generic Operation Notification with Compounds", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "operation:applied", listener);

      var ops = [
        Operator.ObjectOperation.Set(["foo", "val"], "foo", "bar"),
        Operator.ObjectOperation.Update(["foo", "val"], Operator.TextOperation.Insert(0, "bla")),
      ];
      var compound = Operator.ObjectOperation.Compound(ops);

      this.graph.apply(compound);

      assert.isEqual(2, listener.called);

      this.stopListening();
    }
  ];
};
GraphEventsTest.Prototype.prototype = Test.prototype;
GraphEventsTest.prototype = new GraphEventsTest.Prototype();

module.exports = GraphEventsTest;
