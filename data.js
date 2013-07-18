//     (c) 2013 Michael Aufreiter, Oliver Buchtala
//     Data.js is freely distributable under the MIT license.
//     Portions of Data.js are inspired or borrowed from Underscore.js,
//     Backbone.js and Google's Visualization API.
//     For all details and documentation:
//     http://github.com/michael/data

(function(root){ "use strict";

var _,
    util,
    errors,
    Operator,
    Chronicle;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  // Should be require('substance-util') in the future
  util   = require('substance-util');
  errors   = require('substance-util/errors');
  Chronicle = require('substance-chronicle');
  Operator = require('substance-operator');
} else {
  _ = root._;
  util = root.Substance.util;
  errors   = root.Substance.errors;
  Chronicle   = root.Substance.Chronicle;
  Operator = root.Substance.Operator;
}


// Initial Setup
// -------------

// The top-level namespace. All public Data.js classes and modules will
// be attached to this. Exported for both CommonJS and the browser.
var Data = {};

// Current version of the library. Keep in sync with `package.json`.
Data.VERSION = '0.7.0';

// Top Level API
// -------

Data.VALUE_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'date'
];


// Command Registry
// -------

Data.COMMANDS = {
  "delete": {
    "types": ["graph", "array"],
    "arguments": 1
  },
  "create": {
    "types": ["graph"],
    "arguments": 1
  },
  "update": {
    "types": Data.VALUE_TYPES,
    "arguments": 1
  },
  "set": {
    "types": "ALL",
    "arguments": 1
  },
  "push": {
    "types": ["array"],
    "arguments": 1
  },
  "pop": {
    "types": ["array"],
    "arguments": 0
  },
  "clear": {
    "types": ["array", "graph"],
    "arguments": 0
  }
};

// Node: the actual type of a composite type is the first entry
// I.e., ["array", "string"] is an array in first place
Data.isValueType = function (type) {
  if (_.isArray(type)) {
    type = type[0];
  }
  return Data.VALUE_TYPES.indexOf(type) >= 0;
};

// Data.Schema
// ========
//
// Provides a schema inspection API

Data.Schema = function(schema) {
  _.extend(this, schema);
};

Data.Schema.__prototype__ = function() {

  // Return Default value for a given type
  // --------
  //

  this.defaultValue = function(valueType) {
    if (valueType === "object") return {};
    if (valueType === "array") return [];
    if (valueType === "string") return "";
    if (valueType === "number") return 0;
    if (valueType === "boolean") return false;
    if (valueType === "date") return new Date();

    return null;
    // throw new Error("Unknown value type: " + valueType);
  };

  // Return type object for a given type id
  // --------
  //

  this.parseValue = function(valueType, value) {
    if (_.isString(value)) {
      if (valueType === "object") return JSON.parse(value);
      if (valueType === "array") return JSON.parse(value);
      if (valueType === "string") return value;
      if (valueType === "number") return parseInt(value, 10);
      if (valueType === "boolean") {
        if (value === "true") return true;
        else if (value === "false") return false;
        else throw new Error("Can not parse boolean value from: " + value);
      }
      if (valueType === "date") return new Date(value);

      // all other types must be string compatible ??
      return value;

    } else {
      if (valueType === 'array') {
        if (!_.isArray(value)) {
          throw new Error("Illegal value type: expected array.");
        }
        value = util.deepclone(value);
      }
      else if (valueType === 'string') {
        if (!_.isString(value)) {
          throw new Error("Illegal value type: expected string.");
        }
      }
      else if (valueType === 'object') {
        if (!_.isObject(value)) {
          throw new Error("Illegal value type: expected object.");
        }
        value = util.deepclone(value);
      }
      else if (valueType === 'number') {
        if (!_.isNumber(value)) {
          throw new Error("Illegal value type: expected number.");
        }
      }
      else if (valueType === 'boolean') {
        if (!_.isBoolean(value)) {
          throw new Error("Illegal value type: expected boolean.");
        }
      }
      else if (valueType === 'date') {
        value = new Date(value);
      }
      else {
        throw new Error("Unsupported value type: " + valueType);
      }
      return value;
    }
  };

  // Return type object for a given type id
  // --------
  //

  this.type = function(typeId) {
    return this.types[typeId];
  };

  // For a given type id return the type hierarchy
  // --------
  //
  // => ["base_type", "specific_type"]

  this.typeChain = function(typeId) {
    var type = this.types[typeId];
    if (!type) throw new Error('Type ' + typeId + ' not found in schema');

    var chain = (type.parent) ? this.typeChain(type.parent) : [];
    chain.push(typeId);
    return chain;
  };

  // Provides the top-most parent type of a given type.
  // --------
  //

  this.baseType = function(typeId) {
    return this.typeChain(typeId)[0];
  };

  // Return all properties for a given type
  // --------
  //

  this.properties = function(type) {
    type = _.isObject(type) ? type : this.type(type);
    var result = (type.parent) ? this.properties(type.parent) : {};
    _.extend(result, type.properties);
    return result;
  };

  // Returns the full type for a given property
  // --------
  //
  // => ["array", "string"]

  this.propertyType = function(type, property) {
    var properties = this.properties(type);
    var propertyType = properties[property];
    if (!propertyType) throw new Error("Property not found for" + type +'.'+property);
    return _.isArray(propertyType) ? propertyType : [propertyType];
  };

  // Returns the base type for a given property
  // --------
  //
  //  ["string"] => "string"
  //  ["array", "string"] => "array"

  this.propertyBaseType = function(type, property) {
    return this.propertyType(type, property)[0];
  };
};

