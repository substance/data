(function(root) { "use_strict";

// Import
// ========

var _,
    ot,
    util,
    errors,
    Chronicle,
    ArrayOperation,
    TextOperation,
    Data;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  ot   = require('./lib/operation');
  // Should be require('substance-util') in the future
  util   = require('./lib/util/util');
  errors   = require('./lib/util/errors');
  Chronicle = require('./lib/chronicle/chronicle');
  Data = require('./data');

} else {
  _ = root._;
  ot = root.ot;
  util = root.Substance.util;
  errors   = root.Substance.errors;
  Chronicle = root.Substance.Chronicle;
  Data = root.Data;
}

ArrayOperation = Chronicle.OT.ArrayOperation;
TextOperation = Chronicle.OT.TextOperation;

var Converter;

var VersionedGraph = function(schema) {
  Data.Graph.call(this, schema);

  this.chronicle = Chronicle.create();
  this.adapter = new VersionedGraph.ChronicleAdapter(this);
  this.chronicle.manage(this.adapter);

};

VersionedGraph.__prototype__ = function() {

  var __super__ = util.prototype(this);
  var converter = new ChronicleAdapter.Converter();

  this.exec = function(command) {

    if (!command || command.op === "NOP") return;

    // parse the command to have a normalized representation
    command = new Data.Graph.Command(command);
    // convert the command into a Chroniclible version
    if (converter[command.op]) {
      var item = this.resolve(command.path);
      command = converter[command.op](command, item);
    }

    // it might happen that the converter returns null as if the command was a NOP
    if (command && command.op !== "NOP") {
      this.__exec__(converted);
      this.chronicle.record(command);
    }
  };

  this.__exec__ = function(command) {
    __super__.exec(command);
  }

};

VersionedGraph.__prototype__.prototype = Data.Graph.prototype;
VersionedGraph.prototype = new VersionedGraph.__prototype__();

// Adapter

var ChronicleAdapter = function(graph) {
  this.graph = graph;
};

ChronicleAdapter.__prototype__ = function() {

  var __super__ = util.prototype(this);

  // Note: there are only "create", "delete", and "update" after conversion
  this.apply = function(change) {
    this.graph.__exec__(change);
  };

  this.invert = function(change) {
    var inverted = change.copy();

    if (change.op === "create") {
      inverted.op = "delete";
    }
    else if (change.op === "delete") {
      inverted.op = "create";
    }
    else if (change.op === "update") {
      var property = new Data.Graph.Property(this.graph, change.path);
      if (property.type === "string") {
        inverted.args = TextOperation.fromJSON(change.args).invert().toJSON();
      } else if (property.type === "array") {
        inverted.args = ArrayOperation.fromJSON(change.args).invert().toJSON();
      }
    }

    return inverted;
  };

  this.transform = function(a, b, options) {

    var path1 = (a.op === "create") ? a.path.concat([a.args.id]) : a.path;
    var path2 = (b.op === "create") ? b.path.concat([a.args.id]) : b.path;

    // operations on different elements do not need to be transformed
    if (!_.isEqual(path1, path2)) return [a, b];

    // 'create' commands can not be transformed, as an element can only be created once.
    // Note: transform is used to merge other changes into the branch.
    // Merging such a change leads to inconsistencies, e.g., delete before creation or alike.
    // So it is ok and desired to fail in this case.
    if (a.op === "create" || b.op === "create") {
      throw new errors.SubstanceError("'insert' commands can not be transformed");
    }

    // 'update' after 'delete' is turned into a NOP
    if (a.op === "delete" && b.op === "update") {
      return [a, {op: "NOP"}];
    } else if (a.op === "update" && b.op === "delete") {
      return [{op: "NOP"}, b];
    }

    // 'delete'/'delete' are turned into a NOP/NOP
    else if (a.op === "delete" && b.op === "delete") {
      return [{op: "NOP"}, {op: "NOP"}];
    }

    else if (a.op === "update" && b.op === "update") {
      var a_t = a.copy();
      var b_t = b.copy();
      var type = a.args.type;

      var op1, op2, transformed;
      if (type === "string") {
        op1 = TextOperation.fromJSON(a.args.diff);
        op2 = TextOperation.fromJSON(b.args.diff);
        transformed = TextOperation.transform(op1, op2);
      } else if (type === "array") {
        op1 = ArrayOperation.fromJSON(a.args.diff);
        op2 = ArrayOperation.fromJSON(b.args.diff);
        transformed = ArrayOperation.transform(op1, op2);
      }
      a_t.args.diff = transformed[0].toJSON();
      return [{op: "NOP"}, {op: "NOP"}];

    } else {
      throw new errors.SubstanceError("Illegal state.");
    }
  };

  this.reset = function() {
    __super__.reset.call(this);
    this.graph.reset();
  };

};
ChronicleAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
ChronicleAdapter.prototype = new ChronicleAdapter.__prototype__();
VersionedGraph.ChronicleAdapter = ChronicleAdapter;

// Converter

ChronicleAdapter.Converter = function() {

  function create_update(command) {
    var converted = {
      op: "update",
      path: command.path.slice(0),
    };
    return converted;
  }

  // Note: delete commands need to be augmented with the
  // node's data to allow command inversion
  this.delete = function(command, node) {
    return {
      op: "delete",
      path: [],
      args: node.toJSON()
    };
  }

  this.pop = function(command, array) {
    if (array.length === 0)  return null;

    var converted = create_update(command);
    var last = _.last(array);
    converted.args = {
      type: "array",
      diff: ["-", array.length-1, last];
    };
    return converted;
  };

  this.push = function(command, array) {
    var converted = create_update(command);
    converted.args = {
      type: "array",
      diff: ["+", array.length, command.args.value];
    };
    return converted;
  };

  this.insert = function(command, array) {
    var converted = create_update(command);
    converted.args = {
      type: "array",
      diff: ["+", array.length, command.args.value];
    };
    return converted;
  };

};


if (typeof exports === 'undefined') {
  root.Data.VersionedGraph = VersionedGraph;
} else {
  module.exports = VersionedGraph;
}

})(this);
