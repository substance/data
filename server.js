var _ = require('underscore');
var Data = require('./data');
var fs = require('fs');

exports.initialize = function(server, graph, config) {
  
  // Serve Data.js and client adapters
  // --------------
  
  server.get('/datajs/data.js', function(req, res) {
    res.writeHead(200, {'content-type': 'text/javascript'});
    res.write(fs.readFileSync(__dirname+ '/data.js', 'utf-8')+"\n");
    res.write(fs.readFileSync(__dirname+ '/adapters/ajax_adapter.js', 'utf-8')+"\n");
    res.write(fs.readFileSync(__dirname+ '/adapters/nowjs_adapter.js', 'utf-8'));
    res.end();
  });
  
  // AJAX interface
  // --------------
  
  server.get('/graph/read', function(req, res) {
    var callback = req.query.callback,
        query = JSON.parse(req.query.qry),
        options = JSON.parse(req.query.options);
        
    graph.adapter.read(JSON.parse(req.query.qry), JSON.parse(req.query.options), function(err, g) {
      err ? res.send(callback+"({\"error\": "+JSON.stringify(err)+"});")
          : res.send(callback+"("+JSON.stringify(g)+");");
    }, req.session);
  });

  server.put('/graph/write', function(req, res) {
    graph.adapter.write(req.body, function(err, g) {
      err ? res.send(JSON.stringify({error: err})) : res.send(JSON.stringify({"status": "ok", "graph": g}));
    }, req.session);
  });
  
  server.post('/graph/pull', function(req, res) {
    graph.adapter.pull(req.body, function(err, g) {
      err ? res.send(JSON.stringify({error: err})) : res.send(JSON.stringify({"status": "ok", "graph": g}));
    });
  });
};