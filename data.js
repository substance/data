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
    ot,
    Chronicle;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  // Should be require('substance-util') in the future
  util   = require('./lib/util/util');
  errors   = require('./lib/util/errors');
  Chronicle = require('./lib/chronicle/chronicle');
  ot = require('./lib/chronicle/lib/ot/index');
} else {
  _ = root._;
  util = root.Substance.util;
  errors   = root.Substance.errors;
  Chronicle   = root.Substance.Chronicle;
  ot = Chronicle.ot;
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

Data.isValueType = function (type) {
  return _.include(Data.VALUE_TYPES, _.last(type));
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

    throw new Error("Unknown value type: " + valueType);
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

// Data.Node
// ========
//
// A `Data.Node` refers to one element in the graph

Data.Node = function() {
  throw new Error("A Data.Node can't be instantiated.");
};

// Safely constructs a new node based on type information
// Node needs to have a valid type
// All properties that are not registered, are dropped
// All properties that don't have a value are

Data.Node.create = function (schema, node) {
  if (!node.id || !node.type) {
    throw new Error("Can not create Node: 'id' and 'type' are mandatory.");
  }

  var type = schema.type(node.type);
  if (!type) throw new Error("Type not found in the schema");

  var properties = schema.properties(node.type);
  var freshNode = { type: node.type, id: node.id };

  // Start constructing the fresh node
  _.each(properties, function(p, key) {
    // Find property base type
    var baseType = schema.propertyBaseType(node.type, key);

    // Assign user defined property value or use default value for baseType
    var val = node[key] || schema.defaultValue(baseType);
    freshNode[key] = util.deepclone(val);
  });

  return freshNode;
};

// Data.Graph
// ========

// A `Data.Graph` can be used for representing arbitrary complex object
// graphs. Relations between objects are expressed through links that
// point to referred objects. Data.Graphs can be traversed in various ways.
// See the testsuite for usage.

Data.Graph = function(schema, graph) {
  // Initialization
  this.schema = new Data.Schema(schema);

  this.nodes = {};
  this.indexes = {};

  this.init();

  // Populate graph
  if (graph) this.merge(graph);
};

Data.Graph.__prototype__ = function() {

  var _private = new Data.Graph.Impl();

  // Manipulation API
  // ========

  // Adds a new node to the graph
  // --------
  // Only properties that are specified in the schema are taken.

  this.create = function(node) {
    this.exec(Data.Graph.Create(node));
  };

  // Removes a node with given id
  // --------

  this.delete = function(id) {
    this.exec(Data.Graph.Delete(this.get(id)));
  };

  // Updates the property with a given operation.
  // --------
  // Note: the diff has to be given as an appropriate operation.

  this.update = function(path, diff) {
    this.exec(Data.Graph.Update(path, diff));
  };

  // Sets the property to a given value
  // --------

  this.set = function(path, value) {
    this.exec(Data.Graph.Set(path, value));
  }

  // Executes a graph command
  // --------

  this.exec = function(command) {
    // normalize the command
    command = new Data.Command(command);

    if (command.op === "NOP") return command;

    if (!_private[command.op]) {
      throw new Error("Unknown command: " + command.op);
    }

    if (command.op === "create" || command.op === "delete") {
      _private[command.op].call(this, command.args);
    } else {
      _private[command.op].call(this, command.path, command.args);
    }


    return command;
  };

  // Others
  // ========

  this.get = function(path) {
    if (_.isString(path)) return this.nodes[path];

    var prop = this.resolve(path);
    return prop.get();
  };

  // Checks if a node with given id exists
  // ---------

  this.contains = function(id) {
    return (!!this.nodes[id]);
  }

  // Resolves a property with a given path
  // ---------

  this.resolve = function(path) {
    return new Data.Property(this, path);
  };

  // Resets the graph to an initial state.
  // --------

  this.reset = function() {
    this.init();
  };

  this.init = function() {
    this.nodes = {};
    this.indexes = {};
    _private.initIndexes.call(this);
  };

  // Merges this graph with another graph
  // --------
  //

  this.merge = function(graph) {
    _.each(graph.nodes, function(n) {
      graph.create(n);
    });
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

};

Data.Graph.Impl = function() {

  var _private = this;

  this.create = function(node) {
    var newNode = Data.Node.create(this.schema, node);
    if (this.contains(newNode.id)) {
      throw new Error("Node already exists: " + newNode.id);
    }
    this.nodes[newNode.id] = newNode;
    _private.addToIndex.call(this, newNode);
    return this;
  };

  // Delete node by id, referenced nodes remain untouched
  this.delete = function(node) {
    // TODO: update indexes
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

    var valueType = property.type()[0];

    if (valueType === 'string') {
      val = ot.TextOperation.apply(diff, val);
    } else if (valueType === 'array') {
      val = ot.ArrayOperation.apply(diff, val);
    } else if (valueType === 'object') {
      val = ot.ObjectOperation.apply(diff, val);
    } else {
      // Note: all other types are treated via TextOperation on the String representation
      val = val.toString();
      val = ot.TextOperation.apply(diff, val);
    }

    property.set(val);

    _private.updateIndex.call(this, property, oldValue);
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
          throw new Error("Illegal node: missing property for indexing " + groupKey);
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

    var groupIdx = groups.indexOf(property.key());

    // only indexes with groupBy semantic have to be handled
    if (!groups || groupIdx < 0) return;

    var nodeId = property.node().id;
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
      if (_private.matchIndex(this.schema, property.node().type, indexSpec.type)) {
        _private.updateSingleIndex(indexSpec, this.indexes[key], property, oldValue);
      }

    }, this);
  };

};

Data.Graph.prototype = _.extend(new Data.Graph.__prototype__(), util.Events);


Data.Property = function(graph, path) {
  this.graph = graph;
  this.path = path;
  this.schema = graph.schema;
};

Data.Property.__prototype__ = function() {

  this.get = function() {
    var item = this.graph;
    for (var idx = 0; idx < this.path.length; idx++) {
      if (item === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(this.path));
      }
      if (item === this.graph) {
        item = item.get(this.path[idx]);
      } else {
        item = item[this.path[idx]];
      }
    }
    return item;
  };

  this.set = function(value) {
    var item = this.graph;
    for (var idx = 0; idx < this.path.length-1; idx++) {
      if (item === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(this.path));
      }
      if (item === this.graph) {
        item = item.get(this.path[idx]);
      } else {
        item = item[this.path[idx]];
      }
    }
    var valueType = this.type()[0];
    item[this.path[idx]] = this.schema.parseValue(valueType, value);
  };

  this.type = function() {
    // TODO: currently we do not resolve types accross node references
    // so, either the node is the graph or a property fou
    var node = this.node();
    return this.graph.propertyType(node, this.path.slice(1));
  };

  this.node = function() {
    var node = (this.path.length > 0) ? this.graph.get(this.path[0]) : this.graph;
    return node;
  };

  this.key = function() {
    return this.path[this.path.length-1];
  };

};
Data.Property.prototype = new Data.Property.__prototype__();

