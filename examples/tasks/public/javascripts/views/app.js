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
    'click .load-project': 'loadProject',
    'click .task .checkbox': 'toggleComplete',
    'change .task input': 'updateTask',
    'click .task .remove': 'removeTask'
  },
  
  el: '#project',
  
  initialize: function() {
    var lru = localStorage.getItem('project');
    // Use LRU project or create a new one
    if (lru) {
      this.model = graph.get(lru);
    } else {
      this.createProject();
    }
    this.render();
  },
  
  removeTask: function(e) {
    var taskId = $(e.currentTarget).parent().attr('task');
    graph.get(taskId).set({
      "tasks": this.model.get('tasks').del(taskId).keys()
    });
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
    localStorage.setItem('project', this.model._id);
  },
  
  loadProject: function(e) {
    this.model = graph.get($(e.currentTarget).attr('project'));
    localStorage.setItem('project', this.model._id);
    this.render();
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

// Application
// --------------

var Application = Backbone.View.extend({
  events: {
    'click a.start-sync': 'sync',
    'click a.reset': 'reset',
    'click a.create-project': 'createProject',
  },
  
  createProject: function(e) {
    this.project.createProject();
    this.render();
    return false;
  },
  
  reset: function() {
    localStorage.removeItem('graph');
    localStorage.removeItem('project');
    window.location.reload(true);
    return false;
  },
  
  sync: function() {
    var that = this;
    // Sync with server
    $('#sync_state').html('Synchronizing...');
    graph.sync(function(err) {
      if (!err) {
        $('#sync_state').html('Successfully synced.');
        setTimeout(function() {
          $('#sync_state').html('');
        }, 3000);
        that.project.render();
      } else {
        console.log(err);
        confirm('There was an error during synchronization. The workspace will be reset for your own safety');
        window.location.reload(true);
      }
    });
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

var app;
var graph = new Data.Graph(seed, {dirty: false, persistent: true}).connect('ajax');

(function() {
  $(function() {
    
    // Init Application
    // --------------

    // Once the graph is ready
    graph.connected(function() {
      app = new Application({el: '#container', session: session});
      app.render();
    });
  });
})();