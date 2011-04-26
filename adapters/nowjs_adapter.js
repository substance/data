Data.Adapters["nowjs"] = function(graph, options) {
  var self = {realtime: true};
  
  // write
  // --------------
  
  // Takes a Data.Graph and calls the server to persist it
  
  self.write = function(graph, callback) {    
    now.write(graph, function(err, graph) {
      callback(err, graph);
    });
  };

  // read
  // --------------

  // Takes a query object and reads all matching nodes
  // If you'd like to make a deep fetch, you just need to specify
  // expand: true in the options hash

  self.read = function(qry, options, callback) {    
    now.read(qry, options, function(err, graph) {
      callback(err, graph);
    });
  };
  
  // watch
  // --------------
  
  self.watch = function(name, query, callback) {
    now.watch(name, query, function(err) {
      callback(err);
    });
  };
  
  // unwatch
  // --------------
  
  self.unwatch = function(name, callback) {
    now.unwatch(name, function(err) {
      callback(err);
    });
  };
  
  // update
  // --------------
  
  // Gets called by the server when updates arrive.
  // It applies them and calls the corresponding watcher callback
  
  now.update = function(channel, rawNodes) {
    var nodes = new Data.Hash();
    graph.merge(rawNodes, false);
    _.each(rawNodes, function(node, key) {
      nodes.set(key, graph.get(key));
    });
    graph.watchers[channel](null, nodes);
  };
  
  // Delegate ready callback
  
  now.ready(function() {
    graph.connectedCallback();
  });
  
  // Expose Public API
  return self;
};