// Resolves the containing node and the node relative path to a property
// --------
//
Data.Property.resolve = function(graph, path) {

  var result = {};

  if (path.length === 0) {
    result.node = graph;
    result.path = [];
  } else {
    // TODO: it would be great if we could resolve references stored in properties (using schema)
    //       for now, the first fragment of the path is the id of a node or empty
    result.node = graph.get(path[0]);
    result.path = path.slice(1);
  }

  // in case the path is used to specify a new node
  if (result.node === undefined && path.length === 1) {
    result.node = graph;
    result.path = path;
  }

  return result;
};

Data.Command = function(options) {

  if (!options) throw new Error("Illegal argument: expected command spec, was " + options);

  // convert the convenient array notation into the internal object notation
  if (_.isArray(options)) {
    var op = options[0];
    var path = options.slice(1);
    var args = _.last(path);

    options = {
      op: op,
      path: path
    };

    if (_.isObject(args)) {
      options.args = path.pop();
    }
  }

  this.op = options.op;
  this.path = options.path;
  this.args = options.args;
};

Data.Command.__prototype__ = function() {

  this.clone = function() {
    return new Data.Command(this);
  };

  this.toJSON = function() {
    return {
      op: this.op,
      path: this.path,
      args: this.args
    };
  };
};

Data.Command.prototype = new Data.Command.__prototype__();

// Factory methods
// ---------

Data.Graph.NOP = function() {
  return new Data.Command({
    op: "NOP"
  });
};

Data.Graph.Create = function(node) {
  return new Data.Command({
    op: "create",
    path: [],
    args: node
  });
};

Data.Graph.Delete = function(node) {
  return new Data.Command({
    op: "delete",
    path: [],
    args: node
  });
};

Data.Graph.Update = function(path, diff) {
  return new Data.Command({
    op: "update",
    path: path,
    args: diff
  });
};

Data.Graph.Set = function(path, val) {
  return new Data.Command({
    op: "set",
    path: path,
    args: val
  });
};

if (typeof exports !== 'undefined') {
  module.exports = Data;
} else {
  root.Substance.Data = Data;
}

})(this);

// TODO: this was pulled from the test case and should be revisited and merged into
// the Graph documentation.
// We should decide what convenience methods are wanted, and if we want to introduce
// NumberOperations as well.

// Graph operations
// ================
//
// Message format
// [:opcode, :target, :data] where opcodes can be overloaded for different types, the type is determined by the target (can either be a node or node.property),
//                           data is an optional hash
//
// Node operations
// --------
// create heading node
// ["create", {id: "h1", type: "heading", "content": "Hello World" } ]
//
// internal representation:
// { op: "create", path: [], args: {id: "h1", type: "heading", "content": "Hello World" } }
//
// delete node
// ["delete", {"id": "t1"}]

// String operations
// ---------
//
// update content (String OT)
// ["update", "h1", "content", [-1, "ABC", 4]]
//

// Number operations
// ---------
//
// update content (String OT)
// ["increment", "h1.level"]
//

// Array operations
// ---------------

// Push new value to end of array
// ["push", "content_view.nodes", {value: "new-entry"}]
//
// Delete 1..n elements
// ["delete", "content_view.nodes", {values: ["v1", "v2"]}]

// Insert element at position index
// ["insert", "content_view.nodes", {value: "newvalue", index: 3}]

