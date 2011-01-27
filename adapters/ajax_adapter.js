var AjaxAdapter = function(config) {  
  
  config = config ? config : {url: '/'};
  
  // writeGraph
  // --------------

  // Takes a Data.Graph and calls a webservice to persist it
  
  self.writeGraph = function(graph, callback) {    
    $.ajax({
      type: "PUT",
      url: "/writegraph",
      data: JSON.stringify(graph),
      contentType: "application/json",
      dataType: "json",
      success: function(status) {
        callback(null, status.graph);
      },
      error: function(err) {
        callback(err);
      }
    });
  };
  
  // readGraph
  // --------------

  // Takes a query object and reads all matching nodes
  // If you'd like to make a deep fetch, you just need to specify
  // expand: true in the options hash
  
  self.readGraph = function(qry, targetGraph, options, callback) {    
    $.ajax({
      type: "GET",
      url: config.url+"readgraph",
      data: {
        qry: JSON.stringify(qry),
        options: JSON.stringify(options)
      },
      dataType: "jsonp",
      success: function(graph) {
        callback(null, graph);
      },
      error: function(err) {
       callback(err);
      }
    });
  };
  
  // Expose Public API
  return self;
};
