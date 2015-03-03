'use strict';

var Substance = require('substance');

var Data = require('./data');
var Operator = require('substance-operator');
var Chronicle = require('substance-chronicle');
var ChronicleAdapter = require('./chronicle_adapter');

var NOP = "NOP";
var CREATE = "create";
var DELETE = 'delete';
var UPDATE = 'update';
var SET = 'set';

var VersionedData = function(nodeFactory, seed) {
  Data.call(this, nodeFactory, seed);
  this.chronicle = Chronicle.create();
  this.isRecording = false;
  this.chronicle.manage(new ChronicleAdapter(this));
  this.startRecording();
};

VersionedData.Prototype = function() {

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
    if (isRecording) this.startRecording();
  };

  this.create = function(node) {
    node = this._super.create.apply(this, arguments);
    if (node) {
      var op = new VersionedData.ObjectOperation({type: CREATE, path: [node.id], val: node});
      if (this.isRecording) {
        this.record(op);
      }
      this.notifyOperation(op);
    }
    return node;
  };

  this.delete = function(id) {
    var node = this._super.delete.apply(this, arguments);
    if (node) {
      // in case that the returned node is a rich object
      // there should be a serialization method
      if (node.toJSON) {
        node = node.toJSON();
      }
      var op = new VersionedData.ObjectOperation({type: DELETE, path: [id], val: node});
      if (this.isRecording) {
        this.record(op);
      }
      this.notifyOperation(op);
    }
    return node;
  };

  this.update = function(path, diff) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new Error("Could not resolve property with path "+JSON.stringify(path));
    }
    if (Substance.isArray(diff)) {
      if (prop.baseType === "string") {
        diff = Operator.TextOperation.fromSequence(prop.get(), diff);
      } else if (prop.baseType === "array") {
        diff = Operator.ArrayOperation.create(prop.get(), diff);
      } else {
        throw new Error("There is no convenient notation supported for this type: " + prop.baseType);
      }
    }
    if (!diff) {
      // if the diff turns out to be empty there will be no operation.
      return;
    }
    var oldValue = prop.get();
    var op = new VersionedData.ObjectOperation({ type: UPDATE, path: path, diff: diff, propertyType: prop.baseType });
    this.__apply__(op);
    if (this.isRecording) {
      this.record(op);
    }
    return oldValue;
  };

  this.set = function(path, newValue) {
    var oldValue = this._super.set.apply(this, arguments);
    var op = new VersionedData.ObjectOperation({ type: SET, path: path, original: oldValue, val: newValue });
    if (this.isRecording) {
      this.record(op);
    }
    this.__trigger__(op);
    return op;
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
    var ops = Operator.Helpers.flatten(_op);
    var changes = new VersionedData.ChangeMap();
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (!(op instanceof VersionedData.ObjectOperation)) {
        op = VersionedData.ObjectOperation.fromJSON(op);
      }
      op.apply(this);
      this.updated_at = new Date();

      this._updateIndexes(op);

      var path;
      if (op.type === "create" || op.type === "delete") {
        path = [op.val.id];
      } else {
        path = op.path;
      }
      changes.push(path, op);

      // And all regular listeners in second line
      this.trigger('operation:applied', op, this);
    }
    this.trigger('graph:changed', changes);
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
    this.chronicle.record(Substance.clone(op));
  };
};

Substance.inherit(VersionedData, Data);

VersionedData.ObjectOperation = function(data) {
  Operator.ObjectOperation.call(this, data);
};
VersionedData.ObjectOperation.Prototype = function() {
  this.apply = function(graph) {
    var isRecording = graph.isRecording;
    if (isRecording) graph.stopRecording();

    if (this.type === NOP) return;
    if (this.type === CREATE) {
      // clone here as the operations value must not be changed
      graph.create(Substance.clone(this.val));
    } else if (this.type === DELETE) {
      graph.delete(this.val.id);
    } else if (this.type === UPDATE) {
      var val = graph.nodes.get(this.path);
      if (this.propertyType === 'object') {
        Operator.ObjectOperation.apply(this.diff, val);
      } else if (this.propertyType === 'array') {
        Operator.ArrayOperation.apply(this.diff, val);
      } else if (this.propertyType === 'string') {
        val = Operator.TextOperation.apply(this.diff, val);
        graph.nodes.set(this.path, val);
      } else {
        throw new Error("Unsupported type for operational update.");
      }
    } else if (this.type === SET) {
      graph.nodes.set(this.path, this.val);
    } else {
      throw new Error("Illegal state.");
    }
    if (isRecording) graph.startRecording();
  };
};

Substance.inherit(VersionedData, Operator.ObjectOperation);

VersionedData.ObjectOperation.fromJSON = function(data) {
  var op = new VersionedData.ObjectOperation(data);
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
};


module.exports = VersionedData;
