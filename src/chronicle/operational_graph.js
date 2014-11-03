'use strict';

var _ = require('underscore');
var util = require('substance-util');
var Graph = require('../graph');
var GraphError = Graph.GraphError;
var Operator = require('substance-operator');
var Chronicle = require('substance-chronicle');
var ChronicleAdapter = require('./chronicle_adapter');
var COWGraph = require('../cow_graph');

var NOP = "NOP";
var CREATE = "create";
var DELETE = 'delete';
var UPDATE = 'update';
var SET = 'set';

var OperationalGraph = function(schema, options) {
  Graph.call(this, schema, options);
  this.chronicle = null;
  this.isRecording = false;
};

OperationalGraph.Prototype = function() {

  var __super__ = Graph.prototype;

  this.startRecording = function() {
    this.isRecording = true;
  };

  this.stopRecording = function() {
    this.isRecording = false;
  };

  this.reset = function() {
    var isRecording = this.isRecording;
    if (isRecording) this.stopRecording();
    this.init();
    if (this.chronicle) {
      this.state = Chronicle.ROOT;
    }
    this.trigger("graph:reset");
    if (isRecording) this.startRecording();
  };

  this.create = function(node) {
    node = __super__.create.apply(this, arguments);
    if (node) {
      var op = new OperationalGraph.ObjectOperation({type: CREATE, path: [node.id], val: node});
      if (this.isRecording) {
        this.record(op);
      }
      this.__trigger__(op);
    }
    return node;
  };

  this.delete = function(id) {
    var node = __super__.delete.apply(this, arguments);
    if (node) {
      // in case that the returned node is a rich object
      // there should be a serialization method
      if (node.toJSON) {
        node = node.toJSON();
      }
      var op = new OperationalGraph.ObjectOperation({type: DELETE, path: [id], val: node});
      if (this.isRecording) {
        this.record(op);
      }
      this.__trigger__(op);
    }
    return node;
  };

  this.update = function(path, diff) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new GraphError("Could not resolve property with path "+JSON.stringify(path));
    }
    if (_.isArray(diff)) {
      if (prop.baseType === "string") {
        diff = Operator.TextOperation.fromSequence(prop.get(), diff);
      } else if (prop.baseType === "array") {
        diff = Operator.ArrayOperation.create(prop.get(), diff);
      } else {
        throw new GraphError("There is no convenient notation supported for this type: " + prop.baseType);
      }
    }
    if (!diff) {
      // if the diff turns out to be empty there will be no operation.
      return;
    }
    var oldValue = prop.get();
    var op = new OperationalGraph.ObjectOperation({ type: UPDATE, path: path, diff: diff, propertyType: prop.baseType });
    this.__apply__(op);
    if (this.isRecording) {
      this.record(op);
    }
    return oldValue;
  };

  this.set = function(path, newValue) {
    var oldValue = __super__.set.apply(this, arguments);
    var op = new OperationalGraph.ObjectOperation({ type: SET, path: path, original: oldValue, val: newValue });
    if (this.isRecording) {
      this.record(op);
    }
    this.__trigger__(op);
    return op;
  };

  this.enableVersioning = function(chronicle) {
    if (this.isVersioned) return;
    if (!chronicle) {
      chronicle = Chronicle.create();
    }
    this.chronicle = chronicle;
    this.chronicle.manage(new ChronicleAdapter(this));
    this.startRecording();
  };


  this.apply = function(op) {
    this.__apply__(op);
    if (this.isRecording) {
      this.record(op);
    }
  };

  // Pure graph manipulation
  // -----------------------
  //
  // Only applies the graph operation without triggering e.g., the chronicle.

  this.__apply__ = function(_op) {
    // Note: we apply compounds eagerly... i.e., all listeners will be updated after
    // each atomic change.
    var ops = Operator.Helpers.flatten(_op);
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (!(op instanceof OperationalGraph.ObjectOperation)) {
        op = OperationalGraph.ObjectOperation.fromJSON(op);
      }
      op.apply(this);
      this.updated_at = new Date();
      // And all regular listeners in second line
      this.trigger('operation:applied', op, this);
    }
  };

  this.__trigger__ = function(_op) {
    var ops = Operator.Helpers.flatten(_op);
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      this.trigger('operation:applied', op, this);
    }
  };

  this.record = function(op) {
    op.timestamp = new Date();
    this.chronicle.record(util.clone(op));
  };

};

