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
    return ot.ObjectOperation.fromJSON(change).invert();
  };

  this.transform = function(a, b, options) {
    return ot.ObjectOperation.transform(a, b, options);
  };

  this.reset = function() {
    this.graph.reset();
  };
};

ChronicleAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
ChronicleAdapter.prototype = new ChronicleAdapter.__prototype__();


var VersionedGraph = function(schema) {
  Data.Graph.call(this, schema);
  this.chronicle = Chronicle.create();
  this.chronicle.manage(new ChronicleAdapter(this));

  this.__object__ = new VersionedGraph.Object(this);
};

VersionedGraph.__prototype__ = function() {

  var __super__ = util.prototype(this);

  this.exec = function(command) {

    if (!command || command.op === "NOP") return;

    // parse the command to have a normalized representation
    // TODO: need to map convenience operations to atomic graph commands
    command = new Data.Command(command);

    var op, id;
    // Note: we convert the Data.Commands to ObjectOperations

    if (command.op === "create") {
      id = command.args.id;
      // Note: in this case the path must be empty, as otherwise the property lookup
      // claims due to the missing data
      op = ot.ObjectOperation.Create([id], command.args);
    }
    else if (command.op === "delete") {
      id = command.args.id;
      var node = this.get(id);
      // Note: OTOH, in this case the path must be set to the node id
      // as ObjectOperation will check if the value is correct
      op = ot.ObjectOperation.Delete([id], node);
    }
    else if (command.op === "update") {
      op = ot.ObjectOperation.Update(command.path, command.args);
    }
    else if (command.op === "set") {
      var prop = this.resolve(command.path);
      op = ot.ObjectOperation.Set(command.path, prop.get(), command.args);
    }

    this.__exec__(op);
    this.chronicle.record(util.deepclone(op));
  };

  this.__exec__ = function(op) {
    if (!(op instanceof ot.ObjectOperation)) {
      op = ot.ObjectOperation.fromJSON(op);
    }
    op.apply(this.__object__);
  };

  this.reset = function() {
    __super__.reset.call(this);
    this.chronicle.versioned.state = Chronicle.ROOT;
  };

};
VersionedGraph.__prototype__.prototype = Data.Graph.prototype;
VersionedGraph.prototype = new VersionedGraph.__prototype__();

VersionedGraph.Object = function(graph) {
  this.graph = graph;
};
VersionedGraph.Object.__prototype__ = function () {
  var impl = new Data.Graph.Impl();

  this.get = function(path) {
    var prop = this.graph.resolve(path);
    return prop.get();
  };

  this.create = function(__, value) {
    // Note: only nodes (top-level) can be created
    impl.create.call(this.graph, value);
  };

  this.set = function(path, value) {
    impl.set.call(this.graph, path, value);
  };

  this.delete = function(__, value) {
    // Note: only nodes (top-level) can be deleted
    impl.delete.call(this.graph, value);
  };
};
VersionedGraph.Object.__prototype__.prototype = ot.ObjectOperation.Object.prototype;
VersionedGraph.Object.prototype = new VersionedGraph.Object.__prototype__();

if (typeof exports === 'undefined') {
  root.Substance.Data.VersionedGraph = VersionedGraph;
} else {
  module.exports = VersionedGraph;
}

})(this);
