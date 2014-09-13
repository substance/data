"use strict";

var Data = {};

// Current version of the library. Keep in sync with `package.json`.
Data.VERSION = '0.8.0';

Data.Graph = require('./src/graph');

Data.COWGraph = require('./src/cow_graph');

var _ = require("underscore");
// A helper that is used by Graph node implementations
Data.defineNodeProperties = function(prototype, properties, readonly) {
  _.each(properties, function(name) {
    var spec = {
      get: function() {
        return this.properties[name];
      }
    };
    if (!readonly) {
      spec["set"] = function(val) {
        this.properties[name] = val;
        return this;
      };
    }
    Object.defineProperty(prototype, name, spec);
  });
};

module.exports = Data;
