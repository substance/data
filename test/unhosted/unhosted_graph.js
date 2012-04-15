Data.UnhostedGraph = function(graph) {
  this.graph = new Data.Graph(graph);

  this.dirtyNodes = [];
}

_.extend(Data.UnhostedGraph.prototype, _.Events {

  set: function(n) {
    var node = this.graph.set(n);
    return node ? this.dirtyNodes.push(node) : null;
  },
  
  get: function(id) {
    return this.graph.get(id);
  },

  sync: function() {
    // send dirty nodes to the server.
  }
});