//     (c) 2013 Michael Aufreiter, Oliver Buchtala
//     Data.js is freely distributable under the MIT license.
//     Portions of Data.js are inspired or borrowed from Underscore.js,
//     Backbone.js and Google's Visualization API.
//     For all details and documentation:
//     http://github.com/michael/data

"use strict";

var _ = require('underscore');
var util = require('substance-util');
var errors = util.errors;

var Schema = require('./schema');
var Property = require('./property');

var Chronicle = require('substance-chronicle');
var Operator = require('substance-operator');

var PersistenceAdapter = require('./persistence_adapter');
var ChronicleAdapter = require('./chronicle_adapter');
var Index = require('./graph_index');

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

  this.objectAdapter = new Graph.ObjectAdapter(this);

  this.nodes = {};
  this.indexes = {};

  this.__mode__ = options.mode || Graph.DEFAULT_MODE;
  this.__seed__ = options.seed;

  // Note: don't init automatically after making persistent
  // as this would delete the persistet graph.
  // Instead, the application has to call `graph.load()` if the store is supposed to
  // contain a persisted graph
  this.isVersioned = !!options.chronicle;
  this.isPersistent = !!options.store;

  // Make chronicle graph
  if (this.isVersioned) {
    this.chronicle = options.chronicle;
    this.chronicle.manage(new Graph.ChronicleAdapter(this));
  }

  // Make persistent graph
  if (this.isPersistent) {
    var nodes = options.store.hash("nodes");
    this.__store__ = options.store;
    this.__nodes__ = nodes;

    if (this.isVersioned) {
      this.__version__ = options.store.hash("__version__");
    }

    this.objectAdapter = new PersistenceAdapter(this.objectAdapter, nodes);
  }

  if (options.load) {
    this.load();
  } else {
    this.init();
  }

  // Populate graph
  if (options.graph) this.merge(options.graph);
};

