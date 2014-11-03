"use strict";

var _ = require('underscore');
var util = require('substance-util');
var errors = util.errors;

var Schema = require('./schema');
var Property = require('./property');
var Index = require('./index/graph_index');

var GraphError = errors.define("GraphError");

// Data types registry
// -------------------
// Available data types for graph properties.

var VALUE_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'date'
];

// Check if composite type is in types registry.
// The actual type of a composite type is the first entry
// I.e., ["array", "string"] is an array in first place.
var isValueType = function (type) {
  if (_.isArray(type)) {
    type = type[0];
  }
  return VALUE_TYPES.indexOf(type) >= 0;
};

// Graph
// =====

// A `Graph` can be used for representing arbitrary complex object
// graphs. Relations between objects are expressed through links that
// point to referred objects. Graphs can be traversed in various ways.
// See the testsuite for usage.
//
// Need to be documented:
// @options (mode,seed,chronicle,store,load,graph)
var Graph = function(schema, options) {
  options = options || {};
  // Initialization
  this.schema = new Schema(schema);
  // Check if provided seed conforms to the given schema
  // Only when schema has an id and seed is provided
  if (this.schema.id && options.seed && options.seed.schema) {
    if (!_.isEqual(options.seed.schema, [this.schema.id, this.schema.version])) {
      throw new GraphError([
        "Graph does not conform to schema. Expected: ",
        this.schema.id+"@"+this.schema.version,
        " Actual: ",
        options.seed.schema[0]+"@"+options.seed.schema[1]
      ].join(''));
    }
  }
  this.nodes = {};
  this.indexes = {};
  this.__seed__ = options.seed;

  this.init();
};

