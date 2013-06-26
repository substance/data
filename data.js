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
  'string',
  'object',
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

  this.defaultValue = function(type) {
    if (type === "array") return [];
    if (type === "number") return 0;
    if (type === "date") return new Date();
    if (type === "string") return "";
    if (type === "boolean") return false;
    if (type === "object") return {};
  };

  // Return type object for a given type id
  // --------
  //

  this.checkType = function(propertyBaseType, value) {
    if (propertyBaseType === "array") return _.isArray(value);
    if (propertyBaseType === "number") return _.isNumber(value);
    if (propertyBaseType === "string") return _.isString(value);
  };

  // Return type object for a given type id
  // --------
  //

  this.parseValue = function(propertyBaseType, value) {
    if (propertyBaseType === "array") return JSON.parse(value);
    if (propertyBaseType === "number") return parseInt(value, 10);
    return value;
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
    var type = this.type(typeId);
    if (!type) throw new Error('Type ' + typeId + ' not found in schema');
    if (type.parent) {
      return [type.parent, typeId];
    } else {
      return [typeId];
    }
  };

  this.baseType = function(typeId) {
    return this.typeChain(typeId)[0];
  };

  // Return all properties for a given type
  // --------
  //

  this.properties = function(type) {
    type = _.isObject(type) ? type : this.type(type);
    var result = type.parent ? this.types[type.parent].properties : {};
    _.extend(result, type.properties);
    return result;
  };

  // Returns the property type for a given type
  // --------
  //
  // => ["array", "string"]

  this.propertyType = function(type, property) {
    var properties = this.properties(type);
    var propertyType = properties[property];
    if (!propertyType) throw new Error("Property not found for" + type +'.'+property);
    return _.isArray(propertyType) ? propertyType : [propertyType];
  };

  // Returns the property base type
  // --------
  //
  // => "string"

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
// --------------

// A `Data.Graph` can be used for representing arbitrary complex object
// graphs. Relations between objects are expressed through links that
// point to referred objects. Data.Graphs can be traversed in various ways.
// See the testsuite for usage.

Data.Graph = function(schema, graph) {
  // Initialization
  this.schema = new Data.Schema(schema);

  this.nodes = {};
  this.indexes = {};

  this.initIndexes();

  // Populate graph
  if (graph) this.merge(graph);
};

