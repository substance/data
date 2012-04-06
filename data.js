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

  
  // Data.Adapter
  // --------------
  
  // An abstract interface for writing and reading Data.Graphs.
  
  Data.Adapter = function(config) {
    // The config object is used to describe database credentials
    this.config = config;
  };
  
  // Namespace where Data.Adapters can register
  Data.Adapters = {};
  
  // Data.Type
  // --------------
  
  // A `Data.Type` denotes an IS A relationship about a `Data.Object`. 
  // For example, if you type the object 'Shakespear' with the type 'Person'
  // you are saying that Shakespeare IS A person. Types are also used to hold
  // collections of properties that belong to a certain group of objects.
  

  Data.Type = function(g, id, type) {
      this.g = g; 
      this._id = id;
      this.type = type.type;
      this.name = type.name;
      this.objects = [];
      this.meta = type.meta || {};
      this.built = false;
      if (type.indexes) this.setupIndexes(type.indexes);

      this.properties = type.properties;

      _.each(this.properties, _.bind(function(property, key) {
        property.type = _.isArray(property.type) ? property.type : [ property.type ];
      }, this));
  };

  _.extend(Data.Type.prototype, _.Events, {
    
    setupIndexes: function(indexes) {
      var that = this;
      this.indexes = {};

      _.each(indexes, function(properties, key) {
        var index = that.indexes[key] = {
          properties: properties,
          objects: {}
        };
      });
    },

    buildIndexes: function() {
      var that = this;

      function build(o, index) {
        function createOrUpdateEntry(key) {
          var entry = index.objects[key];
          if (!entry) entry = index.objects[key] = [];
          entry.push(o);
        }
        var vals = [];
        _.each(index.properties, function(p) {
          var v = o.data[p];
          vals.push(_.isArray(v) ? v : [v]);
        });
        _.each(Data.permute(vals), function(p) {
          createOrUpdateEntry(p);
        });
      }

      _.each(this.objects, function(o) {
        _.each(that.indexes, function(index) {
          build(o, index);
        });
      });
      this.built = true;
    },

    find: function(qry) {
      if (!this.built) this.buildIndexes();
      // Pick the right index
      var index = _.select(this.indexes, function(i) {
        return _.intersect(Object.keys(qry), i.properties).length === i.properties.length
      })[0];

      if (!index) return console.log("No index found.");
      var val = "";
      _.each(index.properties, function(p) {
        val += qry[p];
      });
      return index.objects[val] || [];
    },

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

  Data.Object = function(g, id, data) {
    this.g = g;
    this._id = id; delete data._id;
    this.update(data);
  };

  _.extend(Data.Object.prototype, _.Events, {

    // Update node based on the serialized data
    update: function(data) {
      this.data = data;

      this.types = _.isArray(data.type) ? data.type : [data.type];
      if (this.data._dirty) this._dirty = true;
      if (this.data.meta) this.meta = this.data.meta;

      // TODO: update type registrations, if there are changes to the object
      // delete this.data.type; // Why this isn't working?
    },

    type: function() {
      return this.g.get(_.last(this.types));
    },
    
    toString: function() {
      return this.get('name') || this.val || this._id;
    },
    
    // Properties from all associated types
    properties: function() {
      var properties = {};
      _.each(this.types, _.bind(function(type) {
        _.extend(properties, this.g.get(type).properties);
      }, this));
      return properties;
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
      var p = this.properties()[property];
      var value = this.data[property];

      if (!p || !value) return null;

      if (Data.isValueType(p.type)) {
        return value;
      } else {
        return p.unique ? this.g.get(value)
                        : _.map(value, _.bind(function(v) { return this.g.get(v); }, this));   
      }
    },

    // Sets properties on the object
    // Existing properties are overridden / replaced
    set: function(properties) {
      var that = this;
      
      _.each(properties, _.bind(function(value, key) {
        if (!that.properties()[key]) return; // Property not found on type
        that.data[key] = value;
        that._dirty = true;
        that.g.trigger('dirty', that);
      }, this));
    },
    
    // Serialize an `Data.Object`'s properties
    toJSON: function() {
      return _.extend(this.data, {_id: this._id, type: this.types})
    }
  });
    
  
  // Data.Graph
  // --------------
  
  // A `Data.Graph` can be used for representing arbitrary complex object
  // graphs. Relations between objects are expressed through links that
  // point to referred objects. Data.Graphs can be traversed in various ways.
  // See the testsuite for usage.
  
  Data.Graph = function(g, options) {
    this.nodes = [];
    this.objects = [];
    this.types = [];
    // Lookup objects by key
    this.keys = {};
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
    
    // Merges in another Graph
    merge: function(nodes, dirty) {      
      _.each(nodes, _.bind(function(n, key) { this.set(_.extend(n, {_id: key})); }, this));
      return this;
    },

    find: function(qry) {
      var type = this.get(qry.type);
      delete qry.type;
      return Object.keys(qry).length === 0 ? type.objects : type.find(qry);
    },

    set: function(node, dirty) {
      var that = this;
      if (dirty === undefined) dirty = true;
      var types = _.isArray(node.type) ? node.type : [node.type];
      node._id = node._id ? node._id : Data.uuid('/' + _.last(_.last(types).split('/')) + '/');

      function createNode() {
        return _.last(types) === "/type/type" ? new Data.Type(this, node._id, _.clone(node))
                                              : new Data.Object(this, node._id, _.clone(node))
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
          // Register on types
          _.each(n.types, function(t) {
            that.get(t).objects.push(n);
          });
        }
      } else {
        n.update(node);
      }
      return n;
    },
    
    // API method for accessing objects in the graph space
    get: function(id) {
      return this.nodes[this.keys[id]];
    },
    
    // Delete node by id, referenced nodes remain untouched
    del: function(id) {
      var node = this.get(id);
      if (!node) return;
      node._deleted = true;
      node._dirty = true;
      this.trigger('dirty', node);
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
  
})();