//     (c) 2013 Michael Aufreiter
//     Data.js is freely distributable under the MIT license.
//     Portions of Data.js are inspired or borrowed from Underscore.js,
//     Backbone.js and Google's Visualization API.
//     For all details and documentation:
//     http://github.com/michael/data

(function(root){

var _,
    util,
    errors,
    Chronicle;

if (typeof exports !== 'undefined') {
  _    = require('underscore');
  // Should be require('substance-util') in the future
  util   = require('./lib/util/util');
  errors   = require('./lib/util/errors');
  Chronicle = require('./lib/chronicle/chronicle');
} else {
  _ = root._;
  util = root.Substance.util;
  errors   = root.Substance.errors;
  Chronicle   = root.Substance.Chronicle;
}

var ArrayOperation = Chronicle.OT.ArrayOperation;
var TextOperation = Chronicle.OT.TextOperation;


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


// Return Default value for a given type
// --------
// 

Data.Schema.prototype.defaultValue = function (type) {
  if (type === "array") return [];
  if (type === "number") return 0;
  if (type === "string") return "";
};


// Return type object for a given type id
// --------
// 

Data.Schema.prototype.checkType = function (propertyBaseType, value) {
  if (type === "array") return _.isArray(value);
  if (type === "number") return _.isNumber(value);
  if (type === "string") return _.isString(value);
};



// Return type object for a given type id
// --------
// 

Data.Schema.prototype.type = function(typeId) {
  return this.types[typeId];
};


// For a given type id return the type hierarchy
// --------
// 
// => ["base_type", "specific_type"]

Data.Schema.prototype.typeChain = function(typeId) {
  var type = this.type(typeId);
  if (type.parent) {
    return [type.parent, typeId];
  } else {
    return [typeId];
  }
};


// Return all properties for a given type
// --------
// 

Data.Schema.prototype.properties = function(type) {
  var type = _.isObject(type) ? type : this.type(type);
  var result = type.parent ? this.types[type.parent].properties : {};
  _.extend(result, type.properties);
  return result;
};


// Returns the property type for a given type
// --------
// 
// => ["array", "string"]

Data.Schema.prototype.propertyType = function(type, property) {
  var properties = this.properties(type);
  var propertyType = properties[property];
  if (!propertyType) throw new Error("Property not found for" + type +'.'+property);
  return _.isArray(propertyType) ? propertyType : [propertyType];
};


// Returns the property base type
// --------
// 
// => "string"

Data.Schema.prototype.propertyBaseType = function(type, property) {
  return this.propertyType(type, property)[0];
};



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
    freshNode[key] = val;
  });

  return freshNode;
}


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
  this.initIndexes();

  // Populate graph
  if (graph) this.merge(graph);
};


