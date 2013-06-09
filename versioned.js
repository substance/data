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
  Data = root.Substance.Data;
}

ArrayOperation = Chronicle.OT.ArrayOperation;
TextOperation = Chronicle.OT.TextOperation;

var ChronicleAdapter = function(graph) {
  this.graph = graph;
  this.state = Chronicle.ROOT;
};

ChronicleAdapter.__prototype__ = function() {

  var __super__ = util.prototype(this);

  // Note: there are only "create", "delete", and "update" after conversion
  this.apply = function(change) {
    this.graph.__exec__(change);
  };

  this.invert = function(change) {
    var inverted = util.deepclone(change);

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
    }
    // ... and vice versa
    else if (a.op === "update" && b.op === "delete") {
      return [{op: "NOP"}, b];
    }

    // 'delete'/'delete' are turned into a NOP/NOP
    else if (a.op === "delete" && b.op === "delete") {
      return [{op: "NOP"}, {op: "NOP"}];
    }

    else if (a.op === "update" && b.op === "update") {
      var a_t = a.copy();
      var b_t = b.copy();
      var property = new Data.Graph.Property(this.graph, a.path);
      var op1, op2, transformed;

      // String updates

      if (property.type === "string") {
        op1 = TextOperation.fromJSON(a.args);
        op2 = TextOperation.fromJSON(b.args);
        transformed = TextOperation.transform(op1, op2, options);
      }

      // Array updates

      else if (property.type === "array") {
        op1 = ArrayOperation.fromJSON(a.args);
        op2 = ArrayOperation.fromJSON(b.args);
        transformed = ArrayOperation.transform(op1, op2, options);
      }

      a_t.args = transformed[0].toJSON();
      b_t.args = transformed[1].toJSON();

      return [a_t, b_t];

    } else {
      throw new errors.SubstanceError("Illegal state.");
    }

  };

  this.reset = function() {
    this.graph.reset();
  };

};

ChronicleAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
ChronicleAdapter.prototype = new ChronicleAdapter.__prototype__();

var Converter = function() {

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
      args: util.deepclone(node)
    };
  };

  this.pop = function(command, array) {
    if (array.length === 0)  return null;

    var converted = create_update(command);
    var last = _.last(array);
    converted.args = ["-", array.length-1, last];
    return converted;
  };

  this.push = function(command, array) {
    var converted = create_update(command);
    converted.args = ["+", array.length, command.args.value];
    return converted;
  };

  this.insert = function(command, array) {
    var converted = create_update(command);
    converted.args = ["+", array.length, command.args.value];
    return converted;
  };

};

var VersionedGraph = function(schema) {
  Data.Graph.call(this, schema);

  this.chronicle = Chronicle.create();
  this.chronicle.manage(new ChronicleAdapter(this));

};

VersionedGraph.__prototype__ = function() {

  var __super__ = util.prototype(this);
  var converter = new Converter();

  this.exec = function(command) {

    if (!command || command.op === "NOP") return;

    // parse the command to have a normalized representation
    command = new Data.Graph.Command(command);

    // convert the command into a Chroniclible version
    if (converter[command.op]) {
      var item = this.resolve(command.path);
      command = converter[command.op](command, item);
    } else {
      command = command.toJSON();
    }

    // it might happen that the converter returns null as if the command was a NOP
    if (command && command.op !== "NOP") {
      this.__exec__(command);
      this.chronicle.record(util.deepclone(command));
    }
  };

  this.__exec__ = function(command) {
    __super__.exec.call(this, command);
  };

  this.reset = function() {
    __super__.reset.call(this);
    this.chronicle.versioned.state = Chronicle.ROOT;
  };

};

VersionedGraph.__prototype__.prototype = Data.Graph.prototype;
VersionedGraph.prototype = new VersionedGraph.__prototype__();


if (typeof exports === 'undefined') {
  root.Substance.Data.VersionedGraph = VersionedGraph;
} else {
  module.exports = VersionedGraph;
}

})(this);
