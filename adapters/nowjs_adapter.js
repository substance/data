var NowjsAdapter = function(now) {  
  // config = config ? config : {url: '/'};
  
  // writeGraph
  // --------------

  // Takes a Data.Graph and calls a webservice to persist it

  self.writeGraph = function(graph, callback) {    
    now.write(graph, function(err, graph) {
      callback(err, graph);
    });
  };

  // readGraph
  // --------------

  // Takes a query object and reads all matching nodes
  // If you'd like to make a deep fetch, you just need to specify
  // expand: true in the options hash

  self.readGraph = function(qry, options, callback) {    
    now.read(qry, options, function(err, graph) {
      callback(err, graph);
    });
  };
  
  self.watch = function(name, query, callback) {
    now.watch(name, query, function(err) {
      callback(err);
    });
  };
  
  // Expose Public API
  return self;
};
