var _ = require("underscore");
var Operator = require("substance-operator");


// Dispatches 'graph:changed' events by on a property level
// restricting updates by applying path based filters, for instance.
var PropertyChangeAdapter = function(graph) {
  // for now a canonical implementation, all listeners flat in an array
  this.graph = graph;
  this.listeners = [];
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
      var item = self.listeners[idx];
      var listener = item.handler;
      var filter = item.filter;
      var context = item.context;

      // check if the operation passes the filter
      if (_.isFunction(filter)) {
        if (filter.call(context, objOp)) continue;
      } else {
        if (filter.type && filter.type !== objOp.type) continue;
        if (filter.path && !matchPath(objOp.path, filter.path)) continue;
        if (filter.propertyType) {
          if (objOp.propertyType === undefined || objOp.propertyType !== filter.propertyType) continue;
        }
      }


      // if the listener is given as function call it,
      // otherwise it is assumed that the listener implements an adequate
      // adapter interface to which the operation can be applied, making a
      // *co-transformation*.
      // Note: in the later case the adapter is directly used to apply a co-transformation
      if (_.isFunction(listener)) {
        listener.call(context, objOp);
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

  this.bind = function(listener, filter, context) {
    if (!listener) {
      throw new Error("Illegal arguments.");
    }
    this.listeners.push({
      handler: listener,
      filter: filter,
      context: context
    });
  };

  this.unbind = function(listener) {
    var pos;
    for (pos = this.listeners.length - 1; pos >= 0; pos--) {
      if (this.listeners[pos].handler === listener) break;
    }
    if (pos < 0) {
      return console.log("Listener is not registered. Ignored.");
    }

    this.listeners.splice(pos, 1);
  };

};
PropertyChangeAdapter.prototype = new PropertyChangeAdapter.__prototype__();

module.exports = PropertyChangeAdapter;
