var _ = require("underscore");
var Operator = require("substance-operator");


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

module.exports = PropertyChangeAdapter;
