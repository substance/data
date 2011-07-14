var CouchClient = require('../lib/couch-client');
var Data = require('../data');
var _ = require('underscore');
var async = require('async');


// Apply Filter Stack
// --------

var applyFilters = function(filters, nodes, mode, ctx, callback) {
  var that = this;
  var filteredNodes = {};
  if (!filters || filters.length === 0) return callback(null, nodes); // Skip
  
  async.forEach(_.keys(nodes), function(key, callback) {
    var idx = 0;
    function callLayer(node, callback) {
      if (!node) return callback(null); // skip rejected nodes
      if (filters[idx]) {
        filters[idx][mode].call(that, node, function(n) {
          idx += 1;
          callLayer(n, function(n) {
            callback(n);
          });
        }, ctx);
      } else {
        callback(node);
      }
    }
    callLayer(nodes[key], function(node) {
      if (node) filteredNodes[node._id] = node;
      callback();
    });
  }, function(err) {
    err ? callback(err) : callback(null, filteredNodes);
  });
};


var CouchAdapter = function(graph, config, callback) {
  var db = CouchClient(config.url);
  var self = {};
  
  // Setup index views for type nodes
  // --------
  
  function setupType(node, callback) {
    
    // Extract local typename
    var typename = node._id.split('/')[2];
    views = {
      "all": {
        "properties": ["_id"],
        "map": "function(doc) { if (doc.type.indexOf('"+node._id+"')>=0) { emit([doc._id], doc); } }"
      }
    };
    
    // Setup validation function
    validatorFn = "function(newDoc, oldDoc, userCtx) {\n";
    validatorFn += "if (newDoc.type.indexOf('"+node._id+"')>=0) {\n";
    _.each(node.properties, function(property, key) {
      if (property.required) validatorFn += "if (!newDoc['"+key+"']) throw({forbidden : '"+key+" is missing'});\n";
      if (property.validator) validatorFn += "if (!new RegExp('"+property.validator+"').test(newDoc."+key+")) throw({forbidden: '"+key+" is invalid'});"
    });
    validatorFn += "}}";
    
    if (node.indexes) {
      _.each(node.indexes, function(properties, indexName) {
        var keyExpr = "["+ _.map(properties, function(p) { return "doc."+p;}).join(',')+ "]";
        views[indexName] = {
          "properties": properties,
          "map": "function(doc) { if (doc.type.indexOf('"+node._id+"')>=0) { emit("+keyExpr+", doc); } }"
        };
      });
    }
    
    db.save({
      _id: '_design/'+typename,
      views: views,
      validate_doc_update: validatorFn
    }, {force: true}, function (err, doc) {
      err ? callback(err) : callback();
    });
  };
  
  // flush
  // --------------

  // Flush the database
  
  self.flush = function(callback) {
    db.request("DELETE", db.uri.pathname, function (err) {
      db.request("PUT", db.uri.pathname, function(err) {
        err ? callback(err) 
            : db.save({
                _id: '_design/type',
                views: {
                  "all": {
                    "map": "function(doc) { if (doc.type === \"/type/type\") emit(doc._id, doc); }"
                  }
                }
              }, function (err, doc) {
                err ? callback(err) : callback();
              });
      });
    });
  };
  
  
  // write
  // --------------

  // Takes a Data.Graph and persists it to CouchDB
  
  self.write = function(graph, callback, ctx) {
    var result = {}; // updated graph with new revisions and merged changes
    
    function writeNode(nodeId, callback) {
      var target = _.extend(graph[nodeId], {
        _id: nodeId
      });
      var options = {};
      
      if (config.force_updates) options["force"] = true;
      
      db.save(target, options, function (err, newDoc) {
        if (err) {
          // Return the latest valid db version instead of the conflicted one
          // TODO: we assume conflict errors are the only errors here
          db.get(nodeId, function(err, node) {
            result[nodeId] = node;
            result[nodeId]._conflicted = true;
            callback();
          });
        } else {
          // If we've got a type node, setup index views
          if (newDoc.type == "/type/type") {
            setupType(newDoc, function(err) {
              if (err) { console.log('Error during index creation:'); console.log(err); };
              result[nodeId] = newDoc;
              callback();            
            });
          } else {
            result[nodeId] = newDoc;
            callback();
          }
        }
      });
    }
    
    applyFilters.call(this, config.filters, graph, 'write', ctx, function(err, filteredNodes) {
      graph = filteredNodes;
      async.forEach(_.keys(graph), writeNode, function(err) {
        err ? callback(err) : callback(null, result);
      });
    });
  };
  
  // read
  // --------------

  // Takes a query object and reads all matching nodes
  
  self.read = function(queries, options, callback, ctx) {
    // Collects a subgraph that will be returned as a result
    var result = {};
    queries = _.isArray(queries) ? queries : [queries];
    
    // Performs a query and returns a list of matched nodes
    // --------
    
    function performQuery(qry, callback) {
      console.log('Performing query:');
      console.log(qry);
      
      if (!qry.type && !qry._id) return callback('ERROR: No type or _id attribute specified with query.');
      
      var typeName = qry.type ? qry.type.split('/')[2] : null;
      delete qry.type;
      
      // Pull off relationship definitions (in case of eager loading relationships)
      var relationships = {};
      _.each(qry, function(val, property) {
        if (typeof val === 'object' && !_.isArray(val)) {
          relationships[property] = val;
          delete qry[property];
        }
      });
      
      // Just the properties
      var properties = _.keys(qry);

      // Holds the current traversal path in a nested query
      var currentPath = [];
      
      // Depending on the current working path, reveal relationships to be
      // traversed for the node currently processed
      function currentRelationships(currentPath) {
        if (currentPath.length === 0) return relationships;
        var path = _.clone(currentPath);
        var res = relationships;
        var key;
        while (key = path.splice(0,1)[0]) {
          res = res[key];
        }
        delete res._recursive; // Ignore directives
        return res;
      }
      
      // Fetch associated nodes for a certain property
      // --------
      
      function fetchAssociatedProperty(node, property, recursive, callback) {
        if (!node[property]) return callback(); // Done if null/undefined
        
        // Update currentPath to be the current property traversed
        currentPath.push(property);
        
        var references = _.isArray(node[property]) ? node[property] : [node[property]];
        
        var nodes = {};
        async.forEachSeries(references, function(nodeId, callback) {
          if (result[nodeId]) return callback(); // Skip if already in the result
          db.get(nodeId, function(err, node) {
            if (err) return callback(err);
            if (!node) return callback(); // Ignore deleted nodes
            result[node._id] = node;
            nodes[node._id] = node;
            fetchAssociated(node, callback);
          });
        }, function(err) {
          // Once ready remove that property from the currentPath
          currentPath.pop();
          // And dig deeper in a recursive scenario
          if (recursive) {
            async.forEachSeries(Object.keys(nodes), function(nodeId, callback) {
              fetchAssociatedProperty(result[nodeId], property, true, callback);
            }, callback);
          } else {
            callback(err);
          }
        });
      }
      
      function fetchAssociated(node, callback) {
        var properties = currentRelationships(currentPath);
        // Based on the current relationships fetch associated properties
        async.forEachSeries(Object.keys(properties), function(property, callback) {
          fetchAssociatedProperty(node, property, properties[property]._recursive, callback);
        }, callback);
      }
      
      // Resolve references based on specified query paths
      // --------
      
      function resolveReferences(nodes, callback) {
        // TODO: Can we do this in parallel?
        async.forEachSeries(Object.keys(nodes), function(node, callback) {
          fetchAssociated(nodes[node], callback);
        }, callback);
      }
      
      
      // Typed Query based on CouchDB Views
      // --------
      
      function executeTypedQuery(callback) {

        db.get('_design/'+typeName, function(err, node) {
          // Pick the right index based on query parameters
          var viewName = null;
          _.each(node.views, function(view, key) {
            if (view.properties.length == properties.length && _.intersect(view.properties, properties).length === view.properties.length) viewName = key;
          });

          if (viewName) {
            // Use view to lookup matching objects efficiently
            var key = [];
            _.each(node.views[viewName].properties, function(p) {
              key.push(qry[p]);
            });

            db.view(typeName+'/'+viewName, {key: key}, function(err, res) {
              if (err) callback(err);
              _.each(res.rows, function(row) {
                result[row.value._id] = row.value;
              });
              callback();
            });
          } else { // Fetch all objects of this type and check manually
            console.log('WARNING: No index could be found for this query:');
            console.log(qry);
            qry["type|="] = "/type/"+typeName;
            db.view(typeName+'/all', function(err, res) {
              if (err) return callback(err);
              _.each(res.rows, function(row) {
                if (Data.matches(row.value, qry)) result[row.value._id] = row.value;
              });
              callback();
            });
          }
        });
      }
      
      // Untyped Query based on ids
      // --------
      
      function executeUntypedQuery(callback) {
        var references = _.isArray(qry._id) ? qry._id : [qry._id];
        async.forEach(references, function(nodeId, callback) {
          if (result[nodeId]) callback(); // Skip if already included in the result
          db.get(nodeId, function(err, node) {
            if (err) return callback(err);
            if (!node) return callback(); // Ignore deleted nodes
            result[node._id] = node;
            callback();
          });
        }, function(err) {
          callback(err);
        });
      }
      
      // Execute query either typed (by id) or untyped (using a CouchDB View)
      qry._id ? executeUntypedQuery(function() { resolveReferences(result, callback); })
              : executeTypedQuery(function() { resolveReferences(result, callback); });
      
    }
    
    // Perform queries
    async.forEach(queries, performQuery, function(err) {
      if (err) return callback(err);
      applyFilters.call(this, config.filters, result, 'read', ctx, function(err, filteredNodes) {
        callback(null, filteredNodes);
      });
    });
  };
  
  
  self.db = db;
  
  // Expose Public API
  return self;
};

module.exports = CouchAdapter;