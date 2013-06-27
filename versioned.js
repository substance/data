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


var VersionedGraph = function(schema, graph) {
  Data.Graph.call(this, schema);
  this.chronicle = Chronicle.create();
  this.chronicle.manage(new ChronicleAdapter(this));

  if (graph) this.merge(graph);
};

VersionedGraph.__prototype__ = function() {

  var __super__ = util.prototype(this);

  this.exec = function(command) {
    var op = __super__.exec.call(this, command);
    this.chronicle.record(util.deepclone(op));
  };

  this.__exec__ = function(op) {
    if (!(op instanceof ot.ObjectOperation)) {
      op = ot.ObjectOperation.fromJSON(op);
    }
    __super__.exec.call(this, op);
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
