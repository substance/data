//     (c) 2012 Michael Aufreiter
//     Data.js is freely distributable under the MIT license.
//     Portions of Data.js are inspired or borrowed from Underscore.js,
//     Backbone.js and Google's Visualization API.
//     For all details and documentation:
//     http://substance.io/michael/data-js

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

// Data.Graph
// --------------

// A `Data.Graph` can be used for representing arbitrary complex object
// graphs. Relations between objects are expressed through links that
// point to referred objects. Data.Graphs can be traversed in various ways.
// See the testsuite for usage.

Data.Graph = function(schema) {
  this.schema = schema;

  this.nodes = {};
  this.indexes = {
    "comments": {},
    "annotations": {}
  };
};


Data.Graph.__prototype__ = function() {

  this.getTypes = function(typeId) {
    var type = this.schema.types[typeId];
    if (type.parent) {
      return [type.parent, typeId];
    } else {
      return [typeId];
    }
  };

  // Rebuild all indexes
  this.buildIndexes =  function() {
    this.indexes = {};
    _.each(this.nodes, function(node) {
      _.each(this.schema.indexes, function(index, key) {
        this.addToIndex(key, node);
      }, this);
    }, this);
  };

  // Add node to index
  this.addToIndex = function(node) {

    var self = this;
    function add(index) {
      var indexSpec = self.schema.indexes[index];
      var indexes = self.indexes;

      var idx = indexes[index];
      if (!_.include(self.getTypes(node.type), indexSpec.type)) return;

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

      if (!_.include(self.getTypes(node.type), indexSpec.type)) return;

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

      if (!_.include(self.getTypes(node.type), indexSpec.type)) return;

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
    this.nodes[node.id] = util.deepclone(node);
    this.addToIndex(node);
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

  this.propertyType = function(node, key) {
    var properties = this.properties(this.schema.types[node.type]);
    return properties[key];
  };

  this.reset = function() {
    this.nodes = {};

    // TODO: derive from schema
    this.indexes = {
      "comments": {},
      "annotations": {}
    };
  };

}

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

    if (property.type === 'string') {
      try {
        op = TextOperation.fromJSON(args);
      } catch (err) {
        throw new Error("Illegal argument: provided diff is not a valid TextOperation: " + args);
      }
      property.set(op.apply(property.get()));
    } else if (property.type === 'array') {
      try {
        op = ArrayOperation.fromJSON(args);
      } catch (err) {
        throw new Error("Illegal argument: provided diff is not a valid ArrayOperation: " + args);
      }
      // Note: the array operation works inplace
      op.apply(property.get());
    } else {
      throw new Error("Illegal type: incremental update not available for type " + property.type);
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

  // hacky conversion to allow convenient notation: ["delete", <id>]
  // the internal representation is: {op: "delete", path: [], args: {id: <id>}}
  if (this.op === "delete" && !this.args) {
    this.args = {id: this.path.pop()};
  }

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