Data.Schema.prototype = new Data.Schema.__prototype__();

// Data.Graph
// ========

// A `Data.Graph` can be used for representing arbitrary complex object
// graphs. Relations between objects are expressed through links that
// point to referred objects. Data.Graphs can be traversed in various ways.
// See the testsuite for usage.

Data.Graph = function(schema, options) {
  options = options || {};

  // Initialization
  this.schema = new Data.Schema(schema);
  this.objectAdapter = new Data.Graph.ObjectAdapter(this);

  this.nodes = {};
  this.indexes = {};

  this.__mode__ = options.mode || Data.Graph.DEFAULT_MODE;
  this.__seed__ = options.seed;

  // Note: don't init automatically after making persistent
  // as this would delete the persistet graph.
  // Instead, the application has to call `graph.load()` if the store is supposed to
  // contain a persisted graph
  this.isVersioned = !!options.chronicle;
  this.isPersistent = !!options.store;

  if (this.isVersioned) {
    this.chronicle = options.chronicle;
    this.chronicle.manage(new Data.Graph.ChronicleAdapter(this));
  }

  if (this.isPersistent) {
    var nodes = options.store.hash("nodes");
    this.__store__ = options.store;
    this.__nodes__ = nodes;

    if (this.isVersioned) {
      this.__version__ = options.store.hash("__version__");
    }

    this.objectAdapter = new Data.Graph.PersistenceAdapter(this.objectAdapter, nodes);
  }

  if (options.load) {
    this.load();
  } else {
    this.init();
  }

  // Populate graph
  if (options.graph) this.merge(options.graph);
};

