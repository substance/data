// Helpers
// --------------

_.tpl = function(tpl, ctx) {
  source = $("script[name="+tpl+"]").html();
  return _.template(source, ctx);
};

// Project
// --------------

var Project = Backbone.View.extend({
  events: {
    'submit #new_task_form': 'createTask',
    'click .task .checkbox': 'toggleComplete',
    'change .task input': 'updateTask',
    'click .task .remove': 'removeTask'
  },
  
  el: '#project',
  
  initialize: function() {
  },
  
  removeTask: function(e) {
    var taskId = $(e.currentTarget).parent().attr('task');
    
    this.model.set({
      "tasks": this.model.get('tasks').del(taskId).keys()
    });
    graph.del(taskId);
    this.render();
    return false;
  },
  
  toggleComplete: function(e) {
    var taskId = $(e.currentTarget).parent().attr('task');
    graph.get(taskId).set({
      "complete": !graph.get(taskId).get('complete')
    });
    this.render();
    return false;
  },
  
  updateTask: function(e) {
    var taskId = $(e.currentTarget).parent().parent().attr('task');
    $(e.currentTarget)
    graph.get(taskId).set({
      "name": $(e.currentTarget).val()
    });
    this.render();
    return false;
  },
  
  // Create a new project
  createProject: function() {
    this.model = graph.set({
      "type": ["/type/project"],
      "name": "Project "+(graph.find({"type": "/type/project"}).length+1),
      "tasks": []
    });
    router.navigate(this.model._id.split('/')[2]);
  },
  
  loadProject: function(projectId) {
    var that = this;
    this.model = graph.get(projectId);
    if (this.model) {
      router.navigate(this.model._id.split('/')[2]);
      this.render();
    } else {
      if (!projectId) {
        that.model = graph.find({"type": "/type/project"}).first();
        if (!that.model) {
          that.createProject();
        } else {
          router.navigate(this.model._id.split('/')[2]);
        }
        return this.render();
      }
      
      // Fetch it from the server
      graph.fetch({"_id": projectId, "tasks": {}}, function(err, nodes) {
        if (err) return alert('not found');
        that.model = graph.get(projectId);
        that.render();
      });
    }
    
    return false;
  },
  
  createTask: function(e) {
    var task = graph.set(null, {
      type: "/type/task",
      name: $('#task_name').val(),
      project: this.model._id
    });
    
    // Append a new task to the project
    this.model.set({
      tasks: this.model.get('tasks').keys().concat([task._id])
    });
    
    // Re-render with new item
    this.render();
    return false;
  },
  
  render: function() {
    if (this.model) {
      $(this.el).html(_.tpl('project', {
        project: this.model
      }));
    } else {
      $(this.el).html('Loading...');
    }
  }
});


var Router = Backbone.Router.extend({
  routes: {
    ':project': 'loadProject',
  },
  
  loadProject: function(projectId) {    
    app.project.loadProject(projectId ? "/project/"+projectId : null);
  }
});

// Application
// --------------

var Application = Backbone.View.extend({
  events: {
    'click a.start-sync': 'sync',
    'click a.reset': 'reset',
    'click .load-project': 'loadProject',
    'click a.create-project': 'createProject'
  },
  
  loadProject: function(e) {
    this.project.loadProject($(e.currentTarget).attr('project'));
    return false;
  },
  
  createProject: function(e) {
    this.project.createProject();
    this.render();
    return false;
  },
  
  reset: function() {
    localStorage.removeItem('graph');
    window.location.href = "/";
    return false;
  },
  
  sync: function() {
    var that = this;
    // Sync with server
    $('#sync_state').html('Synchronizing...');
    
    var syncCompleted = function(err) {
      if (!err) {
        $('#sync_state').html('Successfully synced.');
        setTimeout(function() {
          $('#sync_state').html('');
        }, 3000);
        that.project.render();
      } else {
        console.log(err);
        alert('Unresolved conflicts remaining. Check your resolve strategy.');
      }
    };
    
    var resolveConflicts = function(callback) {
      graph.conflictedNodes().each(function(n) {
        function merge(local, server) {
          var merged = {};
          _.each(server, function(value, key) {
            if (_.isEqual(value, local[key])) {
              merged[key] = value;
            } else if (_.isArray(value)) {
              merged[key] = _.union(value, local[key]);
            } else if (typeof value === "string") {
              // super awesome string merge algorithm.
            }

            // Use the server _rev
            merged._rev = server._rev;
          });
          
          return Object.keys(merged).length === Object.keys(server).length ? merged : null;
        }
        var merged = merge(n.toJSON(), n._conflicted_rev);
        
        if (merged) {
          n.set(merged); // Apply the merged version
          n._rev = merged._rev;
          n._conflicted = false;
        } else {
          // Can't merge. Let the user decide which version to use.
          if (confirm("Overwrite server version with your local version? Click Cancel to drop your local version in favor of the server one.")) {
            n._rev = n._conflicted_rev._rev;
            n._conflicted = false;
          } else {
            n.set(n._conflicted_rev);
            n._rev = n._conflicted_rev._rev;
            n._conflicted = false;
          }
        }
      });

      // Ready with resolving conflicts
      callback();
    };
    
    graph.sync(syncCompleted, resolveConflicts);
    return false;
  },
  
  initialize: function() {
    // Load recently used project or create a new one
    this.project = new Project();
  },
  
  render: function() {
    this.project.render();
    return this;
  }
});

var app, router;
var graph = new Data.Graph(seed, {dirty: false, persistent: true}).connect('ajax');

(function() {
  $(function() {
    
    // Init Application
    // --------------

    // Once the graph is ready
    graph.connected(function() {
      
      // Initialize router
      router = new Router({app: this});
      
      // Init the app
      app = new Application({el: '#container', session: session});
    
      // Start responding to routes
      Backbone.history.start({pushState: true});
      
      app.render();
    });
  });
})();