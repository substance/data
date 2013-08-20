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

var Index = function(graph, options) {
  options = options || {};

  this.graph = graph;

  this.nodes = {};
  this.scopes = {};

  if (options.filter) {
    this.filter = options.filter;
  } else if (options.types) {
    this.filter = Index.typeFilter(graph.schema, options.types);
  }

  if (options.property) {
    this.property = options.property;
  }

  this.listenTo(graph, "operation:applied", this.onGraphChange);

  this.createIndex();
};

Index.Prototype = function() {

  // Resolves a sub-hierarchy of the index via a given path
  // --------
  //

  var _resolve = function(path) {
    var index = this;
    if (path !== null) {
      for (var i = 0; i < path.length; i++) {
        var id = path[i];
        index.scopes[id] = index.scopes[id] || { nodes: {}, scopes: {} };
        index = index.scopes[id];
      }
    }
    return index;
  };

  var _getKey = function(node) {
    var key = this.property ? node[this.property] : null;
    if (_.isString(key)) key = [key];
    return key;
  };

  // Accumulates all indexed children of the given (sub-)index
  var _collect = function(index) {
    var result = _.extend({}, index.nodes);
    _.each(index.scopes, function(child, name) {
      if (name !== "nodes") {
        _.extend(result, _collect(child));
      }
    });
    return result;
  };

  var _add = function(key, node) {
    var index = _resolve.call(this, key);
    index.nodes[node.id] = node;
  };

  var _remove = function(key, node) {
    var index = _resolve.call(this, key);
    delete index.nodes[node.id];
  };

  // Keeps the index up-to-date when the graph changes.
  // --------
  //

  this.onGraphChange = function(op) {

    var self = this;

    var adapter = {
      create: function(node) {
        if (!self.filter || self.filter(node)) {
          var key = _getKey.call(self, node);
          _add.call(self, key, node);
        }
      },
      delete: function(node) {
        if (!self.filter || self.filter(node)) {
          var key = _getKey.call(self, node);
          _remove.call(self, key, node);
        }
      },
      update: function(node, property, newValue, oldValue) {
        if ((self.property === property) && (!self.filter || self.filter(node))) {
          var key = oldValue;
          if (_.isString(key)) key = [key];
          _remove.call(self, key, node);
          key = newValue;
          if (_.isString(key)) key = [key];
          _add.call(self, key, node);
        }
      }
    };

    this.graph.cotransform(adapter, op);
  };

  // Initializes the index
  // --------
  //

  this.createIndex = function() {
    this.reset();

    var nodes = this.graph.nodes;
    _.each(nodes, function(node) {
      if (!this.filter || this.filter(node)) {
        var key = _getKey.call(this, node);
        _add.call(this, key, node);
      }
    }, this);
  };

  // Collects all indexed nodes using a given path for scoping
  // --------
  //

  this.get = function(path) {
    if (arguments.length === 0) {
      path = null;
    } else if (_.isString(path)) {
      path = [path];
    }

    var index = _resolve.call(this, path);
    var result;

    // EXPERIMENTAL: do we need the ability to retrieve indexed elements non-recursively
    // for now...
    // if so... we would need an paramater to prevent recursion
    // E.g.:
    //     if (shallow) {
    //       result = index.nodes;
    //     }
    result = _collect(index);
    return result;
  };

  this.reset = function() {
    this.nodes = {};
    this.scopes = {};
  };

  this.dispose = function() {
    this.stopListening();
  };
};

Index.prototype = _.extend(new Index.Prototype(), util.Events.Listener);

Index.typeFilter = function(schema, types) {
  return function(node) {
    var typeChain = schema.typeChain(node.type);
    for (var i = 0; i < types.length; i++) {
      if (typeChain.indexOf(types[i]) >= 0) {
        return true;
      }
    }
    return false;
  };
};

module.exports = Index;