Data.Graph.__prototype__ = function() {

  var _private = new Data.Graph.Private();

  // Manipulation API
  // ========

  // Adds a new node to the graph
  // --------
  // Only properties that are specified in the schema are taken.

  this.create = function(node) {
    this.apply(Data.Graph.Create(node));
  };

  // Removes a node with given id
  // --------

  this.delete = function(path, key) {
    var fullPath = ["delete"];

    // On Graph
    if (arguments.length === 1) {
      fullPath.push(this.get(path));
    } else {
      fullPath = fullPath.concat(path).concat(key);
    }

    return this.apply(fullPath);
  };

  // Updates the property with a given operation.
  // --------
  // Note: the diff has to be given as an appropriate operation.

  this.update = function(path, diff) {
    this.apply(Data.Graph.Update(path, diff));
  };

  // Sets the property to a given value
  // --------

  this.set = function(path, value) {
    this.apply(Data.Graph.Set(path, value));
  };

  this.__apply__ = function(op) {
    op.apply(this.objectAdapter);
    this.updated_at = new Date();

    // feed the built-in observer adapter
    if (this.__propertyChangeAdapter__) this.__propertyChangeAdapter__.onGraphChange(op);

    this.trigger('graph:changed', op, this);
  };

  // Applies a graph command
  // --------

  this.apply = function(command) {

    // Note: all Graph commands are converted to ObjectOperations
    // which get applied on this graph instance (via ObjectAdapter).
    var op;

    if (!(command instanceof Operator.ObjectOperation)) {
      op = Data.Graph.toObjectOperation(this, command);
    } else {
      op = command;
    }

    this.__apply__(op);

    // do not record changes during initialization
    if (!this.__is_initializing__ && this.isVersioned) {
      op.timestamp = new Date();
      this.chronicle.record(util.clone(op));
    }

    return op;
  };


  // Others
  // ========

  this.get = function(path) {
    if (!_.isArray(path) && !_.isString(path)) throw new Error("Invalid argument path. Must be String or Array");

    if (arguments.length > 1) path = _.toArray(arguments);
    if (_.isString(path)) return this.nodes[path];

    var prop = this.resolve(path);
    return prop.get();
  };

  this.query = function(path) {
    var prop = this.resolve(path);

    var type = prop.type;
    var baseType = prop.baseType;
    var val = prop.get();

    // resolve referenced nodes in array types
    if (baseType === "array") {
      return _private.queryArray.call(this, val, type);
    } else if (!Data.isValueType(baseType)) {
      return this.get(val);
    } else {
      return val;
    }
  };

  // Serialize current state
  // ---------

  this.toJSON = function() {
    return {
      nodes: util.deepclone(this.nodes)
    };
  };

  // Checks if a node with given id exists
  // ---------

  this.contains = function(id) {
    return (!!this.nodes[id]);
  };

  // Resolves a property with a given path
  // ---------

  this.resolve = function(path) {
    return new Data.Property(this, path);
  };

  // Resets the graph to its initial state.
  // --------
  // Note: This clears all nodes and calls `init()` which may seed the graph.

  this.reset = function() {
    if (this.isPersistent) {
      if (this.__nodes__) this.__nodes__.clear();
    }

    this.init();

    if (this.isVersioned) {
      this.state = Chronicle.ROOT;
    }
  };

  this.init = function() {
    this.__is_initializing__ = true;

    this.nodes = {};
    this.indexes = {};
    _private.initIndexes.call(this);

    if (this.__seed__) {
      for (var idx = 0; idx < this.__seed__.length; idx++) {
        this.apply(this.__seed__[idx]);
      }
    }

    if (this.isPersistent) {
      _.each(this.nodes, function(node, id) {
        this.__nodes__.set(id, node);
      }, this);
    }

    delete this.__is_initializing__;
  };

  // Merges this graph with another graph
  // --------
  //

  this.merge = function(graph) {
    _.each(graph.nodes, function(n) {
      graph.create(n);
    });

    return this;
  };

  // View Traversal
  // --------

  this.traverse = function(view) {
    return _.map(this.getView(view), function(node) {
      return this.get(node);
    }, this);
  };

  // Find data nodes based on index
  // --------

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
        throw new Error("Can not resolve type for path " + JSON.stringify(path));
      }
    }
    return _.isArray(type) ? type : [type];
  };

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
    this.__propertyChangeAdapter__ = this.__propertyChangeAdapter__ || new Data.Graph.PropertyChangeAdapter();
    return this.__propertyChangeAdapter__;
  };

};

// modes
Data.Graph.STRICT_INDEXING = 1 << 1;
Data.Graph.DEFAULT_MODE = Data.Graph.STRICT_INDEXING;

// Private Graph implementation
// ========
//

