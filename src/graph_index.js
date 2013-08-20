var _ = require("underscore");
var util = require("substance-util");

// Creates an index for the document applying a given node filter function
// and grouping using a given key function
// --------
//
// - document: a document instance
// - filter: a function that takes a node and returns true if the node should be indexed
// - key: a function that provides a path for scoped indexing (default: returns empty path)
//

var Index = function(document, filter, key) {
  this.document = document;
  this.__index__ = {};
  this.filter = filter;
  this.key = key || function() { return null; };

  this.listenTo(document, "operation:applied", this.onGraphChange);

  this.createIndex();
};

Index.Prototype = function() {

  // Resolves a sub-hierarchy of the index via a given path
  // --------
  //

  var _resolve = function(path) {
    var index = this.__index__;
    if (path !== null) {
      for (var i = 0; i < path.length; i++) {
        var id = path[i];
        index[id] = index[id] || { __nodes__: {} };
        index = index[id];
      }
    }
    return index;
  };

  // Accumulates all indexed children of the given (sub-)index
  var _collect = function(index) {
    var result = _.extend({}, index.__nodes__);
    _.each(index, function(child, name) {
      if (name !== "__nodes__") {
        _.extend(result, _collect(child));
      }
    });
    return result;
  };

  var __add__ = function(path, node) {
    var index = _resolve.call(this, path);
    index.__nodes__[node.id] = node;
  };

  var __remove__ = function(path, node) {
    var index = _resolve.call(this, path);
    delete index.__nodes__[node.id];
  };

  // Keeps the index up-to-date when the graph changes.
  // --------
  //

  this.onGraphChange = function(op) {

    var node;
    if (op.type === "create") {
      node = op.val;
      if (this.filter(node)) {
        __add__.call(this, this.key(node), node);
      }
    }
    else if (op.type === "delete") {
      node = op.val;
      if (this.filter(node)) {
        __remove__.call(this, this.key(node), node);
      }
    }
  };

  // Initializes the index
  // --------
  //

  this.createIndex = function() {
    var nodes = this.document.nodes;
    this.__index__ = {};

    _.each(nodes, function(node) {
      if (this.filter(node)) {
        __add__.call(this, this.key(node), node);
      }
    }, this);
  };

  // Collects all indexed nodes using a given path for scoping
  // --------
  //

  this.find = function(path, shallow) {
    if (arguments.length === 0) {
      path = null;
    } else if (_.isString(path)) {
      path = [path];
    }

    var index = _resolve.call(this, path);
    var result;
    if (shallow) {
      result = index.__nodes__;
    } else {
      result = _collect(index);
    }
    return result;
  };

  this.reset = function() {
    this.__index__ = {};
  };

  this.dispose = function() {
    this.stopListening();
  };
};

Index.prototype = _.extend(new Index.Prototype(), util.Events.Listener);

Index.typeFilter = function(schema, nodeType) {
  return function(node) {
    var baseType = schema.baseType(node.type);
    return (baseType === nodeType);
  };
};

module.exports = Index;
