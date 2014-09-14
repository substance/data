"use strict";

var _ = require('underscore');
var util = require('substance-util');
var errors = util.errors;

var Schema = require('./schema');
var Property = require('./property');

var Chronicle = require('substance-chronicle');
var Operator = require('substance-operator');

var ChronicleAdapter = require('./chronicle_adapter');
var Index = require('./graph_index');
var CustomIndex = require('./custom_index');
var SimpleIndex = require('./simple_index');
var Migrations = require("./migrations");

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
  this.nodes = {};
  this.indexes = {};
  this.objectAdapter = new Graph.ObjectAdapter(this);
  this.seed = options.seed;
  this.__mode__ = options.mode || Graph.DEFAULT_MODE;
  this.isVersioned = !!options.chronicle;
  this.chronicle = options.chronicle;
  if (this.isVersioned) {
    this.chronicle.manage(new Graph.ChronicleAdapter(this));
  }

  // Check if provided seed conforms to the given schema
  // Only when schema has an id and seed is provided
  // TODO: IMO it does not make sense to have a schema without id
  // and every seed MUST have a schema
  // We should add that schema in all seeds
  if (this.seed && !this.seed.schema) {
    console.error("FIXME: a document seed MUST have a schema.");
  }
  if (this.seed && this.seed.schema &&
      (this.seed.schema[0] !== this.schema.id || this.seed.schema[1] !== this.schema.version)
     ) {
    this.migrate(this.seed);
  }

  this.init(this.seed);
};

