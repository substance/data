Data.Adapters["ajax"] = function(graph, config) {  
  
  config = config ? config : {url: '/graph/'};
  
  // write
  // --------------

  // Takes a Data.Graph and calls a webservice to persist it
  
  self.write = function(graph, callback) {    
    $.ajax({
      type: "PUT",
      url: config.url+"write",
      data: JSON.stringify(graph),
      contentType: "application/json",
      dataType: "json",
      success: function(res) {
        res.error ? callback(res.error) : callback(null, res.graph);
      },
      error: function(err) {
        callback(err);
      }
    });
  };
  
  // read
  // --------------

  // Takes a query object and reads all matching nodes
  
  self.read = function(qry, options, callback) {    
    $.ajax({
      type: "GET",
      url: config.url+"read",
      data: {
        qry: JSON.stringify(qry),
        options: JSON.stringify(options)
      },
      dataType: "jsonp",
      success: function(res) {
        res.error ? callback(res.error) : callback(null, res);
      },
      error: function(err) {
        callback(err);
      }
    });
  };
  
  self.watch = function() {
    // no-op
  };
  
  self.unwatch = function() {
    // no-op
  };
  
  // Expose Public API
  return self;
};