Graph.__prototype__ = function() {

  var _private = new Graph.Private();

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

  this.create = function(node) {
    var op = Operator.ObjectOperation.Create([node.id], node);
    return this.apply(op);
  };

  // Remove a node
  // -------------
  // Removes a node with given id and key (optional):
  //     Data.Graph.delete(this.graph.get('apple'));
  this.delete = function(id) {
    var node = this.get(id);
    if (node === undefined) {
      throw new GraphError("Could not resolve a node with id "+ id);
    }

    // in case that the returned node is a rich object
    // there should be a serialization method
    if (node.toJSON) {
      node = node.toJSON();
    }

    var op = Operator.ObjectOperation.Delete([id], node);
    return this.apply(op);
  };

  // Update the property
  // -------------------
  //
  // Updates the property with a given operation.
  // Note: the diff has to be given as an appropriate operation.
  // E.g., for string properties diff would be Operator.TextOperation,
  // for arrays it would be Operator.ArrayOperation, etc.
  // For example Substance.Operator:
  //   Data.Graph.create({
  //     id: "fruit_2",
  //     type: "fruit",
  //     name: "Blueberry",
  //     val: { form: { kind: "bar", color: "blue" }, size: "small" },
  //   })
  //   var valueUpdate = Operator.TextOperation.fromOT("bar", [1, -1, "e", 1, "ry"]);
  //   var propertyUpdate = Operator.ObjectOperation.Update(["form", "kind"], valueUpdate);
  //   var nodeUpdate = Data.Graph.update(["fruit_2", "val"], propertyUpdate);
  // Let's get it now:
  //   var blueberry = this.graph.get("fruit_2");
  //   console.log(blueberry.val.form.kind);
  //   = > 'berry'

  this.update = function(path, diff) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new GraphError("Could not resolve property with path "+JSON.stringify(path));
    }

    if (_.isArray(diff)) {
      if (prop.baseType === "string") {
        diff = Operator.TextOperation.fromSequence(prop.get(), diff);
      } else if (prop.baseType === "array") {
        diff = Operator.ArrayOperation.create(prop.get(), diff);
      } else {
        throw new GraphError("There is no convenient notation supported for this type: " + prop.baseType);
      }
    }

    if (!diff) {
      // if the diff turns out to be empty there will be no operation.
      return;
    }

    var op = Operator.ObjectOperation.Update(path, diff, prop.baseType);
    return this.apply(op);
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
    var oldValue = prop.get();
    var op = Operator.ObjectOperation.Set(path, oldValue, newValue);
    return this.apply(op);
  };

  // Pure graph manipulation
  // -----------------------
  //
  // Only applies the graph operation without triggering e.g., the chronicle.

  this.__apply__ = function(op) {
    //console.log("Graph.__apply__", op);
    op.apply(this.objectAdapter);
    this.updated_at = new Date();

    Operator.Helpers.each(op, function(_op) {
      _.each(this.indexes, function(index) {

        this.trigger('operation:applied', _op, this);

      }, this);
    }, this);
  };

  // Apply a command
  // ---------------
  //
  // Applies a graph command
  // All commands call this function internally to apply an operation to the graph

  this.apply = function(op) {

    this.__apply__(op);

    // do not record changes during initialization
    if (!this.__is_initializing__ && this.isVersioned) {
      op.timestamp = new Date();
      this.chronicle.record(util.clone(op));
    }

    return op;
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
    if (_.isString(path)) return this.nodes[path];

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
      return _private.queryArray.call(this, val, type);
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
      // schema: [this.schema.id, this.schema.version],
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
    if (this.isPersistent) {
      if (this.__nodes__) this.__nodes__.clear();
    }

    this.init();

    if (this.isVersioned) {
      this.state = Chronicle.ROOT;
    }

    this.trigger("graph:reset");
  };

  // Graph initialization.
  this.init = function() {
    this.__is_initializing__ = true;

    if (this.__seed__) {
      this.nodes = util.clone(this.__seed__.nodes);
    } else {
      this.nodes = {};
    }

    _.each(this.indexes, function(index) {
      index.reset();
    });

    if (this.isPersistent) {
      _.each(this.nodes, function(node, id) {
        this.__nodes__.set(id, node);
      }, this);
    }

    delete this.__is_initializing__;
  };

  // Merge graphs
  // ------------
  //
  // Merges this graph with another graph:
  //     var folks = new Data.Graph(folks_schema);
  //     var persons = new Data.Graph(persons_schema);
  //     folks.create({
  //       name: 'Bart',
  //       surname: 'Simpson',
  //       type: 'cartoon-actor',
  //       century: 'XXI',
  //       citizen: 'U.S.'
  //     });
  //     persons.create({
  //       name: 'Alexander',
  //       surname: 'Pushkin',
  //       type: 'poet',
  //       century: '19',
  //       citizen: 'Russia'
  //     });
  //     persons.create({
  //       name: 'Pelem Grenwill',
  //       surname: 'Woodhouse',
  //       type: 'poet',
  //       century: '19',
  //       citizen: 'Russia'
  //     });
  //     var merged = persons.merge(folks);
  //     merged.toJSON();
  //     => {
  //       nodes: [
  //         {
  //           name: 'Alexander',
  //           surname: 'Pushkin',
  //           type: 'poet',
  //           century: '19',
  //           citizen: 'Russia'
  //         },
  //         {
  //           name: 'Pelem Grenwill',
  //           surname: 'Woodhouse',
  //           type: 'poet',
  //           century: '19',
  //           citizen: 'Russia'
  //         },
  //         {
  //           name: 'Bart',
  //           surname: 'Simpson',
  //           type: 'cartoon-actor',
  //           century: 'XXI',
  //           citizen: 'U.S.'
  //         }
  //       ]
  //     }

  this.merge = function(graph) {
    _.each(graph.nodes, function(n) {
      this.create(n);
    });

    return this;
  };

  // View Traversal
  // --------------

  this.traverse = function(view) {
    return _.map(this.getView(view), function(node) {
      return this.get(node);
    }, this);
  };

  // Graph loading.
  // ----------
  //
  // Note: currently this must be called explicitely by the app

  this.load = function() {

    if (!this.isPersistent) {
      console.log("Graph is not persistent.");
      return;
    }

    this.__is_initializing__ = true;

    this.nodes = {};
    this.indexes = {};

    // import persistet nodes
    var keys = this.__nodes__.keys();
    for (var idx = 0; idx < keys.length; idx++) {
      _private.create.call(this, this.__nodes__.get(keys[idx]));
    }

    if (this.isVersioned) {
      this.state = this.__version__.get("state") || "ROOT";
    }

    delete this.__is_initializing__;

    return this;
  };

  // A helper to apply co-transformations
  // --------
  //
  // The provided adapter must conform to the interface:
  //
  //    {
  //      create: function(node) {},
  //      delete: function(node) {},
  //      update: function(node, property, newValue, oldValue) {},
  //    }
  //

  this.cotransform = function(adapter, op) {
    if (op.type === "create") {
      adapter.create(op.val);
    }
    else if (op.type === "delete") {
      adapter.delete(op.val);
    }
    // type = 'update' or 'set'
    else {

      var prop = this.resolve(op.path);
      var value = prop.get();

      var oldValue;

      // Attention: this happens when updates and deletions are within one compound
      // The operation gets applied, finally the node is deleted.
      // Listeners are triggered afterwards, so they can not rely on the node being there
      // anymore.
      // However, this is not a problem. We can ignore this update as there will come
      // a deletion anyways.
      if (value === undefined) {
        return;
      }

      if (op.type === "set") {
        oldValue = op.original;
      } else {
        oldValue = op.diff.invert().apply(_.clone(value));
      }

      adapter.update(prop.node, prop.key, value, oldValue);
    }
  };
};

