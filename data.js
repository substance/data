//     (c) 2012 Michael Aufreiter
//     Data.js is freely distributable under the MIT license.
//     Portions of Data.js are inspired or borrowed from Underscore.js,
//     Backbone.js and Google's Visualization API.
//     For all details and documentation:
//     http://substance.io/michael/data-js

(function(){

  // Initial Setup
  // -------------

  // The top-level namespace. All public Data.js classes and modules will
  // be attached to this. Exported for both CommonJS and the browser.
  var Data;
  if (typeof exports !== 'undefined') {
    Data = exports;
  } else {
    Data = this.Data = {};
  }
  
  // Current version of the library. Keep in sync with `package.json`.
  Data.VERSION = '0.6.0';

  // Require Underscore, if we're on the server, and it's not already present.
  var _ = this._;
  if (!_ && (typeof require !== 'undefined')) _ = require("underscore");
  
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
    return _.include(Data.VALUE_TYPES, type);
  };
  
  // Returns true if a certain object matches a particular query object
  // TODO: optimize!
  Data.matches = function(node, queries) {
    queries = _.isArray(queries) ? queries : [queries];
    var matched = false;
    // Matches at least one query
    _.each(queries, function(query) {
      if (matched) return;
      var rejected = false;
      _.each(query, function(value, key) {
        if (rejected) return;
        var condition;
        // Extract operator
        var matches = key.match(/^([a-z_]{1,30})(=|==|!=|>|>=|<|<=|\|=|&=)?$/),
            property = matches[1],
            operator = matches[2] || (property == "type" || _.isArray(value) ? "|=" : "=");
        
        if (operator === "|=") { // one of operator
          var values = _.isArray(value) ? value : [value];
          var objectValues = _.isArray(node[property]) ? node[property] : [node[property]];
          condition = false;
          _.each(values, function(val) {
            if (_.include(objectValues, val)) {
              condition = true;
            }
          });
        } else if (operator === "&=") {
          var values = _.isArray(value) ? value : [value];
          var objectValues = _.isArray(node[property]) ? node[property] : [node[property]];
          condition = _.intersect(objectValues, values).length === values.length;
        } else { // regular operators
          switch (operator) {
            case "!=": condition = !_.isEqual(node[property], value); break;
            case ">": condition = node[property] > value; break;
            case ">=": condition = node[property] >= value; break;
            case "<": condition = node[property] < value; break;
            case "<=": condition = node[property] <= value; break;
            default : condition = _.isEqual(node[property], value); break;
          }
        }
        // TODO: Make sure we exit the loop and return immediately when a condition is not met
        if (!condition) return rejected = true;
      });
      if (!rejected) return matched = true;
    });
    return matched;
  };
  
  
  /*!
  Math.uuid.js (v1.4)
  http://www.broofa.com
  mailto:robert@broofa.com

  Copyright (c) 2010 Robert Kieffer
  Dual licensed under the MIT and GPL licenses.
  */

  Data.uuid = function (prefix) {
    var chars = '0123456789abcdefghijklmnopqrstuvwxyz'.split(''),
        uuid = [],
        radix = 16,
        len = 32;

    if (len) {
      // Compact form
      for (var i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
    } else {
      // rfc4122, version 4 form
      var r;

      // rfc4122 requires these characters
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';

      // Fill in random data.  At i==19 set the high bits of clock sequence as
      // per rfc4122, sec. 4.1.5
      for (var i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | Math.random()*16;
          uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
        }
      }
    }
    return (prefix ? prefix : "") + uuid.join('');
  };

  // Helpers
  // -------

  // _.Events (borrowed from Backbone.js)
  // -----------------
  
  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may `bind` or `unbind` a callback function to an event;
  // `trigger`-ing an event fires all callbacks in succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.bind('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  
  _.Events = {

    // Bind an event, specified by a string name, `ev`, to a `callback` function.
    // Passing `"all"` will bind the callback to all events fired.
    bind : function(ev, callback) {
      var calls = this._callbacks || (this._callbacks = {});
      var list  = this._callbacks[ev] || (this._callbacks[ev] = []);
      list.push(callback);
      return this;
    },

    // Remove one or many callbacks. If `callback` is null, removes all
    // callbacks for the event. If `ev` is null, removes all bound callbacks
    // for all events.
    unbind : function(ev, callback) {
      var calls;
      if (!ev) {
        this._callbacks = {};
      } else if (calls = this._callbacks) {
        if (!callback) {
          calls[ev] = [];
        } else {
          var list = calls[ev];
          if (!list) return this;
          for (var i = 0, l = list.length; i < l; i++) {
            if (callback === list[i]) {
              list.splice(i, 1);
              break;
            }
          }
        }
      }
      return this;
    },

    // Trigger an event, firing all bound callbacks. Callbacks are passed the
    // same arguments as `trigger` is, apart from the event name.
    // Listening for `"all"` passes the true event name as the first argument.
    trigger : function(ev) {
      var list, calls, i, l;
      if (!(calls = this._callbacks)) return this;
      if (list = calls[ev]) {
        for (i = 0, l = list.length; i < l; i++) {
          list[i].apply(this, Array.prototype.slice.call(arguments, 1));
        }
      }
      if (list = calls['all']) {
        for (i = 0, l = list.length; i < l; i++) {
          list[i].apply(this, arguments);
        }
      }
      return this;
    }
  };

  // Shared empty constructor function to aid in prototype-chain creation.
  var ctor = function(){};

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  // Taken from Underscore.js (c) Jeremy Ashkenas
  _.inherits = function(parent, protoProps, staticProps) {
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call `super()`.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Add static properties to the constructor function, if supplied.
    if (staticProps) _.extend(child, staticProps);

    // Correctly set child's `prototype.constructor`, for `instanceof`.
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed later.
    child.__super__ = parent.prototype;

    return child;
  };
  
  
  // Data.Hash
  // --------------

  // A Hash data structure that provides a simple layer of abstraction for
  // managing a sortable data-structure with hash semantics. It's heavily
  // used throughout Data.js.
  
  Data.Hash = function(data) {
    var that = this;
    this.data = {};
    this.keyOrder = [];
    this.length = 0;

    if (data instanceof Array) {
      _.each(data, function(datum, index) {
        that.set(index, datum);
      });
    } else if (data instanceof Object) {
      _.each(data, function(datum, key) {
        that.set(key, datum);
      });
    }
    
    if (this.initialize) this.initialize(attributes, options);
  };

  _.extend(Data.Hash.prototype, _.Events, {

    // Returns a copy of the Hash
    // Used by transformation methods
    clone: function () {
      var copy = new Data.Hash();
      copy.length = this.length;
      _.each(this.data, function(value, key) {
        copy.data[key] = value;
      });
      copy.keyOrder = this.keyOrder.slice(0, this.keyOrder.length);
      return copy;
    },
    
    // Set a value at a given *key*
    set: function (key, value, targetIndex) {
      var index;
      if (key === undefined)
        return this;
      
      if (!this.data[key]) {
        if (targetIndex !== undefined) { // insert at a given index
          var front = this.select(function(item, key, i) {
            return i < targetIndex;
          });

          var back = this.select(function(item, key, i) {
            return i >= targetIndex;
          });

          this.keyOrder = [].concat(front.keyOrder);
          this.keyOrder.push(key);
          this.keyOrder = this.keyOrder.concat(back.keyOrder);
        } else {
          this.keyOrder.push(key);
        }
        index = this.length;
        this.length += 1;
      } else {
        index = this.index(key);
      }
      this.data[key] = value;
      
      this.trigger('set', key);
      return this;
    },
    
    // Delete entry at given *key*
    del: function (key) {
      if (this.data.hasOwnProperty(key)) {
        var l = this.length;
        var index = this.index(key);
        delete this.data[key];
        this.keyOrder.splice(index, 1);
        Array.prototype.splice.call(this, index, 1);
        this.length = l-1;
        this.trigger('del', key);
      }
      return this;
    },
    
    // Get value at given *key*
    get: function (key) {
      return this.data.hasOwnProperty(key) ? this.data[key] : undefined;
    },
    
    // Get value at given *index*
    at: function (index) {
      var key = this.keyOrder[index];
      return this.data[key];
    },
    
    // Get first item
    first: function () {
      return this.at(0);
    },
    
    // Returns a sub-range of the current *hash*
    range: function(start, end) {
      var result = new Data.Hash();
      for(var i=start; i<=end; i++) {
        result.set(this.key(i), this.at(i));
      }
      return result;
    },
    
    // Returns the rest of the elements. 
    // Pass an index to return the items from that index onward.
    rest: function(index) {
      return this.range(index, this.length-1);
    },
    
    // Get last item
    last: function () {
      return this.at(this.length-1);
    },
    
    // Returns for an index the corresponding *key*
    key: function (index) {
      return this.keyOrder[index];
    },
    
    // Returns for a given *key* the corresponding *index*
    index: function(key) {
      return this.keyOrder.indexOf(key);
    },
    
    // Iterate over values contained in the `Data.Hash`
    each: function (fn) {
      var that = this;
      _.each(this.keyOrder, function(key, index) {
        fn.call(that, that.data[key], key, index);
      });
      return this;
    },
    
    // Convert to an ordinary JavaScript Array containing just the values
    values: function () {
      var result = [];
      this.each(function(value, key, index) {
        result.push(value);
      });
      return result;
    },

    // Returns all keys in current order
    keys: function () {
      return _.clone(this.keyOrder);
    },
    
    // Convert to an ordinary JavaScript Array containing
    // key value pairs. Used by `sort`.
    toArray: function () {
      var result = [];
    
      this.each(function(value, key) {
        result.push({key: key, value: value});
      });
    
      return result;
    },
    
    // Serialize
    toJSON: function() {
      var result = {};
      
      this.each(function(value, key) {
        result[key] = value.toJSON ? value.toJSON() : value;
      });
      return result;
    },

    // Map the `Data.Hash` to your needs
    map: function (fn) {
      var result = this.clone(),
          that = this;
      result.each(function(item, key, index) {
        result.data[that.key(index)] = fn.call(result, item);
      });
      return result;
    },

    // Select items that match some conditions expressed by a matcher function
    select: function (fn) {
      var result = new Data.Hash(),
          that = this;
    
      this.each(function(value, key, index) {
        if (fn.call(that, value, key, index)) {
          result.set(key, value);
        }
      });
      return result;
    },
    
    // Performs a sort
    sort: function (comparator) {
      var result = this.clone(),
          sortedKeys = result.toArray().sort(comparator);
    
      // update keyOrder
      result.keyOrder = _.map(sortedKeys, function(k) {
        return k.key;
      });
      return result;
    },
    
    // Performs an intersection with the given *hash*
    intersect: function(hash) {
      var that = this,
          result = new Data.Hash();
      
      // Find out which hash is smaller
      var smaller, other;
      if (hash.length < that.length) {
        smaller = hash;
        other = that;
      } else {
        smaller = that;
        other = hash;
      }
      _.each(smaller.keyOrder, function (key) {
        // TODO: Test for existence of a key with Object.prototype.hasOwnProperty
        if (other.get(key)) {
          result.set(key, hash.get(key));
        }
      });
      return result;
    },
    
    // Performs an union with the given *hash*
    union: function(hash) {
      var that = this,
          result = new Data.Hash();
          
      this.each(function(value, key) {
        result.set(key, value);
      });
      hash.each(function(value, key) {
        if (!result.get(key)) result.set(key, value);
      });
      return result;
    },
    
    // Computes the difference between the current *hash* and a given *hash*
    difference: function(hash) {
      var that = this;
          result = new Data.Hash();
      this.each(function(value, key) {
        if (!hash.get(key)) result.set(key, value);
      });
      return result;
    }
  });
  
  
  // Data.Comparators
  // --------------

  Data.Comparators = {};
  
  Data.Comparators.ASC = function(item1, item2) {
    return item1.value === item2.value ? 0 : (item1.value < item2.value ? -1 : 1);
  };

  Data.Comparators.DESC = function(item1, item2) {
    return item1.value === item2.value ? 0 : (item1.value > item2.value ? -1 : 1);
  };
  
  
  // Data.Aggregators
  // --------------

  Data.Aggregators = {};

  Data.Aggregators.SUM = function (values) {
    var result = 0;
    values.each(function(value, key, index) {
      if (_.isNumber(value)) result += value;
    });
    return result;
  };

  Data.Aggregators.MIN = function (values) {
    var result = Infinity;
    values.each(function(value, key, index) {
      if (_.isNumber(value) && value < result) result = value;
    });
    return result;
  };

  Data.Aggregators.MAX = function (values) {
    var result = -Infinity;
    values.each(function(value, key, index) {
      if (_.isNumber(value) && value > result) result = value;
    });
    return result;
  };

  Data.Aggregators.AVG = function (values) {
    var sum = 0,
        count = 0;
    values.each(function(value, key, index) {
      if (_.isNumber(value)) {
        sum += value;
        count += 1;
      }
    });
    return count === 0 ? 0 : (sum / count);
  };

  Data.Aggregators.COUNT = function (values) {
    return values.length;
  };
  
  
  // Data.Modifiers
  // --------------
  
  Data.Modifiers = {};

  // The default modifier simply does nothing
  Data.Modifiers.DEFAULT = function (attribute) {
    return attribute;
  };

  Data.Modifiers.MONTH = function (attribute) {
    return attribute.getMonth();
  };

  Data.Modifiers.QUARTER = function (attribute) {
    return Math.floor(attribute.getMonth() / 3) + 1;
  };
  
  // Data.Transformers
  // --------------
  
  Data.Transformers = {
    group: function(g, type, keys, properties) {
      var gspec = {},
          type = g.get(type),
          groups = {},
          count = 0;
      
      gspec[type._id] = {"type": "/type/type", "properties": {}, indexes: type.indexes};

      // Include group keys to the output graph
      _.each(keys, function(key) {
        gspec[type._id].properties[key] = type.properties().get(key).toJSON();
      });
      
      // Include additional properties
      _.each(properties, function(options, key) {
        var p = type.properties().get(options.property || key).toJSON();
        if (options.name) p.name = options.name;
        gspec[type._id].properties[key] = p;
      });
      
      var groupedGraph = new Data.Graph(gspec);
      
      _.each(keys, function(key) {
        groups[key] = type.properties().get(key).all('values');
      });

      function aggregate(key) {
        var members = new Data.Hash();

        _.each(keys, function(k, index) {
          var objects = groups[keys[index]].get(key[index]).referencedObjects;
          members = index === 0 ? members.union(objects) : members.intersect(objects);
        });
        
        // Empty group key
        if (key.length === 0) members = g.objects();
        if (members.length === 0) return null;
        
        var res = {type: type._id};
        _.each(gspec[type._id].properties, function(p, pk) {
          if (_.include(keys, pk)) {
            res[pk] = key[_.indexOf(keys, pk)];
          } else {
            var numbers = members.map(function(obj) {
              return obj.get(properties[pk].property || pk);
            });
            var aggregator = properties[pk].aggregator || Data.Aggregators.SUM;
            res[pk] = aggregator(numbers);
          }
        });
        return res;
      }

      function extractGroups(keyIndex, key) {
        if (keyIndex === keys.length-1) {
          var aggregatedItem = aggregate(key);
          if (aggregatedItem) groupedGraph.set(key.join('::'), aggregatedItem);
        } else {
          keyIndex += 1;
          groups[keys[keyIndex]].each(function(grp, grpkey) {
            extractGroups(keyIndex, key.concat([grpkey]));
          });
        }
      }
      extractGroups(-1, []);
      return groupedGraph;
    }
  };
  
  
  // Data.Adapter
  // --------------
  
  // An abstract interface for writing and reading Data.Graphs.
  
  Data.Adapter = function(config) {
    // The config object is used to describe database credentials
    this.config = config;
  };
  
  // Namespace where Data.Adapters can register
  Data.Adapters = {};
  
  // Data.Property
  // --------------
  
  // Meta-data (data about data) is represented as a set of properties that
  // belongs to a certain `Data.Type`. A `Data.Property` holds a key, a name
  // and an expected type, telling whether the data is numeric or textual, etc.

  Data.Property = function(type, key, options) {
    this.key = key;
    this.type = type;
    this.unique = options.unique !== undefined ? options.unique : true;
    this.name = options.name;
    this.meta = options.meta || {};
    this.validator = options.validator;
    this.required = options["required"];
    this["default"] = options["default"];
    
    // TODO: ensure that object and value types are not mixed
    this.expectedTypes = _.isArray(options['type']) ? options['type'] : [ options['type'] ];
  };

  _.extend(Data.Property.prototype, _.Events, {
    
    isValueType: function() {
      return Data.isValueType(this.expectedTypes[0]);
    },
    
    isObjectType: function() {
      return !this.isValueType();
    },
        
    // Aggregates the property's values
    aggregate: function (fn) {
      return fn(this.values("values"));
    },
    
    // Serialize a propery definition
    toJSON: function() {
      return {
        name: this.name,
        type: this.expectedTypes,
        unique: this.unique,
        meta: this.meta,
        sync: this.sync,
        validator: this.validator,
        required: this.required,
        "default": this["default"]
      }
    }
  });
  
   
  // Data.Type
  // --------------
  
  // A `Data.Type` denotes an IS A relationship about a `Data.Object`. 
  // For example, if you type the object 'Shakespear' with the type 'Person'
  // you are saying that Shakespeare IS A person. Types are also used to hold
  // collections of properties that belong to a certain group of objects.
  

  Data.Type = function(g, id, type) {
      this.g = g; 
      this._id = id;
      if (type._rev) this._rev = type._rev;
      if (type._conflicted) this._conflicted = type._conflicted;
      this.type = type.type;
      this.name = type.name;
      this.meta = type.meta || {};
      if (type.indexes) this.indexes = type.indexes;

      this.properties = new Data.Hash();

      _.each(type.properties, _.bind(function(property, key) {
        this.properties.set(key, new Data.Property(this, key, property));
      }, this));
  };

  _.extend(Data.Type.prototype, _.Events, {
    
    // Convenience function for accessing properties
    properties: function() {
      return this.all('properties');
    },
    
    // Objects of this type
    objects: function() {
      return this.all('nodes');
    },
    
    // Serialize a single type node
    toJSON: function() {
      var result = {
        _id: this._id,
        type: '/type/type',
        name: this.name,
        properties: {}
      };
      
      if (this._rev) result._rev = this._rev;
      if (this.meta && _.keys(this.meta).length > 0) result.meta = this.meta;
      if (this.indexes && _.keys(this.indexes).length > 0) result.indexes = this.indexes;
      
      this.all('properties').each(function(property) {
        var p = result.properties[property.key] = {
          name: property.name,
          unique: property.unique,
          type: property.expectedTypes,
          required: property.required ? true : false
        };
        if (property["default"]) p["default"] = property["default"];
        if (property.validator) p.validator = property.validator;
        if (property.meta && _.keys(property.meta).length > 0) p.meta = property.meta;
      });
      return result;
    }
  });
  

  // Data.Object
  // --------------
  
  // Represents a typed data object within a `Data.Graph`.
  // Provides access to properties, defined on the corresponding `Data.Type`.
  
  Data.wrapInHash = function(graph, values) {
    var hash = new Data.Hash();
    _.each(values, function(v) {
      if (!graph.get(v)) {
        console.log(graph);
        console.log('not found: '+v);
      }
      hash.set(v, graph.get(v));
    });
    return hash;
  };

  Data.resolve = function(graph, values) {
    var hash = new Data.Hash();
    _.each(values, function(v) {
      if (!graph.get(v)) {
        console.log(graph);
        console.log('not found: '+v);
      }
      hash.set(v, graph.get(v));
    });
    return hash;
  };

  Data.Object = function(g, id, data) {
    this.g = g;
    this._id = id; delete data._id;    
    this.data = data;

    this._types = _.isArray(data.type) ? data.type : [data.type];
    if (this.data._dirty) this._dirty = true;
    if (this.data.meta) this.meta = this.data.meta;
    // delete this.data.type; Why this isn't working?
  };

  _.extend(Data.Object.prototype, _.Events, {
    
    // Convenience function for accessing all related types
    types: function() {
      return Data.wrapInHash(this.g, this._types);
    },

    type: function() {
      return this.g.get(_.last(this._types));
    },
    
    toString: function() {
      return this.get('name') || this.val || this._id;
    },
    
    // Properties from all associated types
    properties: function() {
      var properties = new Data.Hash();
      // Prototypal inheritance in action: overriden properties belong to the last type specified
      this.types().each(function(type) {
        type.properties.each(function(property) {
          properties.set(property.key, property);
        });
      });
      return properties;
    },
    

    // Validates an object against its type (=schema)
    validate: function() {
      if (this.type._id === '/type/type') return true; // Skip type nodes
      
      var that = this;
      this.errors = [];
      this.properties().each(function(property, key) {
        // Required property?
        if ((that.get(key) === undefined || that.get(key) === null) || that.get(key) === "") {
          if (property.required) {
            that.errors.push({property: key, message: "Property \"" + property.name + "\" is required"});
          }
        } else {
          // Correct type?
          var types = property.expectedTypes;

          function validType(value, types) {
            if (_.include(types, typeof value)) return true;
            // FIXME: assumes that unloaded objects are valid properties
            if (!value.data) return true;
            if (value instanceof Data.Object && _.intersect(types, value.types().keys()).length>0) return true;
            if (typeof value === 'object' && _.include(types, value.constructor.name.toLowerCase())) return true;
            return false;
          }
          
          // Unique properties
          if (property.unique && !validType(that.get(key), types)) {
            that.errors.push({property: key, message: "Invalid type for property \"" + property.name + "\""});
          }
          
          // Non unique properties
          if (!property.unique && !_.all(that.get(key).values(), function(v) { return validType(v, types); })) {
            that.errors.push({property: key, message: "Invalid value type for property \"" + property.name + "\""});
          }
        }
        
        // Validator satisfied?
        function validValue() {
          return new RegExp(property.validator).test(that.get(key));
        }
        
        if (property.validator) {
          if (!validValue()) {
            that.errors.push({property: key, message: "Invalid value for property \"" + property.name + "\""});
          }
        }
      });
      return this.errors.length === 0;
    },
    
    // There are four different access scenarios for getting a certain property
    // 
    // * Unique value types
    // * Non-unique value types
    // * Unique object types 
    // * Non-Unique object types 
    // 
    // For convenience there's a get method, which always returns the right
    // result depending on the schema information. However, internally, every
    // property of a resource is represented as a non-unique `Data.Hash` 
    // of `Data.Node` objects, even if it's a unique property. So if you want 
    // to be explicit you should use the native methods of `Data.Node`. If
    // two arguments are provided `get` delegates to `Data.Node#get`.
    
    get: function(property, key) {
      // TODO: optimize and skip that check?
      var p = this.properties().get(property);
      var value = this.data[property];
      if (!p) return null;
      if (p.isObjectType()) {
        return p.unique ? this.g.get(value) : Data.wrapInHash(this.g, value);
      } else {
        if (p.unique) return value;
        var res = new Data.Hash();
        _.each(value, function(v) {
          res.set(v, v);
        });
        return res;
      }
    },

    // New API, returns arrays instead of Data.Hashes
    attr: function(property, key) {
      var p = this.properties().get(property);
      var value = this.data[property];
      if (!p) return null;
      if (p.isObjectType()) {
        return p.unique ? this.g.get(value) : resolve(this.g, value);
      } else {
        // if (p.unique) return value;
        return value;

        // var res = new Data.Hash();
        // _.each(value, function(v) {
        //   res.set(v, v);
        // });
        return res;
      }
    },
    
    // Sets properties on the object
    // Existing properties are overridden / replaced
    set: function(properties) {
      var that = this;
      
      _.each(properties, function(value, key) {
        var p = that.properties().get(key);
        if (!p) return; // Property not found on type

        // Setup values
        // that.replace(p.key, p.registerValues(_.isArray(value) ? value : [value], that));
        
        that._dirty = true;
        that.g.trigger('dirty', that);
      });
    },
    
    // Serialize an `Data.Object`'s properties
    toJSON: function() {
      var that = this,
          result = {};
      _.each(this._properties, function(value, key) {
        var p = that.properties().get(key);
        if (p.isObjectType()) {
          result[key] = p.unique ? that.all(key).keys()[0] : that.all(key).keys()
        } else {
          result[key] = p.unique ? that.value(key) : that.values(key).values();
        }
      });
      result['type'] = this.types().keys();
      result['_id'] = this._id;
      if (this._rev !== undefined) result['_rev'] = this._rev;
      if (this._deleted) result['_deleted'] = this._deleted;
      return result;
    }
  });
    
  
  // Data.Graph
  // --------------
  
  // A `Data.Graph` can be used for representing arbitrary complex object
  // graphs. Relations between objects are expressed through links that
  // point to referred objects. Data.Graphs can be traversed in various ways.
  // See the testsuite for usage.
  
  Data.Graph = function(g, options) {
    this.nodes = new Data.Hash();
    if (!g) return;

    this.merge(g, options && options.dirty);
    this.syncMode = options && options.syncMode ? options.syncMode : 'push';
  };

 _.extend(Data.Graph.prototype, _.Events, {
    
    connect: function(name, config) {
      if (typeof exports !== 'undefined') {
        var Adapter = require(__dirname + '/adapters/'+name+'_adapter');
        this.adapter = new Adapter(this, config);
      } else {
        if (!Data.Adapters[name]) throw new Error('Adapter "'+name+'" not found');
        this.adapter = new Data.Adapters[name](this, config);
      }
      return this;
    },
    
    // Called when the Data.Adapter is ready
    connected: function(callback) {
      if (this.adapter.realtime) {
        this.connectedCallback = callback;
      } else {
        callback();
      }
    },
    
    // Serve graph along with an httpServer instance
    serve: function(server, options) {
      require(__dirname + '/server').initialize(server, this);
    },
    
    // Watch for graph updates
    watch: function(channel, query, callback) {
      this.watchers[channel] = callback;
      this.adapter.watch(channel, query, function(err) {});
    },
    
    // Stop watching that channel
    unwatch: function(channel, callback) {
      delete this.watchers[channel];
      this.adapter.unwatch(channel, function() {});
    },
    
    // Empty graph
    empty: function() {
      var that = this;
      _.each(this.objects().keys(), function(id) {
        that.del(id);
        that.all('nodes').del(id);
      });
    },
    
    // Merges in another Graph
    merge: function(g, dirty) {      
      var that = this;
      
      // Process schema nodes
      _.each(g, function(node, key) {
        if (node.type === '/type/type' || node.type === 'type') {
          if (!that.get(key)) {
            var obj = new Data.Type(that, key, node);
            if (node._dirty || dirty) obj._dirty = true;
            that.nodes.set(key, obj);
          }
        } else {
          var obj = that.get(key);
          // var types = _.isArray(node.type) ? node.type : [node.type];
          if (!obj) {
            obj = new Data.Object(that, key, node);
            that.nodes.set(key, obj);
          } else if (obj.data._dirty) {
            res._conflicted = true;
            res._conflicted_rev = node;
          } else {
            res.data = node;
          }

          if (node._dirty || dirty) obj._dirty = true;
          if (!node._id) node._id = key;
        }
      });
      
      if (this.conflictedNodes().length > 0) this.trigger('conflicted');
      
      return this;
    },

    set: function(node) {
      var id, that = this;

      var types = _.isArray(node.type) ? node.type : [node.type];
      node._id = node._id ? node._id : Data.uuid('/' + _.last(_.last(types).split('/')) + '/');

      // Recycle existing object if there is one
      var res = that.get(node._id) ? that.get(node._id) : new Data.Object(that, node._id, _.clone(node), true);
      res.data = node;
      res._dirty = true;
      this.nodes.set(node._id, res);
      return res;
    },
    
    // API method for accessing objects in the graph space
    get: function(id) {
      return this.nodes.get(id);
    },
    
    // Delete node by id, referenced nodes remain untouched
    del: function(id) {
      var node = this.get(id);
      if (!node) return;
      node._deleted = true;
      node._dirty = true;
      this.trigger('dirty', node);
    },
    
    // Find objects that match a particular query
    find: function(query) {
      return this.objects().select(function(o) {
        return Data.matches(o.data, query);
      });
    },
    
    // Fetches a new subgraph from the adapter and either merges the new nodes
    // into the current set of nodes
    fetch: function(query, options, callback) {
      var that = this,
          nodes = new Data.Hash(); // collects arrived nodes
      
      // Options are optional
      if (typeof options === 'function' && typeof callback === 'undefined') {
        callback = options;
        options = {};
      }
      
      this.adapter.read(query, options, function(err, graph) {
        if (graph) {          
          that.merge(graph, false);
          _.each(graph, function(node, key) {
            nodes.set(key, that.get(key));
          });
        }
        err ? callback(err) : callback(null, nodes);
      });
    },
    
    // Pull in remote updates and push local changes to the server
    sync: function(callback, resolveConflicts) {
      callback = callback || function() {};
      resolveConflicts = resolveConflicts || function(cb) { cb(); };
      var that = this;
      
      if (this.syncMode === 'full') {
        this.pull(function() {
          if (that.conflictedNodes().length > 0) {
            resolveConflicts(function() { that.push(callback); });
          } else {
            that.push(callback);
          }
        });
      } else if (this.syncMode === 'pull') {
        this.pull(function() {
          if (that.conflictedNodes().length > 0) {
            resolveConflicts(function() {});
          }
        });
      } else { // Push sync -> default
        this.push(callback);
      }
    },
    
    // Push local updates to the server
    push: function(callback) {
      var that = this,
          nodes = this.dirtyNodes();
      
      var validNodes = new Data.Hash();
      nodes.select(function(node, key) {
        if (!node.validate || (node.validate && node.validate())) {
          validNodes.set(key, node);
        }
      });
      
      this.adapter.write(validNodes.toJSON(), function(err, g) {
        if (err) return callback(err);
        
        // Check for rejectedNodes / conflictedNodes
        validNodes.each(function(n, key) {
          if (g[key]) {
            n._dirty = false;
            n._rejected = false;
          } else {
            n._rejected = true;
          }
        });
        
        // Update local nodes with new revision
        that.merge(g, false);
        
        // Update localStorage
        if (this.persistent) that.snapshot();
        
        if (that.invalidNodes().length > 0) that.trigger('invalid');
        if (that.conflictedNodes().length > 0) that.trigger('conflicted');
        if (that.rejectedNodes().length > 0) that.trigger('rejected');
        
        var unsavedNodes = that.invalidNodes().union(that.conflictedNodes())
                           .union(that.rejectedNodes()).length;
        
        callback(unsavedNodes > 0 ? unsavedNodes+' unsaved nodes' : null);
      });
    },
    
    pull: function(callback) {
      var that = this;
      var nodes = {};
      this.objects().each(function(o) {
        nodes[o._id] = o._rev || null;
      });
      
      this.adapter.pull(nodes, function(err, g) {
        that.merge(g, false);
        callback();
      });
    },
    
    // Perform a group operation on a Data.Graph
    group: function(type, keys, properties) {
      var res = new Data.Collection();
      res.g = Data.Transformers.group(this, type, keys, properties);
      return res;
    },
    
    // Type nodes
    types: function() {
      // TODO: not efficient
      return this.nodes.select(function(node, key) {
        return node.type === '/type/type' || node.type === 'type';
      });
    },
    
    // Object nodes
    objects: function() {
      // TODO: not efficient
      return this.nodes.select(function(node, key) {
        return node.type !== '/type/type' && node.type !== 'type' && node.data && !node._deleted;
      });
    },
    
    // Get dirty nodes
    // Used by Data.Graph#sync
    dirtyNodes: function() {
      // TODO: not efficient, keep track of dirty nodes seperately
      return this.nodes.select(function(obj, key) {
        return (obj._dirty && (obj.data || obj instanceof Data.Type));
      });
    },
    
    // Get invalid nodes
    invalidNodes: function() {
      // TODO: not efficient, keep track of invalid nodes seperately
      return this.nodes.select(function(obj, key) {
        return (obj.errors && obj.errors.length > 0);
      });
    },
    
    // Get conflicting nodes
    conflictedNodes: function() {
      // TODO: not efficient, keep track of conflicted nodes seperately
      return this.nodes.select(function(obj, key) {
        return obj._conflicted;
      });
    },
    
    // Nodes that got rejected during sync
    rejectedNodes: function() {
      // TODO: not efficient, keep track of rejected nodes seperately
      return this.nodes.select(function(obj, key) {
        return obj._rejected;
      });
    },
    
    // Serializes the graph to the JSON-based exchange format
    toJSON: function(extended) {
      var result = {};
      
      // Serialize object nodes
      this.all('nodes').each(function(obj, key) {
        // Only serialize fetched nodes
        if (obj.data || obj instanceof Data.Type) {
          result[key] = obj.toJSON();
          if (extended) {
            // include special properties
            if (obj._dirty) result[key]._dirty = true;
            if (obj._deleted) result[key]._deleted = true;
            if (obj._conflicted) result[key]._conflicted = true;
            if (obj._rejected) result[key]._rejected = true;
          }
        }
      });
      return result;
    }
  });
  

  // Data.Collection
  // --------------
  
  // A Collection is a simple data abstraction format where a dataset under
  // investigation conforms to a collection of data items that describes all
  // facets of the underlying data in a simple and universal way. You can
  // think of a Collection as a table of data, except it provides precise
  // information about the data contained (meta-data). A Data.Collection
  // just wraps a `Data.Graph` internally, in order to simplify the interface,
  // for cases where you do not have to deal with linked data.
  
  Data.Collection = function(spec) {
    var that = this,
        gspec = { "/type/item": { "type": "/type/type", "properties": {}} };
        
    if (spec) gspec["/type/item"]["indexes"] = spec.indexes || {};

    // Convert to Data.Graph serialization format
    if (spec) {
      _.each(spec.properties, function(property, key) {
        gspec["/type/item"].properties[key] = property;
      });
      this.g = new Data.Graph(gspec);
      _.each(spec.items, function(item, key) {
        that.set(key, item);
      });
    } else {
      this.g = new Data.Graph();
    }
  };
  
  _.extend(Data.Collection.prototype, {

    // Get an object (item) from the collection
    get: function(key) {
      return this.g.get.apply(this.g, arguments);
    },
    
    // Set (add) a new object to the collection
    set: function(id, properties) {
      this.g.set(id, _.extend(properties, {type: "/type/item"}));
    },
    
    // Find objects that match a particular query
    find: function(query) {
      query["type|="] = "/type/item";
      return this.g.find(query);
    },
    
    // Returns a filtered collection containing only items that match a certain query
    filter: function(query) {
      return new Data.Collection({
        properties: this.properties().toJSON(),
        items: this.find(query).toJSON()
      });
    },
        
    // Perform a group operation on the collection
    group: function(keys, properties) {
      var res = new Data.Collection();
      res.g = Data.Transformers.group(this.g, "/type/item", keys, properties);
      return res;
    },
    
    // Convenience function for accessing properties
    properties: function() {
      return this.g.get('nodes', '/type/item').all('properties');
    },
    
    // Convenience function for accessing items
    items: function() {
      return this.g.objects();
    },
    
    // Convenience function for accessing indexes defined on the collection
    indexes: function() {
      return this.g.get('/type/item').indexes;
    },
    
    // Serialize
    toJSON: function() {
      return {
        properties: this.g.toJSON()["/type/item"].properties,
        items: this.g.objects().toJSON()
      }
    }
  });
})();
