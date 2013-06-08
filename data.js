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
Data.VERSION = '0.6.2';

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
};

_.extend(Data.Graph.prototype, util.Events, {

  // Merges in another Graph
//  merge: function(nodes) {
//    _.each(nodes, _.bind(function(n, key) { this.set(_.extend(n, { id: key })); }, this));
//    return this;
//  },

  // API method for accessing objects in the graph space
  get: function(id) {
    return this.nodes[id];
  },

  create: function(node) {
    this.nodes[node.id] = node;
    return this;
  },

  // Delete node by id, referenced nodes remain untouched
  "delete": function(id) {
    // TODO: update indexes
    delete this.nodes[id];
  },

  exec: function(command) {
    console.log("Executing command: ", command);
    new Data.Graph.Command(command).apply(this);
  },

  resolve: function(path) {
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
  },

  properties: function(type) {
    var result = type.parent ? this.schema.types[type.parent].properties : {};
    _.extend(result, type.properties);
    return result;
  },

  propertyType: function(node, key) {
    var properties = this.properties(this.schema.types[node.type]);
    return properties[key];
  },

});


Data.Graph.Command = function(options) {

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

var GraphMethods = function() {

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

    var key = _.last(path);
    var node = graph.resolve(path.slice(0, -1));
    var value = node[key];
    var type = graph.propertyType(node, key);
    var op;

    if (type === 'string') {
      try {
        op = TextOperation.fromJSON(args);
      } catch (err) {
        throw new Error("Illegal argument: provided diff is not a valid TextOperation: " + args);
      }
      node[key] = op.apply(value);
    } else if (type === 'array') {
      try {
        op = ArrayOperation.fromJSON(args);
      } catch (err) {
        throw new Error("Illegal argument: provided diff is not a valid ArrayOperation: " + args);
      }
      op.apply(value);
    } else {
      throw new Error("Illegal type: incremental update not available for type " + type);
    }
  };

};

Data.Graph.Command.__prototype__ = function() {

  var methods = new GraphMethods();

  this.apply = function(graph) {
    var method = methods[this.op];
    if (!method) {
      throw new Error("Unknown operation: " + this.op);
    }
    method(graph, this.path, this.args);
  };

};
Data.Graph.Command.prototype = new Data.Graph.Command.__prototype__();


if (typeof exports !== 'undefined') {
  exports = Data;
} else {
  root.Substance.Data = Data;
}

})(this);