Data.Graph.Private = function() {

  var _private = this;

  // Safely constructs a new node based on type information
  // Node needs to have a valid type
  // All properties that are not registered, are dropped
  // All properties that don't have a value are
  this.createNode = function (schema, node) {
    if (!node.id || !node.type) {
      throw new Error("Can not create Node: 'id' and 'type' are mandatory.");
    }

    var type = schema.type(node.type);
    if (!type) {
      throw new Error("Type not found in the schema");
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


  this.create = function(node) {
    var newNode = _private.createNode(this.schema, node);
    if (this.contains(newNode.id)) {
      throw new Error("Node already exists: " + newNode.id);
    }
    this.nodes[newNode.id] = newNode;
    _private.addToIndex.call(this, newNode);
    return this;
  };

  // Delete node by id, referenced nodes remain untouched
  this.delete = function(node) {
    _private.removeFromIndex.call(this, this.nodes[node.id]);
    delete this.nodes[node.id];
  };

  this.set = function(path, value) {
    var property = this.resolve(path);
    var oldValue = util.deepclone(property.get());
    property.set(value);

    _private.updateIndex.call(this, property, oldValue);
  };

  this.update = function(path, diff) {
    var property = this.resolve(path);
    var oldValue = util.deepclone(property.get());
    var val = property.get();

    var valueType = property.baseType;

    if (valueType === 'string') {
      val = Operator.TextOperation.apply(diff, val);
    } else if (valueType === 'array') {
      val = Operator.ArrayOperation.apply(diff, val);
    } else if (valueType === 'object') {
      val = Operator.ObjectOperation.apply(diff, val);
    } else {
      // Note: all other types are treated via TextOperation on the String representation
      val = val.toString();
      val = Operator.TextOperation.apply(diff, val);
    }
    property.set(val);

    _private.updateIndex.call(this, property, oldValue);
  };

  this.queryArray = function(arr, type) {
    if (!_.isArray(type)) {
      throw new Error("Illegal argument: array types must be specified as ['array'(, 'array')*, <type>]");
    }
    var result, idx;
    if (type[1] === "array") {
      result = [];
      for (idx = 0; idx < arr.length; idx++) {
        result.push(_private.queryArray.call(this, arr[idx], type.slice(1)));
      }
    } else if (!Data.isValueType(type[1])) {
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
        throw new Error('No multi-property indexes supported yet');
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
          if (this.__mode__ & Data.Graph.STRICT_INDEXING) {
            throw new Error("Illegal node: missing property for indexing " + groupKey);
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
          throw new Error("Illegal node: missing property for indexing " + groupKey);
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

Data.Graph.prototype = _.extend(new Data.Graph.__prototype__(), util.Events);

Data.Graph.toObjectOperation = function(graph, command) {

  // TODO: would be great if Compound would match the instanceof check
  if (command instanceof Operator.ObjectOperation || command instanceof Operator.Compound) return command;

  command = new Data.Command(command, Data.COMMANDS);

  var op, id, prop, propType, args;

  // Check type command combination
  prop = graph.resolve(command.path);
  propType = prop.baseType;
  args = command.args;

  // TODO: Rethink. E.g., what about sub-types...disabling this for now.
  // if (!_.include(Data.COMMANDS[command.type].types, propType) && Data.COMMANDS[command.type].types !== "ALL") {
  //   throw new Error("Command not supported for "+ propType);
  // }

  // Note: we convert the Data.Commands to ObjectOperations
  if (command.type === "create") {
    id = args.id;
    // Note: in this case the path must be empty, as otherwise the property lookup
    // claims due to the missing data
    op = Operator.ObjectOperation.Create([id], args);
  }
  else if (command.type === "delete") {
    if (command.path.length === 0) {
      id = args.id;
      var node = graph.get(id);
      op = Operator.ObjectOperation.Delete([id], node);
    } else if (propType === "array") {
      op = Operator.ObjectOperation.Update(command.path, Data.Array.Delete(prop.get(), args), propType);
    } else if (propType === "object") {
      op = Operator.ObjectOperation.Delete(prop.path, prop.get());
    }
  }
  else if (command.type === "update") {
    op = Operator.ObjectOperation.Update(command.path, args, propType);
  }
  else if (command.type === "set") {
    op = Operator.ObjectOperation.Set(command.path, prop.get(), args);
  }
  // Convenience commands
  else if (command.type === "pop") {
    op = Operator.ObjectOperation.Update(command.path, Data.Array.Pop(prop.get()));
  }
  else if (command.type === "push") {
    op = Operator.ObjectOperation.Update(command.path, Data.Array.Push(prop.get(), args));
  }

  return op;
};

// ObjectOperation Adapter
// ========
//
// This adapter delegates object changes as supported by Operator.ObjectOperation
// to graph methods

Data.Graph.ObjectAdapter = function(graph) {
  this.graph = graph;
};

Data.Graph.ObjectAdapter.__prototype__ = function() {
  var impl = new Data.Graph.Private();

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
Data.Graph.ObjectAdapter.__prototype__.prototype = Operator.ObjectOperation.Object.prototype;
Data.Graph.ObjectAdapter.prototype = new Data.Graph.ObjectAdapter.__prototype__();


Data.Property = function(graph, path) {
  if (!path) {
    throw new Error("Illegal argument: path is null/undefined.");
  }

  this.graph = graph;
  this.schema = graph.schema;

  _.extend(this, this.resolve(path));
};

Data.Property.__prototype__ = function() {

  this.resolve = function(path) {
    var node = this.graph;
    var parent = node;
    var type = "graph";

    var key;
    var value;

    var idx = 0;
    for (; idx < path.length; idx++) {

      // TODO: check if the property references a node type
      if (type === "graph" || this.schema.types[type] !== undefined) {
        // remember the last node type
        parent = this.graph.get(path[idx]);

        if (parent === undefined) {
          throw new Error("Key error: could not find element for path " + JSON.stringify(path));
        }

        node = parent;
        type = this.schema.properties(parent.type);
        value = node;
        key = undefined;
      } else {
        if (parent === undefined) {
          throw new Error("Key error: could not find element for path " + JSON.stringify(path));
        }
        key = path[idx];
        var propName = path[idx];
        type = type[propName];
        value = parent[key];

        if (idx < path.length-1) {
          parent = parent[propName];
        }
      }
    }

    return {
      node: node,
      parent: parent,
      type: type,
      key: key,
      value: value
    };

  };

  this.get = function() {
    if (this.key !== undefined) {
      return this.parent[this.key];
    } else {
      return this.node;
    }
  };

  this.set = function(value) {
    if (this.key !== undefined) {
      this.parent[this.key] = this.schema.parseValue(this.baseType, value);
    } else {
      throw new Error("'set' is only supported for node properties.");
    }
  };

};
Data.Property.prototype = new Data.Property.__prototype__();
Object.defineProperties(Data.Property.prototype, {
  baseType: {
    get: function() {
      if (_.isArray(this.type)) return this.type[0];
      else return this.type;
    }
  },
  path: {
    get: function() {
      return [this.node.id, this.key];
    }
  }
});

Data.Command = function(options, commands) {
  // var options;
  // if (arguments.length > 1) options = _.toArray(arguments);
  // else options = arguments[0];

  if (!options) throw new Error("Illegal argument: expected command spec, was " + options);

  // convert the convenient array notation into the internal object notation
  if (_.isArray(options)) {
    var type = options[0];
    var argc = commands[type].arguments;
    var path = options.slice(1, options.length - argc);
    var args = argc > 0 ? _.last(options) : null;

    options = {
      type: type,
      path: path,
      args: args
    };
  }

  this.type = options.type;
  this.path = options.path;
  this.args = options.args;
};

Data.Command.__prototype__ = function() {

  this.clone = function() {
    return new Data.Command(this);
  };

  this.toJSON = function() {
    return {
      type: this.type,
      path: this.path,
      args: this.args
    };
  };
};

Data.Command.prototype = new Data.Command.__prototype__();

// Graph manipulation
// ---------

Data.Graph.Create = function(node) {
  return new Data.Command({
    type: "create",
    path: [],
    args: node
  });
};

Data.Graph.Delete = function(node) {
  return new Data.Command({
    type: "delete",
    path: [],
    args: node
  });
};

Data.Graph.Update = function(path, diff) {
  return new Data.Command({
    type: "update",
    path: path,
    args: diff
  });
};

Data.Graph.Set = function(path, val) {
  return new Data.Command({
    type: "set",
    path: path,
    args: val
  });
};

Data.Graph.Compound = function(graph, commands) {
  var ops = [];

  for (var idx = 0; idx < commands.length; idx++) {
    ops.push(Data.Graph.toObjectOperation(graph, commands[idx]));
  }

  return Operator.ObjectOperation.Compound(ops);
};

// Array manipulation
// ---------

Data.Array = {};

Data.Array.Delete = function(arr, val) {
  return Operator.ArrayOperation.Delete(arr, val);
};

Data.Array.Push = function(arr, val) {
  return Operator.ArrayOperation.Push(arr, val);
};

// Does not yet return a value
Data.Array.Pop = function(arr) {
  return Operator.ArrayOperation.Pop(arr);
};

Data.Array.Clear = function(arr) {
  return Operator.ArrayOperation.Clear(arr);
};


// Extensions
// ========

var PersistenceAdapter = function(delegate, nodes) {
  this.delegate = delegate;
  this.nodes = nodes;
};

PersistenceAdapter.__prototype__ = function() {

  this.get = function(path) {
    return this.delegate.get(path);
  };

  this.create = function(__, value) {
    this.delegate.create(__, value);
    this.nodes.set(value.id, value);
  };

  this.set = function(path, value) {
    this.delegate.set(path, value);
    // TODO: is it ok to store the value as node???
    var nodeId = path[0];
    var updated = this.delegate.get([nodeId]);
    this.nodes.set(nodeId, updated);
  };

  this.delete = function(__, value) {
    this.delegate.delete(__, value);
    this.nodes.delete(value.id);
  };

  this.inplace = function() {
    return false;
  };
};
PersistenceAdapter.__prototype__.prototype = Operator.ObjectOperation.Object.prototype;
PersistenceAdapter.prototype = new PersistenceAdapter.__prototype__();

var ChronicleAdapter = function(graph) {
  this.graph = graph;
  this.graph.state = "ROOT";
};

ChronicleAdapter.__prototype__ = function() {

  this.apply = function(op) {
    // Note: we call the Graph.apply intentionally, as the chronicled change
    // should be an ObjectOperation
    //console.log("ChronicleAdapter.apply, op=", op);
    this.graph.__apply__(op);
    this.graph.updated_at = new Date(op.timestamp);
  };

  this.invert = function(change) {
    return Operator.ObjectOperation.fromJSON(change).invert();
  };

  this.transform = function(a, b, options) {
    return Operator.ObjectOperation.transform(a, b, options);
  };

  this.reset = function() {
    this.graph.reset();
  };

  this.getState = function() {
    return this.graph.state;
  };

  this.setState = function(state) {
    this.graph.state = state;
  };
};

ChronicleAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
ChronicleAdapter.prototype = new ChronicleAdapter.__prototype__();

// Dispatches 'graph:changed' events by on a property level
// restricting updates by applying path based filters, for instance.
var PropertyChangeAdapter = function() {
  // for now a canonical implementation, all listeners flat in an array
  this.listeners = [];
  this.filters = [];
};

PropertyChangeAdapter.__prototype__ = function() {

  function matchPath(path, pattern) {
    if (path.length !== pattern.length) return false;
    for (var idx = 0; idx < pattern.length; idx++) {
      if (pattern[idx] === "*") continue;
      if (pattern[idx] !== path[idx]) return false;
    }

    return true;
  }

  function propagateAtomicOp(self, objOp) {

    for(var idx = 0; idx < self.listeners.length; idx++) {
      var listener = self.listeners[idx];
      var filter = self.filters[idx];

      // check if the operation passes the filter
      if (filter.type && filter.type !== objOp.type) continue;
      if (filter.path && !matchPath(objOp.path, filter.path)) continue;

      // if the listener is given as function call it,
      // otherwise it is assumed that the listener implements an adequate
      // adapter interface to which the operation can be applied, making a
      // *co-transformation*.
      // Note: in the later case the adapter is directly used to apply a co-transformation
      if (_.isFunction(listener)) {
        listener(objOp);
      } else {
        if (objOp.type === Operator.ObjectOperation.UPDATE) {
          objOp.diff.apply(listener);
        } else {
          objOp.apply(listener);
        }
      }
    }

  }

  this.onGraphChange = function(objOp) {
    if (objOp.type === Operator.Compound.TYPE) {
      for (var idx = 0; idx < objOp.ops.length; idx++) {
        propagateAtomicOp(this, objOp.ops[idx]);
      }
    } else {
      propagateAtomicOp(this, objOp);
    }
  };

  this.bind = function(listener, filter) {
    if (this.listeners.indexOf(listener) >= 0) {
      throw new Error("Listener is already registered");
    }
    this.listeners.push(listener);
    this.filters.push(filter);
  };

  this.unbind = function(listener) {
    var pos = this.listeners.indexOf(listener);
    if (pos < 0) {
      return console.log("Listener is not registered. Ignored.");
    }

    this.listeners.splice(pos, 1);
    this.filters.splice(pos, 1);
  };

};
PropertyChangeAdapter.prototype = new PropertyChangeAdapter.__prototype__();

Data.Graph.PersistenceAdapter = PersistenceAdapter;
Data.Graph.ChronicleAdapter = ChronicleAdapter;
Data.Graph.PropertyChangeAdapter = PropertyChangeAdapter;

// Exports
// ========

if (typeof exports !== 'undefined') {
  module.exports = Data;
} else {
  root.Substance.Data = Data;
}

})(this);
