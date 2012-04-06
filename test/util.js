(function() {
  this.StopWatch = function() {
    var start;

    this.start = function() {
      start = new Date().getTime();
    },

    this.stop = function() {
      return new Date().getTime() - start;
    }
  };
}).call(window._);