Data.Graph.__prototype__ = function() {

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
  },

  // Merge in a serialized graph
  // --------
  // 
  // Existing nodes

  this.merge = function(graph) {
    _.each(graph.nodes, function(n) {
      graph.create(n);
    });
  },

  // Add node to index
  this.addToIndex = function(node) {
    var self = this;
    function add(index) {
      var indexSpec = self.schema.indexes[index];
      var indexes = self.indexes;

      var idx = indexes[index];
      if (!_.include(self.schema.typeChain(node.type), indexSpec.type)) return;

      // Create index if it doesn't exist
      var prop = indexSpec.properties[0];
      if (prop) {
        if (!idx) idx = indexes[index] = {};
        if (!node[prop]) return; // skip falsy values
        // Scoped by one property
        if (!idx[node[prop]]) {
          idx[node[prop]] = [node.id];
        } else {
          idx[node[prop]].push(node.id);
        }
      } else {
        // Flat indexes
        if (!idx) idx = indexes[index] = [];
        idx.push(node.id);
      }
    }

    _.each(this.schema.indexes, function(index, key) {
      add(key);
    });
  };

  // Silently remove node from index
  // --------

  this.removeFromIndex = function(node) {
    var self = this;
    function remove(index) {
      var indexSpec = self.schema.indexes[index];
      var indexes = self.indexes;
      var scopes = indexes[index];

      // Remove when source
      if (scopes[node.id]) {
        delete scopes[node.id];
      }

      if (!_.include(self.schema.typeChain(node.type), indexSpec.type)) return;

      // Remove when target
      var prop = indexSpec.properties[0];

      var nodes = scopes[node[prop]];
      if (nodes) {
        scopes[node[prop]] = _.without(nodes, node.id);
      }
    }

    _.each(this.schema.indexes, function(index, key) {
      remove(key);
    });
  };

  // TODO: Prettify -> Code duplication alert
  this.updateIndex = function(node, prevNode) {

    var self = this;
    function update(index) {
      var indexSpec = self.schema.indexes[index];
      var indexes = self.indexes;

      var scopes = indexes[index];

      if (!_.include(self.schema.typeChain(node.type), indexSpec.type)) return;

      // Remove when target
      var prop = indexSpec.properties[0];

      var nodes = scopes[prevNode[prop]];
      if (nodes) {
        scopes[prevNode[prop]] = _.without(nodes, prevNode.id);
      }

      // Create index if it doesn't exist
      if (!scopes) scopes = indexes[index] = {};
      prop = indexSpec.properties[0];

      if (!scopes[node[prop]]) {
        scopes[node[prop]] = [node.id];
      } else {
        scopes[node[prop]].push(node.id);
      }
    }

    _.each(this.schema.indexes, function(index, key) {
      update(key);
    });
  };


  // View Traversal
  // --------

  this.traverse = function(view) {
    return _.map(this.views[view], function(node) {
      return this.nodes[node];
    }, this);
  };

  // Find data nodes based on index
  // --------

  this.find = function(index, scope) {
    var indexes = this.indexes;
    var nodes = this.nodes;

    function wrap(nodeIds) {
      return _.map(nodeIds, function(n) {
        return nodes[n];
      });
    }

    if (!indexes[index]) return []; // throw index-not-found error instead?
    if (_.isArray(indexes[index])) return wrap(indexes[index]);
    if (!indexes[index][scope]) return [];

    return wrap(indexes[index][scope]);
  };

  this.get = function(id) {
    return this.nodes[id];
  };

  this.create = function(node) {
    var newNode = Data.Node.create(this.schema, node);
    this.nodes[newNode.id] = newNode;

    console.log(newNode);

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
    console.log("Executing command: ", command);
    new Data.Graph.Command(command).apply(this);
  };

  this.resolve = function(path) {
    if (path.length === 0) return this;

    // resolve the item for manipulation
    // TODO: it would be great if we could resolve references stored in properties (using schema)
    var node = this.get(path[0]);
    for (var idx = 1; idx < path.length; idx++) {
      node = node[path[idx]];
      if (node === undefined) {
        throw new Error("Key error: could not find element for path " + JSON.stringify(path));
      }
    }
    return node;
  };

  this.properties = function(type) {
    var result = type.parent ? this.schema.types[type.parent].properties : {};
    _.extend(result, type.properties);
    return result;
  };

  // Returns the property type
  // TODO: should take typename, key instead of node object, key
  this.propertyType = function(node, key) {
    var properties = this.properties(this.schema.types[node.type]);
    var type = properties[key];
    return _.isArray(type) ? type : [type];
  };

  // Returns just the basetype
  // TODO: should take typename, key instead of node object, key
  this.propertyBaseType = function(node, key) {
    return this.propertyType(node, key)[0];
  };




  this.reset = function() {
    this.nodes = {};

    // TODO: derive from schema
    this.indexes = {
      // "comments": {},
      // "annotations": {}
    };
  };

};

Data.Graph.prototype = _.extend(new Data.Graph.__prototype__(), util.Events);

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

  // Array manipulation
  // --------

  this.pop = function(graph, path) {
    var array = graph.resolve(path);
    array.pop();
  };

  this.push = function(graph, path, args) {
    var array = graph.resolve(path);
    array.push(args.value);
  };

  this.insert = function(graph, path, args) {
    var array = graph.resolve(path);
    array.splice(args.index, 0, args.value);
  };

  // Diff based update
  // --------

  this.update = function(graph, path, args) {

    var property = new Data.Graph.Property(graph, path);
    var oldNode = util.deepclone(property.node);
    var op;

    if (property.baseType === 'array') {
      try {
        op = ArrayOperation.fromJSON(args);
      } catch (err) {
        throw new Error("Illegal argument: provided diff is not a valid ArrayOperation: " + args);
      }
      // Note: the array operation works inplace
      op.apply(property.get());
    } else { // Everything that's not an array is considered a string
      try {
        op = TextOperation.fromJSON(args);
      } catch (err) {
        throw new Error("Illegal argument: provided diff is not a valid TextOperation: " + args);
      }
      property.set(op.apply(property.get()));
    }

    graph.updateIndex(property.node, oldNode);
  };

};

var GraphCommand = function(options) {

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

GraphCommand.__prototype__ = function() {

  var methods = new GraphMethods();

  this.apply = function(graph) {
    if (!methods[this.op]) {
      throw new Error("Unknown operation: " + this.op);
    }

    methods[this.op](graph, this.path, this.args);
  };

  this.copy = function() {
    return new GraphCommand(this);
  };

  this.toJSON = function() {
    return {
      op: this.op,
      path: this.path,
      args: this.args
    };
  };
};

GraphCommand.prototype = new GraphCommand.__prototype__();

var Property = function(graph, path) {
  this.key = _.last(path);
  this.node = graph.resolve(path.slice(0, -1));
  if (this.node === undefined) {
    throw new Error("Could not look up property for path " + path.join("."));
  }

  this.type = graph.propertyType(this.node, this.key);
  this.baseType = this.type[0];
};

Property.prototype = {
  get: function() {
    return this.node[this.key];
  },

  set: function(value) {
    this.node[this.key] = value;
  }
};


Data.Graph.Command = GraphCommand;
Data.Graph.Property = Property;

if (typeof exports !== 'undefined') {
  exports = Data;
} else {
  root.Substance.Data = Data;
}

})(this);
