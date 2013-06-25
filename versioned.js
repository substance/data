(function(root) { "use_strict";

// Import
// ========

var _,
    util,
    errors,
    Chronicle,
    ot,
    Data;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  // Should be require('substance-util') in the future
  util   = require('./lib/util/util');
  errors   = require('./lib/util/errors');
  Chronicle = require('./lib/chronicle/chronicle');
  ot   = require('./lib/chronicle/lib/ot');
  Data = require('./data');

} else {
  _ = root._;
  util = root.Substance.util;
  errors   = root.Substance.errors;
  Chronicle = root.Substance.Chronicle;
  ot = Chronicle.ot;
  Data = root.Substance.Data;
}

var ChronicleAdapter = function(graph) {
  this.graph = graph;
  this.state = Chronicle.ROOT;
};

ChronicleAdapter.__prototype__ = function() {

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
      var property = this.graph.resolve(change.path);
      if (property.baseType === "string") {
        inverted.args = ot.TextOperation.fromJSON(change.args).invert();
      } else if (property.baseType === "array") {
        inverted.args = ot.ArrayOperation.fromJSON(change.args).invert();
      } else if (property.baseType === "object") {
        inverted.args = ot.ObjectOperation.fromJSON(change.args).invert();
      }
    }
    return inverted;
  };

  this.transform = function(a, b, options) {

    var path1 = (a.op === "create") ? a.path.concat([a.args.id]) : a.path;
    var path2 = (b.op === "create") ? b.path.concat([b.args.id]) : b.path;

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
      var a_t = {op: "update", path: a.path};
      var b_t = {op: "update", path: b.path};

      var property = this.graph.resolve(a.path);
      var transformed;

      // String updates
      if (property.baseType === "string") {
        transformed = ot.TextOperation.transform(a.args, b.args, options);
      }
      // Array updates
      else if (property.baseType === "array") {
        transformed = ot.ArrayOperation.transform(a.args, b.args, options);
      }
      // Object updates
      else if (property.baseType === "object") {
        transformed = ot.ArrayOperation.transform(a.args, b.args, options);
      }

      a_t.args = transformed[0];
      b_t.args = transformed[1];

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

  this.pop = function(command, property) {
    var array = property.get();
    if (array.length === 0)  return null;

    var converted = create_update(command);
    var last = _.last(array);
    converted.args = ["-", array.length-1, last];
    return converted;
  };

  this.push = function(command, property) {
    var array = property.get();
    var converted = create_update(command);
    converted.args = ["+", array.length, command.args.value];
    return converted;
  };

  this.insert = function(command, property) {
    var array = property.get();
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
    command = new Data.Command(command);

    // convert the command into a Chroniclible version
    if (converter[command.op]) {
      var item = this.resolve(command.path);
      command = converter[command.op](command, item);
    } else {
      command = command.toJSON();
    }

    // it might happen that the converter returns null as if the command was a NOP
    if (command && command.op !== "NOP") {
      command = this.__exec__(command);

      // normalize update commands
      if (command.op === "update") {

        var prop = this.resolve(command.path);
        if (prop.baseType === "string") {
          command.args = ot.TextOperation.fromJSON(command.args);

        } else if (prop.baseType === "array") {
          command.args = ot.ArrayOperation.fromJSON(command.args);

        } else if (prop.baseType === "object") {
          command.args = ot.ObjectOperation.fromJSON(command.args);
        }
      }

      this.chronicle.record(util.deepclone(command));
    }
  };

  this.__exec__ = function(command) {
    return __super__.exec.call(this, command);
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