OperationalGraph.Prototype.prototype = Graph.prototype;
OperationalGraph.prototype = new OperationalGraph.Prototype();
OperationalGraph.prototype.constructor = OperationalGraph;

OperationalGraph.ObjectOperation = function(data) {
  Operator.ObjectOperation.call(this, data);
};
OperationalGraph.ObjectOperation.Prototype = function() {
  this.apply = function(graph) {
    var prop, val;
    var isRecording = graph.isRecording;
    if (isRecording) graph.stopRecording();

    if (this.type === NOP) return;
    if (this.type === CREATE) {
      // clone here as the operations value must not be changed
      graph.create(util.clone(this.val));
    } else if (this.type === DELETE) {
      graph.delete(this.val.id);
    } else if (this.type === UPDATE) {
      prop = graph.resolve(this.path);
      val = prop.get();
      if (this.propertyType === 'object') {
        Operator.ObjectOperation.apply(this.diff, val);
      } else if (this.propertyType === 'array') {
        Operator.ArrayOperation.apply(this.diff, val);
      } else if (this.propertyType === 'string') {
        val = Operator.TextOperation.apply(this.diff, val);
        prop.set(val);
      } else {
        throw new Operator.Operation.OperationError("Unsupported type for operational update.");
      }
    } else if (this.type === SET) {
      prop = graph.resolve(this.path);
      prop.set(this.val);
    } else {
      throw new Operator.Operation.OperationError("Illegal state.");
    }
    if (isRecording) graph.startRecording();
  };
};
OperationalGraph.ObjectOperation.Prototype.prototype = Operator.ObjectOperation.prototype;
OperationalGraph.ObjectOperation.prototype = new OperationalGraph.ObjectOperation.Prototype();
OperationalGraph.ObjectOperation.prototype.constructor = OperationalGraph.ObjectOperation;

OperationalGraph.ObjectOperation.fromJSON = function(data) {
  if (data.type === "compound") {
    var ops = [];
    for (var idx = 0; idx < data.ops.length; idx++) {
      ops.push(OperationalGraph.ObjectOperation.fromJSON(data.ops[idx]));
    }
    return OperationalGraph.ObjectOperation.Compound(ops, data.data);

  } else {
    var op = new OperationalGraph.ObjectOperation(data);
    if (data.type === "update") {
      switch (data.propertyType) {
      case "string":
        op.diff = Operator.TextOperation.fromJSON(op.diff);
        break;
      case "array":
        op.diff = Operator.ArrayOperation.fromJSON(op.diff);
        break;
      default:
        throw new Error("Don't know how to deserialize this operation:" + JSON.stringify(data));
      }
    }
    return op;
  }
};

OperationalGraph.ObjectOperation.Compound = function(ops, data) {
  if (ops.length === 0) return null;
  else return new Operator.Compound(ops, data);
};

OperationalGraph.COWGraph = function(graph) {
  COWGraph.call(this, graph);

  this.chronicle = undefined;
  this.isRecording = true;
  this.ops = [];
};

OperationalGraph.COWGraph.Prototype = function() {
  // mix in everything from the regular COWGraph
  COWGraph.Prototype.call(this);

  this.record = function(op) {
    this.ops.push(op);
  };
};
OperationalGraph.COWGraph.Prototype.prototype = OperationalGraph.prototype;
OperationalGraph.COWGraph.prototype = new OperationalGraph.COWGraph.Prototype();

module.exports = OperationalGraph;