Graph.Prototype = function() {

  _.extend(this, util.Events);

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
  //
  // Arguments:
  //   - node: the new node
  //
  this.create = function(node) {
    var op = Operator.ObjectOperation.Create([node.id], node);
    return this.apply(op);
  };

  // Remove a node
  // -------------
  // Removes a node with given id and key (optional):
  //     Data.Graph.delete(this.graph.get('apple'));
  //
  // Arguments:
  //   - id: the node id
  //
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
  //
  // Arguments:
  //   - path: an array used to resolve the property to be updated
  //   - diff: an (incremental) operation that should be applied to the property

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
  //
  // Arguments:
  //   - path: an array used to resolve the property to be updated
  //   - diff: an (incremental) operation that should be applied to the property
  //
  this.set = function(path, newValue, userData) {
    var prop = this.resolve(path);
    if (!prop) {
      throw new GraphError("Could not resolve property with path "+JSON.stringify(path));
    }
    var oldValue = prop.get();
    // Note: Operator.ObjectOperation.Set will clone the values
    var op = Operator.ObjectOperation.Set(path, oldValue, newValue);
    if (userData) op.data = userData;

    return this.apply(op);
  };

  // Pure graph manipulation
  // -----------------------
  //
  // Only applies the graph operation without triggering e.g., the chronicle.

  this.__apply__ = function(_op, options) {
    //console.log("Graph.__apply__", op);

    // Note: we apply compounds eagerly... i.e., all listeners will be updated after
    // each atomic change.

    Operator.Helpers.each(_op, function(op) {
      if (!(op instanceof Operator.ObjectOperation)) {
        op = Operator.ObjectOperation.fromJSON(op);
      }
      op.apply(this.objectAdapter);

      this.updated_at = new Date();
      this._internalUpdates(op);

      _.each(this.indexes, function(index) {
        // Treating indexes as first class listeners for graph changes
        index.onGraphChange(op);
      }, this);

      // provide the target node which is affected by this operation
      var target;
      if (op.type === "create" || op.type === "delete") {
        target = op.val;
      } else {
        target = this.get(op.path[0]);
      }

      // And all regular listeners in second line
      this.trigger('operation:applied', op, this, target, options);
    }, this);

  };

  this._internalUpdates = function(op) {
    // Treating indexes as first class listeners for graph changes
    Operator.Helpers.each(op, function(_op) {
      _.each(this.indexes, function(index) {
        index.onGraphChange(_op);
      }, this);
    }, this);
  };

  // Apply a command
  // ---------------
  //
  // Applies a graph command
  // All commands call this function internally to apply an operation to the graph
  //
  // Arguments:
  //   - op: the operation to be applied,

  this.apply = function(op, options) {
    this.__apply__(op, options);

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
    if (path === undefined || path === null) {
      throw new GraphError("Invalid argument: provided undefined or null.");
    }
    if (!_.isArray(path) && !_.isString(path)) {
      throw new GraphError("Invalid argument path. Must be String or Array");
    }
    if (_.isString(path)) return this.nodes[path];
    // Note: we use the property mechanism here to enable type safety.
    // I.e., property.get() calls Schema.ensureType() which parses string data
    // and throws error if an unexpected type is given.
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
      return this.queryArray(val, type);
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
    if (this.isPersistent) {
      if (this.__nodes__) this.__nodes__.clear();
    }

    this.init(this.seed);

    if (this.isVersioned) {
      this.state = Chronicle.ROOT;
    }

    this.trigger("graph:reset");
  };

  // Graph initialization.
  this.init = function(seed) {
    this.__is_initializing__ = true;

    if (seed) {
      this.nodes = util.clone(seed.nodes);
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

  this.merge = function(graph) {
    _.each(graph.nodes, function(n) {
      this.create(n);
    }, this);

    return this;
  };

  // View Traversal
  // --------------

  this.traverse = function(view) {
    return _.map(this.getView(view), function(node) {
      return this.get(node);
    }, this);
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
      if (prop === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(op.path));
      }
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
        var invertedDiff = Operator.Helpers.invert(op.diff, prop.baseType);
        oldValue = invertedDiff.apply(_.clone(value));
      }

      adapter.update(prop.context, prop.key, value, oldValue);
    }
  };

  this.addIndex = function(name, options) {
    if (this.indexes[name]) {
      return this.indexes[name];
      // throw new GraphError("Index with name " + name + "already exists.");
    }

    // EXPERIMENTAL: refactoring the index API
    // Eventually, simple indexing should be easier and consistent with
    // the currently rather complicated hierarchical index
    var index;
    if (options && options["custom"]) {
      index = new CustomIndex(this, name, options);
    } else if (options && options["simple"]) {
      index = new SimpleIndex(this, name, options);
    } else {
      index = new Index(this, options);
    }
    this.indexes[name] = index;

    return index;
  };

  this.getIndex = function(name) {
    if (!this.indexes[name]) {
      throw new GraphError("No index available with name:"+name);
    }
    return this.indexes[name];
  };

  this.removeIndex = function(name) {
    delete this.indexes[name];
  };

  this.enableVersioning = function(chronicle) {
    if (this.isVersioned) return;
    if (!chronicle) {
      chronicle = Chronicle.create();
    }
    this.chronicle = chronicle;
    this.chronicle.manage(new Graph.ChronicleAdapter(this));
    this.isVersioned = true;
  };

  this.getMigrations = function() {
    return {};
  };

  this.migrate = function(seed) {
    // Try to migrate
    var migrations = new Migrations(this);
    // try {
      return migrations.migrate(seed);
    // } catch (migrationErr) {
    //   throw new GraphError([
    //     "Graph does not conform to schema. Expected: ",
    //     this.schema.id+"@"+this.schema.version,
    //     " Actual: ",
    //     seed.schema[0]+"@"+seed.schema[1]
    //   ].join(''));
    // }
  };

  // Internal implementation
  // =======================

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
    var type = schema.getType(node.type);
    if (!type) {
      throw new GraphError("Type '"+node.type+"' not found in the schema");
    }
    var properties = schema.getProperties(node.type);
    var freshNode = { type: node.type, id: node.id };
    // Start constructing the fresh node
    _.each(properties, function(p, key) {
      // Find property base type
      var baseType = schema.getPropertyBaseType(node.type, key);

      // Assign user defined property value or use default value for baseType
      var val = (node[key] !== undefined) ? node[key] : schema.getDefaultValue(baseType);
      freshNode[key] = util.deepclone(val);
    });
    return freshNode;
  };

  this.queryArray = function(arr, type) {
    if (!_.isArray(type)) {
      throw new GraphError("Illegal argument: array types must be specified as ['array'(, 'array')*, <type>]");
    }
    var result, idx;
    if (type[1] === "array") {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(this.queryArray(arr[idx], type.slice(1)));
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

  // Create a new node
  // -----------------
  // Safely constructs a new node
  // Checks for node duplication
  // Adds new node to indexes
  this._create = function(node) {
    var newNode = this.createNode(this.schema, node);
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
  this._delete = function(node) {
    delete this.nodes[node.id];
    this.trigger("node:deleted", node.id);
  };

  this._set = function(path, value) {
    var property = this.resolve(path);
    if (property === undefined) {
      throw new Error("Key error: could not find element for path " + JSON.stringify(path));
    }
    if (!property.baseType) {
      throw new Error("Could not lookup schema for path " + JSON.stringify(path));
    }
    var oldValue = util.deepclone(property.get());
    property.set(value);
    this.trigger("property:updated", path, null, oldValue, value);
  };

  var _triggerPropertyUpdate = function(path, diff) {
    Operator.Helpers.each(diff, function(op) {
      this.trigger('property:updated', path, op, this);
    }, this);
  };

  this._update = function(path, value, diff) {
    var property = this.resolve(path);
    if (property === undefined) {
      throw new Error("Key error: could not find element for path " + JSON.stringify(path));
    }
    property.set(value);
    _triggerPropertyUpdate.call(this, path, diff);
  };

};

// Index Modes
// ----------

Graph.STRICT_INDEXING = 1 << 1;
Graph.DEFAULT_MODE = Graph.STRICT_INDEXING;

Graph.prototype = new Graph.Prototype();

// ObjectOperation Adapter
// ========
//
// This adapter delegates object changes as supported by Operator.ObjectOperation
// to graph methods

Graph.ObjectAdapter = function(graph) {
  this.graph = graph;
};

Graph.ObjectAdapter.Prototype = function() {

  // Note: this adapter is used with the OT API only.
  // We do not accept paths to undefined properties
  // and instead throw an error to fail as early as possible.
  this.get = function(path) {
    var prop = this.graph.resolve(path);
    if (prop === undefined) {
      throw new Error("Key error: could not find element for path " + JSON.stringify(path));
    } else {
      return prop.get();
    }
  };

  this.create = function(__, value) {
    // Note: only nodes (top-level) can be created
    this.graph._create(value);
  };

  this.set = function(path, value) {
    this.graph._set(path, value);
  };

  this.update = function(path, value, diff) {
    this.graph._update(path, value, diff);
  };

  this.delete = function(__, value) {
    // Note: only nodes (top-level) can be deleted
    this.graph._delete(value);
  };

  this.inplace = function() { return false; };
};

Graph.ObjectAdapter.Prototype.prototype = Operator.ObjectOperation.Object.prototype;
Graph.ObjectAdapter.prototype = new Graph.ObjectAdapter.Prototype();

Graph.Schema = Schema;
Graph.Property = Property;
Graph.GraphError = GraphError;
Graph.ChronicleAdapter = ChronicleAdapter;
Graph.Index = Index;

// Exports
// ========

module.exports = Graph;
