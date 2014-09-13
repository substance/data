var _ = require('underscore');
var Graph = require('./graph');
var Property = require('./property');
var GraphError = Graph.GraphError;

var CopyOnWriteGraph = function(graph) {
  this.original = graph;
  this.nodes = CopyOnWriteGraph.cowObject(graph.nodes);
  this.objectAdapter = new Graph.ObjectAdapter(this);
  this.schema = graph.schema;
  this.indexes = {};
  this.chronicle = undefined;
  this.isVersioned = false;
};

CopyOnWriteGraph.Prototype = function() {
  this.get = function(path) {
    if (path === undefined || path === null) {
      throw new GraphError("Invalid argument: provided undefined or null.");
    }
    if (!_.isArray(path) && !_.isString(path)) {
      throw new GraphError("Invalid argument path. Must be String or Array");
    }
    if (_.isString(path)) path = [path];
    var prop = this.resolve(path);
    return prop.get();
  };
  this.resolve = function(path) {
    return new CopyOnWriteGraph.CowProperty(this, path);
  };
  this._delete = function(node) {
    this.nodes[node.id] = undefined;
    this.trigger("node:deleted", node.id);
  };
};
CopyOnWriteGraph.Prototype.prototype = Graph.prototype;
CopyOnWriteGraph.prototype = new CopyOnWriteGraph.Prototype();

CopyOnWriteGraph.cowObject = function(obj) {
  var result;
  if (_.isObject(obj)) {
    if (obj.copyOnWriteClone) {
      result = obj.copyOnWriteClone();
    } else {
      result = Object.create(obj);
    }
  } else if (_.isArray(obj)) {
    result = obj.slice(0);
  } else {
    return obj;
  }
  result.__COW__ = true;

  return result;
};

CopyOnWriteGraph.CowProperty = function(graph, path) {
  Property.call(this, graph, path);
  this.graph = graph;
  this.path = path;

};
CopyOnWriteGraph.CowProperty.Protoype = function() {

  this.init = function() {
    this.context = this.graph.nodes;
    this.key = this.path[this.path.length-1];
    var child;
    for (var i = 0; i < this.path.length - 1; i++) {
      child = this.context[this.path[i]];
      if (child === undefined || child === null) {
        this.context = [];
        this.baseType = undefined;
        return;
      }
      else if (!child.__COW__) {
        child = CopyOnWriteGraph.cowObject(child);
        this.context[this.path[i]] = child;
      }
      this.context = child;
    }
    if (this.context === this.graph.nodes) {
      this.baseType = 'graph';
    } else {
      this.baseType = this.graph.schema.getPropertyBaseType(this.context.type, this.key);
    }
  };

  this.get = function() {
    var result = this.context[this.key];
    if (_.isObject(result) && !result.__COW__) {
      result = CopyOnWriteGraph.cowObject(result);
      this.context[this.key] = result;
    }
    return result;
  };

};
CopyOnWriteGraph.CowProperty.Protoype.prototype = Property.prototype;
CopyOnWriteGraph.CowProperty.prototype = new CopyOnWriteGraph.CowProperty.Protoype();

module.exports = CopyOnWriteGraph;