Graph.Prototype = function() {

  // Graph manipulation API
  // ======================

  // Add a new node
  // --------------
  // Adds a new node to the graph
  // Only properties that are specified in the schema are taken:
  //     var node = {
  //       id: "apple",
  //       type: "fruit",
  //       name: "My Apple",
  //       color: "red",
  //       val: { size: "big" }
  //     };
  // Create new node:
  //     Data.Graph.create(node);
  // Note: graph create operation should reject creation of duplicate nodes.

  _.extend(this, util.Events);

  this.create = function(node) {
    this.schema.prepareNode(node);
    if (this.contains(node.id)) {
      throw new GraphError("Node already exists: " + node.id);
    }
    this.nodes[node.id] = node;
    this._updateIndexes({
      type: 'create',
      path: [node.id],
      val: node
    });
    return node;
  };

  // Remove a node
  // -------------
  // Removes a node with given id and key (optional):
  //     Data.Graph.delete(this.graph.get('apple'));
  this.delete = function(id) {
    var oldVal = this.nodes[id];
    this._delete(id);
    this._updateIndexes({
      type: 'delete',
      path: [id],
      val: oldVal
    });
    return oldVal;
  };

  this._delete = function(id) {
    delete this.nodes[id];
  };

  // Set the property
  // ----------------
  //
  // Sets the property to a given value:
  // Data.Graph.set(["fruit_2", "val", "size"], "too small");
  // Let's see what happened with node:
  //     var blueberry = this.graph.get("fruit_2");
  //     console.log(blueberry.val.size);
  //     = > 'too small'

  this.set = function(path, newValue) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new GraphError("Could not resolve property with path "+JSON.stringify(path));
    }
    var oldVal = prop.get();
    prop.set(newValue);
    this._updateIndexes({
      type: 'set',
      path: path,
      val: newValue,
      original: oldVal
    });
    return oldVal;
  };

  this.update = function(path, diffOp) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new GraphError("Could not resolve property with path "+JSON.stringify(path));
    }
    var oldValue = prop.get();
    var newValue = diffOp.apply(oldValue);
    prop.set(newValue);
    this._updateIndexes({
      type: 'set',
      path: path,
      val: newValue,
      original: oldValue
    });
    return oldValue;
  };

  // Get the node [property]
  // -----------------------
  //
  // Gets specified graph node using id:
  //  var apple = this.graph.get("apple");
  //  console.log(apple);
  //  =>
  //  {
  //    id: "apple",
  //    type: "fruit",
  //    name: "My Apple",
  //    color: "red",
  //    val: { size: "big" }
  //  }
  // or get node's property:
  //  var apple = this.graph.get(["apple","color"]);
  //  console.log(apple);
  //  => 'red'

  this.get = function(path) {
    if (!_.isArray(path) && !_.isString(path)) {
      throw new GraphError("Invalid argument path. Must be String or Array");
    }
    if (arguments.length > 1) path = _.toArray(arguments);
    // simple usage: return the node with given id
    if (_.isString(path)) return this.nodes[path];
    // via path: resolve the property
    var prop = this.resolve(path);
    return prop.get();
  };

  // Query graph data
  // ----------------
  //
  // Perform smart querying on graph
  //     graph.create({
  //       id: "apple-tree",
  //       type: "tree",
  //       name: "Apple tree"
  //     });
  //     var apple = this.graph.get("apple");
  //     apple.set({["apple","tree"], "apple-tree"});
  // let's perform query:
  //     var result = graph.query(["apple", "tree"]);
  //     console.log(result);
  //     => [{id: "apple-tree", type: "tree", name: "Apple tree"}]

  this.query = function(path) {
    var prop = this.resolve(path);

    var type = prop.type;
    var baseType = prop.baseType;
    var val = prop.get();

    // resolve referenced nodes in array types
    if (baseType === "array") {
      return this._queryArray.call(this, val, type);
    } else if (!isValueType(baseType)) {
      return this.get(val);
    } else {
      return val;
    }
  };

  // Serialize current state
  // -----------------------
  //
  // Convert current graph state to JSON object

  this.toJSON = function() {
    return {
      id: this.id,
      schema: [this.schema.id, this.schema.version],
      nodes: util.deepclone(this.nodes)
    };
  };

  // Check node existing
  // -------------------
  //
  // Checks if a node with given id exists
  //     this.graph.contains("apple");
  //     => true
  //     this.graph.contains("orange");
  //     => false

  this.contains = function(id) {
    return (!!this.nodes[id]);
  };

  // Resolve a property
  // ------------------
  // Resolves a property with a given path

  this.resolve = function(path) {
    return new Property(this, path);
  };

  // Reset to initial state
  // ----------------------
  // Resets the graph to its initial state.
  // Note: This clears all nodes and calls `init()` which may seed the graph.

  this.reset = function() {
    this.init();
    this.trigger("graph:reset");
  };

  // Graph initialization.
  this.init = function() {
    if (this.__seed__) {
      this.nodes = util.clone(this.__seed__.nodes);
    } else {
      this.nodes = {};
    }
    _.each(this.indexes, function(index) {
      index.reset();
    });
  };

  this.addIndex = function(name, options) {
    if (this.indexes[name]) {
      throw new GraphError("Index with name " + name + "already exists.");
    }
    var index = new Index(this, options);
    this.indexes[name] = index;

    return index;
  };

  this.removeIndex = function(name) {
    delete this.indexes[name];
  };

  this._updateIndexes = function(op) {
    _.each(this.indexes, function(index) {
      if (!op) {
        index.rebuild();
      } else {
        index.onGraphChange(op);
      }
    }, this);
  };

  this._queryArray = function(arr, type) {
    if (!_.isArray(type)) {
      throw new GraphError("Illegal argument: array types must be specified as ['array'(, 'array')*, <type>]");
    }
    var result, idx;
    if (type[1] === "array") {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(this._queryArray(arr[idx], type.slice(1)));
      }
    } else if (!isValueType(type[1])) {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(this.get(arr[idx]));
      }
    } else {
      result = arr;
    }
    return result;
  };

};

// Index Modes
// ----------

Graph.STRICT_INDEXING = 1 << 1;
Graph.DEFAULT_MODE = Graph.STRICT_INDEXING;


Graph.prototype = new Graph.Prototype();

Graph.Schema = Schema;
Graph.Property = Property;
Graph.Index = Index;

// Exports
// ========

module.exports = Graph;
