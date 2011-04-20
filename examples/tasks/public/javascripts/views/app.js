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
    // Should be rendered just once
    this.project.render();
    return this;
  }
});

var app,                                 // The Application
    graph = new Data.Graph(seed, false); // The database

(function() {
  $(function() {
    
    // Init Application
    // --------------
    
    // When updates arrive, appy them and re-render
    // TODO: We want an API for that
    now.update = function(nodes) {
      graph.merge(nodes, false);
      app.project.render();
    };
    
    // Once NowJS is ready
    now.ready(function() {
      graph.setAdapter('NowjsAdapter', now);
      
      graph.adapter.watch("task_updates", {"type|=": "/type/task", "_id": "/project/c837ec12946eaf2a1787108304352b28"}, function(err) {
        // console.log('watcher registered');
      });
      
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