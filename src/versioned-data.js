'use strict';

var Substance = require('substance');

var Data = require('./data');
var Operator = require('substance-operator');
var ObjectOperation = Operator.ObjectOperation;
var ArrayOperation = Operator.ArrayOperation;
var TextOperation = Operator.TextOperation;
var Chronicle = require('substance-chronicle');
var ChronicleAdapter = require('./chronicle_adapter');

var VersionedData = function(options) {
  Data.call(this, options);

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
    if (this.contains(node.id)) {
      throw new Error("Node already exists: " + node.id);
    }
    if (!node.id || !node.type) {
      throw new Error("Node id and type are mandatory.");
    }
    // TODO:
    var op = ObjectOperation.Create([node.id], node);
    this.apply(op);
    return this.get(node.id);
  };

  this.delete = function(id) {
    var node = this.get(id);
    if (node) {
      // in case that the returned node is a rich object
      // there should be a serialization method
      if (node.toJSON) { node = node.toJSON(); }
      var op = ObjectOperation.Delete([id], node);
      this.apply(op);
    }
    return node;
  };

  this.update = function(path, diff) {
    var oldValue = this.get(path);
    var op = ObjectOperation.Update(path, diff);
    this.apply(op);
    return oldValue;
  };

  this.set = function(path, newValue) {
    var oldValue = this.get(path);
    var op = ObjectOperation.Set(path, oldValue, newValue);
    this.apply(op);
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

  this.__apply__ = function(op) {
    if (op.type === ObjectOperation.NOP) return;
    else if (op.type === ObjectOperation.CREATE) {
      // clone here as the operations value must not be changed
      this._super.create.call(this, Substance.clone(op.val));
    } else if (op.type === ObjectOperation.DELETE) {
      this._super.delete.call(this, op.val.id);
    } else if (op.type === ObjectOperation.UPDATE) {
      var oldVal = this.get(op.path);
      var diff = op.diff;
      if (op.propertyType === 'array') {
        if (! (diff instanceof ArrayOperation) ) {
          diff = ArrayOperation.fromJSON(diff);
        }
        // array ops work inplace
        diff.apply(oldVal);
      } else if (op.propertyType === 'string') {
        if (! (diff instanceof TextOperation) ) {
          diff = TextOperation.fromJSON(diff);
        }
        var newVal = diff.apply(oldVal);
        this._super.set.call(this, op.path, newVal);
      } else {
        throw new Error("Unsupported type for operational update.");
      }
    } else if (op.type === ObjectOperation.SET) {
      this._super.set.call(this, op.path, op.val);
    } else {
      throw new Error("Illegal state.");
    }
    this.emit('operation:applied', op, this);
  };

  this.record = function(op) {
    op.timestamp = new Date();
    this.chronicle.record(Substance.clone(op));
  };
};

Substance.inherit(VersionedData, Data);

module.exports = VersionedData;
