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
    return _.include(Data.VALUE_TYPES, _.last(type));
  };

  Data.permute = function(arr) {
    if (arr.length == 1) {
      return arr[0];
    } else {
      var result = [];
      var rest = Data.permute(arr.slice(1));  // recur with the rest of array
      for (var i = 0; i < rest.length; i++) {
        for (var j = 0; j < arr[0].length; j++) {
          result.push(arr[0][j] + rest[i]);
        }
      }
      return result;
    }
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


  // Data.Indexable
  // --------------

  // Module to be mixed into Data.Graph and Data.Collection data structures

  Data.Indexable = {

    indexes: {},

    // Build indexes of a particular type
    buildIndexes: function(type) {
      var that = this;

      function build(o, index) {
        function createOrUpdateEntry(key) {
          if (!key) return;
          var entry = that.indexes[type._id][index][key];
          if (!entry) entry = that.indexes[type._id][index][key] = [];
          entry.push(o);
        }

        var vals = [];
        _.each(type.indexes[index], function(p) {
          var v = p === "type" ? o.types : o.properties[p];
          if (!v) return; // Skip
          vals.push(_.isArray(v) ? v : [v]);
        });

        _.each(Data.permute(vals), function(p) {
          createOrUpdateEntry(p);
        });
      }

      // Setup
      this.indexes[type._id] = {};
      _.each(type.indexes, function(i, key) {
        that.indexes[type._id][key] = {};
      });

      // Build
      _.each(this.objects, function(o) {
        if (!_.include(o.types, type._id)) return;
        _.each(type.indexes, function(index, key) {
          build(o, key);
        });
      });
    },

    queryIndex: function(qry) {
      var type = this.get(qry.type);
      if (!this.indexes[type._id]) this.buildIndexes(type);
      
      // Pick the right index
      var index;
      _.find(type.indexes, function(i, key) {
        return _.intersect(Object.keys(qry), i).length === i.length ? index = key : false;
      });

      if (!index) return console.log("No index found.");
      var val =_.map(type.indexes[index], function(p) { return qry[p]; }).join("");
      return Data.Collection.create(type, this.indexes[type._id][index][val] || []);
    }
  };

  
  // Data.Type
  // --------------
  
  // A `Data.Type` denotes an IS A relationship about a `Data.Object`. 
  // For example, if you type the object 'Shakespear' with the type 'Person'
  // you are saying that Shakespeare IS A person. Types are also used to hold
  // collections of properties that belong to a certain group of objects.
  

  Data.Type = function(type) {
      this._id = type._id;
      this.type = "/type/type";
      this.name = type.name;
      this.meta = type.meta || {};

      this.indexes = type.indexes || {};
      this.indexes["by_type"] = ["type"];

      this.properties = type.properties;
      _.each(this.properties, _.bind(function(property, key) {
        property.type = _.isArray(property.type) ? property.type : [ property.type ];
        property.unique = _.isBoolean(property.unique) ? property.unique : true;
      }, this));
  };

  _.extend(Data.Type.prototype, _.Events, {

    // Serialize a single type node
    toJSON: function() {
      return {
        _id: this._id,
        type: '/type/type',
        properties: this.properties,
        meta: this.meta,
        indexes: _.map(this.indexes, function(i) { return i.properties })
      }
    }
  });
  

  // Data.Object
  // --------------
  
  // Represents a typed data object within a `Data.Graph`.
  // Provides access to properties, defined on the corresponding `Data.Type`.

  Data.Object = function(object, host) {
    this._id = object._id;
    this.host = host;
    this.properties = {};
    this.set(object);
  };

  _.extend(Data.Object.prototype, _.Events, {

    type: function() {
      return this.host.get(_.last(this.types));
    },
    
    toString: function() {
      return this.get('name') || this.val || this._id;
    },

    // Property lookup according to the type chain
    property: function(property) {
      var p = null;

      _.find(this.types.reverse(), _.bind(function(type) {
        return p = this.host.get(type).properties[property];
      }, this));
      return p;
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
      var p = this.property(property),
          value = this.properties[property];

      if (!p || !value) return null;

      if (Data.isValueType(p.type)) {
        return value;
      } else {
        return p.unique ? this.host.get(value)
                        : _.map(value, _.bind(function(v) { return this.host.get(v); }, this));   
      }
    },

    // Sets properties on the object
    // Existing properties are overridden / replaced
    set: function(object) {
      var that = this;
      
      if (object.type) this.types = _.isArray(object.type) ? object.type : [object.type];
      if (object.meta) this.meta = this.object.meta;

      _.each(object, _.bind(function(value, key) {
        if (!that.property(key) || key === "type") return;
        that.properties[key] = value;
      }, this));
    },

    // Serialize an `Data.Object`'s properties
    toJSON: function() {
      return _.extend(this.properties, {_id: this._id, type: this.types})
    }
  });
    
  
  // Data.Graph
  // --------------
  
  // A `Data.Graph` can be used for representing arbitrary complex object
  // graphs. Relations between objects are expressed through links that
  // point to referred objects. Data.Graphs can be traversed in various ways.
  // See the testsuite for usage.
  
  Data.Graph = function(graph, options) {
    this.nodes = [];
    this.objects = [];
    this.types = [];
    this.keys = {}; // Lookup objects by key
    if (!graph) return;
    this.merge(graph);
  };

 _.extend(Data.Graph.prototype, Data.Indexable, _.Events, {
    
    // Merges in another Graph
    merge: function(nodes) {      
      _.each(nodes, _.bind(function(n, key) { this.set(_.extend(n, { _id: key })); }, this));
      return this;
    },

    // API method for accessing objects in the graph space
    get: function(id) {
      return this.nodes[this.keys[id]];
    },

    set: function(node) {
      var types = _.isArray(node.type) ? node.type : [node.type];
      node._id = node._id ? node._id : Data.uuid('/' + _.last(_.last(types).split('/')) + '/');

      function createNode() {
        return _.last(types) === "/type/type" ? new Data.Type(node)
                                              : new Data.Object(node, this);
      }

      var n = this.get(node._id);
      if (!n) {
        n = createNode.apply(this);
        this.keys[node._id] = this.nodes.length;
        this.nodes.push(n);
        
        // Register
        if (_.last(types) === "/type/type") {
          this.types.push(n);
        } else {
          this.objects.push(n);
        }
      } else {
        n.set(node);
      }
      return n;
    },

    find: function(qry) {
      return this.queryIndex(qry);
    },
    
    // Delete node by id, referenced nodes remain untouched
    del: function(id) {
      var node = this.get(id);
      if (!node) return;
      node._deleted = true;
    },

    // Serializes the graph to the JSON-based exchange format
    toJSON: function(extended) {
      var result = {};
      _.each(this.nodes, function(n) {
        result[n._id] = n.toJSON()
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
  // information about the data contained (meta-data).
  
  Data.Collection = function(spec) {
    this.type = new Data.Type(spec.type, this);
    this.objects = [];
    this.length = 0;
    this.keys = {};

    _.each(spec.objects, _.bind(function(obj) {
      this.add(obj);
    }, this));
  };

  // Creates a Data.Collection using a Data.Type, and an array of Data.Objects
  Data.Collection.create = function(type, objects) {
    var c = new Data.Collection({type: type, objects: []});
    c.objects = objects;
    c.length = objects.length;

    // Register keys for fast lookup
    _.each(objects, function(o, i) {
      c.keys[o._id] = i;
    });
    return c;
  };
  
  _.extend(Data.Collection.prototype, _.Events, Data.Indexable, {

    // Get an object (item) from the collection
    get: function(id) {
      if (id.match('^/type/')) return this.type;
      return this.objects[this.keys[id]];
    },

    // Return object at a given index
    at: function(index) {
      return this.objects[index];
    },

    // Return index for a given key
    index: function(key) {
      return this.keys[key];
    },

    // Return key for a given index
    key: function(index) {
      return this.objects[index]._id;
    },
    
    // Add a new object to the collection
    add: function(node) {
      node._id = node._id ? node._id : Data.uuid('/' + _.last(this.type._id.split('/')) + '/');
      node.type = this.type._id;

      var n = this.get(node._id);

      if (!n) {
        n = new Data.Object(node, this);
        this.keys[n._id] = this.objects.length;
        this.objects.push(n);
        this.length = this.objects.length;
      } else {
        n.set(node);
      }
      return n;
    },
    
    // Find objects that match a particular query
    find: function(qry) {
      qry["type"] = this.type._id;
      return this.queryIndex(qry);
    },

    each: function (fn) {
      _.each(this.objects, function(object, i) {
        fn.call(this, object, object._id, i);
      }, this);
      return this;
    },
    
    // Serialize
    toJSON: function() {
      return {
        type: this.type.toJSON(),
        objects: _.map(this.objects, function(n) { return n.toJSON(); })
      };
    }
  });
})();