// Index Modes
// ----------

Graph.STRICT_INDEXING = 1 << 1;
Graph.DEFAULT_MODE = Graph.STRICT_INDEXING;


// Private Graph implementation
// ============================

Graph.Private = function() {

  var _private = this;

  // Node construction
  // -----------------
  //
  // Safely constructs a new node based on type information
  // Node needs to have a valid type
  // All properties that are not registered, are dropped
  // All properties that don't have a value are replaced using default values for type

  this.createNode = function (schema, node) {
    if (!node.id || !node.type) {
      throw new GraphError("Can not create Node: 'id' and 'type' are mandatory.");
    }

    var type = schema.type(node.type);
    if (!type) {
      throw new GraphError("Type '"+node.type+"' not found in the schema");
    }

    var properties = schema.properties(node.type);
    var freshNode = { type: node.type, id: node.id };

    // Start constructing the fresh node
    _.each(properties, function(p, key) {
      // Find property base type
      var baseType = schema.propertyBaseType(node.type, key);

      // Assign user defined property value or use default value for baseType
      var val = (node[key] !== undefined) ? node[key] : schema.defaultValue(baseType);
      freshNode[key] = util.deepclone(val);
    });

    return freshNode;
  };

  // Create a new node
  // -----------------
  // Safely constructs a new node
  // Checks for node duplication
  // Adds new node to indexes
  this.create = function(node) {
    var newNode = _private.createNode(this.schema, node);
    if (this.contains(newNode.id)) {
      throw new GraphError("Node already exists: " + newNode.id);
    }
    this.nodes[newNode.id] = newNode;
    this.trigger("node:created", newNode);
    return this;
  };

  // Remove a node
  // -----------
  // Deletes node by id, referenced nodes remain untouched
  // Removes node from indexes
  this.delete = function(node) {
    delete this.nodes[node.id];
    this.trigger("node:deleted", node.id);
  };

  this.set = function(path, value) {
    var property = this.resolve(path);
    var oldValue = util.deepclone(property.get());
    property.set(value);
    this.trigger("property:set", path, oldValue, value);
  };

  var _triggerPropertyUpdate = function(path, diff) {
    Operator.Helpers.each(diff, function(op) {
      this.trigger('property:updated', path, op, this);
    }, this);
  };

  this.update = function(path, value, diff) {
    var property = this.resolve(path);
    property.set(value);
    _triggerPropertyUpdate.call(this, path, diff);
  };

  this.queryArray = function(arr, type) {
    if (!_.isArray(type)) {
      throw new GraphError("Illegal argument: array types must be specified as ['array'(, 'array')*, <type>]");
    }
    var result, idx;
    if (type[1] === "array") {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(_private.queryArray.call(this, arr[idx], type.slice(1)));
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

Graph.prototype = _.extend(new Graph.__prototype__(), util.Events);

// ObjectOperation Adapter
// ========
//
// This adapter delegates object changes as supported by Operator.ObjectOperation
// to graph methods

Graph.ObjectAdapter = function(graph) {
  this.graph = graph;
};

Graph.ObjectAdapter.__prototype__ = function() {
  var impl = new Graph.Private();

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

  this.update = function(path, value, diff) {
    impl.update.call(this.graph, path, value, diff);
  };

  this.delete = function(__, value) {
    // Note: only nodes (top-level) can be deleted
    impl.delete.call(this.graph, value);
  };

  this.inplace = function() { return false; };
};

Graph.ObjectAdapter.__prototype__.prototype = Operator.ObjectOperation.Object.prototype;
Graph.ObjectAdapter.prototype = new Graph.ObjectAdapter.__prototype__();

Graph.Schema = Schema;
Graph.Property = Property;

Graph.PersistenceAdapter = PersistenceAdapter;
Graph.ChronicleAdapter = ChronicleAdapter;
Graph.Index = Index;

// Exports
// ========

module.exports = Graph;
