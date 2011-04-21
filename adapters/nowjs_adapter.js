var NowjsAdapter = function(now) {  
  
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
  
  self.watch = function(name, query, callback) {
    now.watch(name, query, function(err) {
      callback(err);
    });
  };
  
  self.unwatch = function(name, callback) {
    now.unwatch(name, function(err) {
      callback(err);
    });
  };
  
  // Expose Public API
  return self;
};
