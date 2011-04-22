var Project = Backbone.View.extend({
  events: {
    'submit #new_task_form': 'createTask',
    'click .load-project': 'loadProject'
  },
  
  el: '#project',
  
  initialize: function() {
    this.load("/project/test");
  },
  
  loadProject: function(e) {
    this.load($(e.currentTarget).attr('project'))
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
  
  // Load a specific project
  load: function(id) {
    var that = this;
    if (this.previousId) {
      graph.unwatch(this.previousId);
    }
    
    this.previousId = id;
    
    // Fetch project along with tasks in one go
    var query =  [
      {"type": "/type/project", "_id": id},
      {"type": "/type/task", "project": id}
    ];
    
    graph.fetch(query, function(err, nodes) {
      that.model = graph.get(id);
      that.render();
      
      var watchQry = [
        {"type|=": "/type/project", "_id": id},
        {"type|=": "/type/task", "project": id}
      ];
      
      // Watch for updates in realtime
      graph.watch(id, watchQry, function(err, nodes) {
        console.log('incoming updates');
        console.log(nodes.keys());
        app.project.render();
      });
    });
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