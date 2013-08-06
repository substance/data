"use strict";

// Import
// ========

var _ = require('underscore');
var util = require('substance-util');
var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
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

  this.setup = function() {
    this.graph = new Data.Graph(SCHEMA);
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

      this.listenTo(this.graph, "node:created", listener);

      var node = {
        id: "001",
        type: "node",
        val: "0",
        arr: ["1","2"]
      };
      this.graph.create(node);

      assert.isEqual(1, listener.called);
      assert.isObjectEqual(node, listener.args[0]);

      this.stopListening();
    },

    "Notification on Node Deletion", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "node:deleted", listener);

      this.graph.delete("foo");

      assert.isEqual(1, listener.called);
      assert.isEqual("foo", listener.args[0]);

      this.stopListening();
    },

    "Notification on Property Set", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "property:set", listener);

      this.graph.set(["foo", "val"], "bar");

      assert.isEqual(1, listener.called);
      assert.isDeepEqual([["foo", "val"], "foo", "bar"], _.toArray(listener.args));

      this.stopListening();
    },

    "Notification on Property Update", function() {
      this.setup();

      var listener = _listener();
      this.listenTo(this.graph, "property:updated", listener);

      this.graph.update(["foo", "val"], [-3, "bla"]);

      assert.isEqual(1, listener.called);
      assert.isArrayEqual(["foo", "val"],listener.args[0]);
      assert.isTrue(listener.args[1] instanceof Operator.Operation);

      this.stopListening();
    },

    "Notification with Compounds", function() {
      this.setup();

      var set_listener = _listener();
      var update_listener = _listener();

      this.listenTo(this.graph, "property:set", set_listener);
      this.listenTo(this.graph, "property:updated", update_listener);

      var ops = [
        Operator.ObjectOperation.Set(["foo", "val"], "foo", "bar"),
        Operator.ObjectOperation.Update(["foo", "val"], Operator.TextOperation.Insert(0, "bla")),
      ];
      var compound = Operator.ObjectOperation.Compound(ops);

      this.graph.apply(compound);

      assert.isEqual(1, set_listener.called);
      assert.isEqual(1, update_listener.called);

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

_.extend(GraphEventsTest.prototype, util.Events.Listener);


registerTest(['Data', 'Graph Events'], new GraphEventsTest());
