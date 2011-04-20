var Project = Backbone.View.extend({
  events: {
    'submit #new_task_form': 'createProject'
  },
  
  el: '#project',
  
  initialize: function() {
    this.load("/project/test");
  },
  
  createProject: function(e) {
    var task = graph.set(null, {
      type: "/type/task",
      name: $('#task_name').val(),
      project: this.model._id
    });
    
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
    
    graph.fetch({_id: id}, {expand: true}, function(err, nodes) {
      that.model = graph.get(id);
      that.render();
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