Data.Graph.__prototype__ = function() {

  var _private = new Data.Graph.__private__();

  this.get = function(id) {
    return this.nodes[id];
  };

  this.set = function(id, node) {
    this.nodes[id] = node;
  };

  this.create = function(node) {
    var newNode = Data.Node.create(this.schema, node);
    this.set(newNode.id, newNode);

    this.addToIndex(newNode);
    return this;
  };

  // Delete node by id, referenced nodes remain untouched
  this.delete = function(id) {
    // TODO: update indexes
    this.removeFromIndex(this.nodes[id]);
    delete this.nodes[id];
  };

  this.exec = function(command) {
    //console.log("Executing command: ", command);
    command = new Data.Command(command);
    command.apply(this);
    return command;
  };

  this.resolve = function(path) {
    return new Data.Property(this, path);
  };

  this.reset = function() {
    this.nodes = {};

    // TODO: derive from schema
    this.indexes = {
      // "comments": {},
      // "annotations": {}
    };

    this.initIndexes();
  };

  // Merge in a serialized graph
  // --------
  //

  this.merge = function(graph) {
    _.each(graph.nodes, function(n) {
      graph.create(n);
    });
  };

  // Setup indexes data-structure based on schema information
  // --------
  //

  this.initIndexes = function() {
    this.indexes = {};
    _.each(this.schema.indexes, function(index, key) {
      if (index.properties.length > 1) throw new Error('No multi-property indexes supported yet');
      if (index.properties.length === 1) {
        this.indexes[key] = {};
      } else {
        this.indexes[key] = [];
      }
    }, this);
  };

  // Adds a node to indexes
  // --------
  //

  this.addToIndex = function(node) {
    _.each(this.schema.indexes, function(indexSpec, key) {
      // skip irrelevant indexes
      if (_private.matchIndex(this.schema, node.type, indexSpec.type)) {
        _private.addToIndex(indexSpec, this.indexes[key], node);
      }
    }, this);
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
        _private.removeFromIndex(indexSpec, index, node);
      }

    }, this);
  };

  // Updates all indexes affected by the change of a given property
  // --------
  //

  this.updateIndex = function(property, oldValue) {
    if (oldValue === property.get()) return;

    _.each(this.schema.indexes, function(indexSpec, key) {
      // skip unrelated indexes
      if (_private.matchIndex(this.schema, property.node.type, indexSpec.type)) {
        _private.updateIndex(indexSpec, this.indexes[key], property, oldValue);
      }

    }, this);
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

Data.Graph.__private__ = function() {

  this.matchIndex = function(schema, nodeType, indexType) {
    var typeChain = schema.typeChain(nodeType);
    return (typeChain.indexOf(indexType) >= 0);
  };

  this.addToIndex = function(indexSpec, index, node) {

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

  // Silently remove node from index
  // --------

  this.removeFromIndex = function(indexSpec, index, node) {
    var groups = indexSpec.properties;
    if (groups) {
      // remove the node from every group
      for (var i = 0; i < groups.length; i++) {
        var groupKey = groups[i];
        // Note: grouping is only supported for first level properties
        var groupVal = node[groupKey];
        if (groupVal === undefined) {
          throw new Error("Illegal node: missing property for indexing " + groupKey);
        }

        index[groupVal] = _.without(index[groupVal], node.id);
        // prune empty groups
        if (index[groupVal].length === 0) delete index[groupVal];
      }
    } else {
      index = _.without(index, node.id);
    }
  };

  this.updateIndex = function(indexSpec, index, property, oldValue) {
    // Note: grouping indexes are currently only supported for the first property level
    if (property.path.length > 1) {
      throw new Error("Indexes are supported only for nodes and first-level properties used for grouping");
    }

    // Note: intentionally, this is not implemented by delegating to removeFromIndex
    //  and addToIndex. The reason, removeFromIndex erases every occurance of the
    //  modified property. Instead we have to update only the affected indexes,
    //  i.e., those which are registered to the property key

    var groups = indexSpec.properties;

    var groupIdx = groups.indexOf(property.path[0]);

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
};

Data.Graph.prototype = _.extend(new Data.Graph.__prototype__(), util.Events);


Data.Property = function(graph, path) {
  var resolved = Data.Property.resolve(graph, path);

  this.node = resolved.node;
  this.path = resolved.path;
  this.schema = graph.schema;

  if (this.node === undefined) {
    throw new Error("Could not look up property for path " + path.join("."));
  }

  this.type = graph.propertyType(this.node, this.path);
  this.baseType = this.type[0];
};

Data.Property.__prototype__ = function() {

  this.get = function() {
    var item = this.node;
    for (var idx = 0; idx < this.path.length; idx++) {
      if (item === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(this.path));
      }
      item = item[this.path[idx]];
    }
    return item;
  };

  this.set = function(value) {
    var item = this.node;
    for (var idx = 0; idx < this.path.length-1; idx++) {
      if (item === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(this.path));
      }
      item = item[this.path[idx]];
    }
    item[this.path[idx]] = this.schema.parseValue(this.baseType, value);
  };

  this.getKey = function() {
    return _.last(this.path);
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

  return result;
};

var GraphMethods = function() {

  this.NOP = function() {
  };

  // Node manipulation
  // --------

  this.create = function(graph, path, args) {
    graph.create(args);
  };

  this.delete = function(graph, path, args) {
    graph.delete(args.id);
  };

  // Diff based update
  // --------

  this.update = function(graph, path, args) {

    var property = graph.resolve(path);
    var oldValue = util.deepclone(property.get());

    if (property.baseType === 'array') {
      // operation works inplace
      ot.ArrayOperation.apply(args, property.get());

    } else if (property.baseType === 'object') {
      // operation works inplace
      ot.ObjectOperation.apply(args, property.get());

    }
    // Everything that's not an array is considered a string
    else {
      var val = property.get().toString();
      val = ot.TextOperation.apply(args, val);
      property.set(val);
    }

    graph.updateIndex(property, oldValue);
  };

  // Convenience methods
  // --------
  //
  // Everything must be done using the primitive commands.

  // Array manipulation
  // --------

  this.pop = function(graph, path) {
    var array = graph.resolve(path).get();
    var result = array[array.length-1];
    if (array.length > 0) {
      this.update(graph, path, ot.ArrayOperation.Delete(array.length-1, result));
    }
    return result;
  };

  this.push = function(graph, path, args) {
    var array = graph.resolve(path).get();
    this.update(graph, path, ot.ArrayOperation.Insert(array.length, args.value));
  };

  this.insert = function(graph, path, args) {
    this.update(graph, path, ot.ArrayOperation.Insert(args.index, args.value));
  };

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

  var methods = new GraphMethods();

  this.apply = function(graph) {
    if (!methods[this.op]) {
      throw new Error("Unknown operation: " + this.op);
    }

    methods[this.op](graph, this.path, this.args);
  };

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

Data.Graph.Update = function(path, update) {
  return new Data.Command({
    op: "update",
    path: path,
    args: update
  });
};

if (typeof exports !== 'undefined') {
  module.exports = Data;
} else {
  root.Substance.Data = Data;
}

})(this);
