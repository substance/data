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
var PropertyChangeAdapter = require('./property_changes');

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

  var _triggerGraphChange = function(objOp) {
    if (objOp.type === Operator.Compound.TYPE) {
      for (var idx = 0; idx < objOp.ops.length; idx++) {
        _triggerGraphChange.call(this, objOp.ops[idx]);
      }
    } else {
      this.trigger('operation:applied', objOp, this);
    }
  };


  // Pure graph manipulation
  // -----------------------
  // 
  // Only applies the graph operation without triggering e.g., the chronicle.

  this.__apply__ = function(op) {
    //console.log("Graph.__apply__", op);
    op.apply(this.objectAdapter);
    this.updated_at = new Date();

    _triggerGraphChange.call(this, op);
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

    this.nodes = {};
    this.indexes = {};
    _private.initIndexes.call(this);

    if (this.__seed__) {
      this.nodes = util.clone(this.__seed__.nodes);
      _.each(this.nodes, function(n) {
        _private.addToIndex.call(this, n);
      }, this);
    }

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

  // Find nodes
  // ----------
  // 
  // Find data nodes based on index

  this.find = function(index, scope) {
    var indexes = this.indexes;
    var self = this;

    function wrap(nodeIds) {
      return _.map(nodeIds, function(n) {
        return self.get(n);
      });
    }

    if (!indexes[index]) return []; // throw index-not-found error instead?
    if (_.isArray(indexes[index])) return wrap(indexes[index]);
    if (!indexes[index][scope]) return [];

    return wrap(indexes[index][scope]);
  };
  
  // Return all properties of the given type
  this.properties = function(type) {
    var result = type.parent ? this.schema.types[type.parent].properties : {};
    _.extend(result, type.properties);
    return result;
  };

  // Returns the property type
  // TODO: should take typename, key instead of node object, key
  this.propertyType = function(node, path) {
    var type = node.type;
    for (var idx = 0; idx < path.length; idx++) {
      var types = this.properties(this.schema.types[type]);
      type = types[path[idx]];
      if (type === undefined) {
        throw new GraphError("Can not resolve type for path " + JSON.stringify(path));
      }
    }
    return _.isArray(type) ? type : [type];
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
    _private.initIndexes.call(this);


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

  this.propertyChanges = function() {
    this.__propertyChangeAdapter__ = this.__propertyChangeAdapter__ || new PropertyChangeAdapter(this);
    return this.__propertyChangeAdapter__;
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
    _private.addToIndex.call(this, newNode);

    this.trigger("node:created", newNode);
    return this;
  };
  
  // Remove a node
  // -----------
  // Deletes node by id, referenced nodes remain untouched
  // Removes node from indexes
  this.delete = function(node) {
    _private.removeFromIndex.call(this, this.nodes[node.id]);
    delete this.nodes[node.id];

    this.trigger("node:deleted", node.id);
  };

  this.set = function(path, value) {
    var property = this.resolve(path);
    var oldValue = util.deepclone(property.get());
    property.set(value);

    _private.updateIndex.call(this, property, oldValue);

    this.trigger("property:set", path, oldValue, value);
  };

  this.update = function(path, value, diff) {
    var property = this.resolve(path);
    var oldValue = util.deepclone(property.get());
    property.set(value);

    _private.updateIndex.call(this, property, oldValue);

    this.trigger("property:updated", path, diff);
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

  // Setup indexes data-structure based on schema information
  // --------
  //

  this.initIndexes = function() {
    this.indexes = {};
    _.each(this.schema.indexes, function(index, key) {
      if (index.properties === undefined || index.properties.length === 0) {
        this.indexes[key] = [];
      } else if (index.properties.length === 1) {
        this.indexes[key] = {};
      } else {
        // index.properties.length > 1
        throw new GraphError('No multi-property indexes supported yet');
      }
    }, this);
  };

  this.matchIndex = function(schema, nodeType, indexType) {
    var typeChain = schema.typeChain(nodeType);
    return (typeChain.indexOf(indexType) >= 0);
  };

  this.addToSingleIndex = function(indexSpec, index, node) {

    // Note: it is not necessary to create index containers as
    // it is already done by initIndexes
    var groups = indexSpec.properties;
    if (groups) {
      for (var i = 0; i < groups.length; i++) {
        var groupKey = groups[i];
        // Note: grouping is only supported for first level properties
        var groupVal = node[groupKey];

        if (groupVal === undefined) {
          if (this.__mode__ & Graph.STRICT_INDEXING) {
            throw new GraphError("Illegal node: missing property for indexing " + groupKey);
          } else {
            continue;
          }
        }

        index[groupVal] = index[groupVal] || [];
        index[groupVal].push(node.id);
      }
    } else {
      index.push(node.id);
    }
  };

  // Adds a node to indexes
  // --------
  //

  this.addToIndex = function(node) {
    _.each(this.schema.indexes, function(indexSpec, key) {
      // skip irrelevant indexes
      if (_private.matchIndex(this.schema, node.type, indexSpec.type)) {
        _private.addToSingleIndex(indexSpec, this.indexes[key], node);
      }
    }, this);
  };

  // Silently remove node from index
  // --------

  this.removeFromSingleIndex = function(indexSpec, index, node) {
    var groups = indexSpec.properties;
    var pos;
    if (groups) {
      // remove the node from every group
      for (var i = 0; i < groups.length; i++) {
        var groupKey = groups[i];
        // Note: grouping is only supported for first level properties
        var groupVal = node[groupKey];
        if (groupVal === undefined) {
          throw new GraphError("Illegal node: missing property for indexing " + groupKey);
        }
        pos = index[groupVal].indexOf(node.id);
        if (pos >= 0) index[groupVal].splice(pos, 1);
        // prune empty groups
        if (index[groupVal].length === 0) delete index[groupVal];
      }
    } else {
      pos = index.indexOf(node.id);
      if (pos >= 0) index.splice(pos, 1);
    }
  };

  // Removes a node from indexes
  // --------
  //

  this.removeFromIndex = function(node) {
    _.each(this.schema.indexes, function(indexSpec, key) {
      var index = this.indexes[key];

      // Remove all indexed entries that have been registered for
      // a given node itself
      if (index[node.id]) delete index[node.id];

      // skip irrelevant indexes
      if (_private.matchIndex(this.schema, node.type, indexSpec.type)) {
        _private.removeFromSingleIndex(indexSpec, index, node);
      }

    }, this);
  };

  this.updateSingleIndex = function(indexSpec, index, property, oldValue) {
    // Note: intentionally, this is not implemented by delegating to removeFromIndex
    //  and addToIndex. The reason, removeFromIndex erases every occurance of the
    //  modified property. Instead we have to update only the affected indexes,
    //  i.e., those which are registered to the property key

    if (!indexSpec.properties) return;

    var groups = indexSpec.properties;
    var groupIdx = groups.indexOf(property.key);

    // only indexes with groupBy semantic have to be handled
    if (!groups || groupIdx < 0) return;

    var nodeId = property.node.id;
    var newValue = property.get();

    // remove the changed node from the old group
    // and prune the group if it would be empty
    index[oldValue] = _.without(index[oldValue], nodeId);
    if (index[oldValue].length === 0) delete index[oldValue];

    // add the node to the new group
    index[newValue] = index[newValue] || [];
    index[newValue].push(nodeId);

  };

  // Updates all indexes affected by the change of a given property
  // --------
  //

  this.updateIndex = function(property, oldValue) {
    if (oldValue === property.get()) return;

    _.each(this.schema.indexes, function(indexSpec, key) {
      // skip unrelated indexes
      if (_private.matchIndex(this.schema, property.node.type, indexSpec.type)) {
        _private.updateSingleIndex(indexSpec, this.indexes[key], property, oldValue);
      }

    }, this);
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
Graph.PropertyChangeAdapter = PropertyChangeAdapter;

// Exports
// ========

module.exports = Graph;
