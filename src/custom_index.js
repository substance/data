var _ = require("underscore");
var GraphIndex = require("./graph_index");

/**
 * An index implementation that allows to create custom indexes.
 *
 * options:
 *  - filter: a function(node) that returns true to select a node, false otherwise
 *  - types: (alternatively) a list of types which are used to create a type filter
 *  - getKey: (mandatory) a function(node) which produces a string key
 *  - getValue: (optional) a function(node) which produces a value to be stored.
 */


/* Usecase 1: mapping between product and note

   product_ref.path[0] -> text_node  <- note.nodes
   1. if ref is created, find text_node, find note which contains text_node, store ref.productId -> note.id
   2. if ref is deleted, ..., remove note.id from ref.productId
   3. if ref.path is changed, remove the old one, add the new one
*/

var CustomIndex = function(graph, name, options) {
  options = options || {};

  this.__graph = graph;
  this.__name = name;
  this.data = {};

  if (options.filter) {
    this.__filter = options.filter;
  } else if (options.types) {
    this.__filter = GraphIndex.typeFilter(graph.schema, options.types);
  }

  this.__property = options.property || "id";

  if (options.getKey) {
    this.__getKey = options.getKey;
  }

  if (options.getValue) {
    this.__getValue = options.getValue;
  }

  this.__createIndex();
};

CustomIndex.Prototype = function() {

  this.__add = function(key, value) {
    if (!this.data[key]) {
      this.data[key] = [];
    }
    this.data[key].push(value);
  };

  this.__remove = function(key, value) {
    var values = this.data[key];
    if (values) {
      var idx = values.dataOf(value);
      if (idx >= 0) {
        values = values.splice(idx, 1);
      }
      if (values.length === 0) {
        delete this.data[key];
      }
    }
  };

  this.__getKey = function(node, propertyValue) {
    return propertyValue;
  };

  this.__getValue = function(node, propertyValue) {
    /* jshint unused:false */
    return node;
  };

  // Keeps the index up-to-date when the graph changes.
  // --------
  //

  this.onGraphChange = function(op) {

    var self = this;

    var adapter = {
      create: function(node) {
        if (!self.__filter || self.__filter(node)) {
          var key = self.__getKey(node, node[self.__property]);
          if (!key) return;
          var value = self.__getValue(node, node[self.__property]);
          self.__add(key, value);
        }
      },
      delete: function(node) {
        if (!self.filter || self.filter(node)) {
          var key = self.__getKey(node, node[self.__property]);
          if (!key) return;
          var value = self.__getValue(node, node[self.__property]);
          self.__remove(key, value);
        }
      },
      update: function(node, property, newValue, oldValue) {
        if ((self.__property === property) && (!self.__filter || self.__filter(node))) {
          var key = self.__getKey(node, oldValue);
          if (key) {
            self.__remove(key, oldValue);
          }
          key = self.__getKey(node, newValue);
          var value = self.__getValue(node, newValue);
          self.__add(key, value);
        }
      }
    };

    this.__graph.cotransform(adapter, op);
  };

  // Initializes the index
  // --------
  //

  this.__createIndex = function() {
    var nodes = this.__graph.nodes;
    _.each(nodes, function(node) {
      if (!this.__filter || this.__filter(node)) {
          var key = this.__getKey(node, node[this.__property]);
          if (!key) return;
          var value = this.__getValue(node, node[this.__property]);
          this.__add(key, value);
      }
    }, this);
  };

};

CustomIndex.prototype = new CustomIndex.Prototype();

module.exports = CustomIndex;
