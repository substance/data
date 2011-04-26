_.tpl = function(tpl, ctx) {
  source = $("script[name="+tpl+"]").html();
  return _.template(source, ctx);
};

var Application = Backbone.View.extend({
  events: {
    
  },
  
  initialize: function() {
    var that = this;
    this.project = new Project();
  },
  
  render: function() {
    this.project.render();
    return this;
  }
});

var app;
var graph = new Data.Graph(seed, false).connect('nowjs');

(function() {
  $(function() {
    
    // Init Application
    // --------------
        
    // Once the graph is ready
    graph.connected(function() {
      
      app = new Application({el: '#container', session: session});
      app.render();

      window.sync = function(callback) {
        $('#sync_state').html('Synchronizing...');
        graph.sync(function(err, invalidNodes) {
          window.pendingSync = false;
          if (!err && invalidNodes.length === 0) {
            $('#sync_state').html('Successfully synced.');
            setTimeout(function() {
              $('#sync_state').html('');
            }, 3000);
            if (callback) callback();
          } else {
            console.log(err);
            console.log(invalidNodes.toJSON());
            confirm('There was an error during synchronization. The workspace will be reset for your own safety');
            window.location.reload(true);
          }
        });
      };

      window.pendingSync = false;
      graph.bind('dirty', function() {
        if (!window.pendingSync) {
          window.pendingSync = true;
          setTimeout(function() {
            window.sync();
          }, 100);
        }
      });

      // Rather handle this within sync? sync should probably return conflicting nodes as well
      graph.bind('conflicted', function() {
        if (!app.document.model) return;
        graph.fetch({
          creator: app.document.model.get('creator')._id,
          name: app.document.model.get('name')
        }, {expand: true}, function(err) {
          app.document.render();
          app.scrollTo('#document_wrapper');
        });
        notifier.notify({
          message: 'There are conflicting nodes. The Document will be reset for your own safety.',
          type: 'error'
        });
      });
    });
  });
})();