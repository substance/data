var express = require('express');
var app = express.createServer();
var http = require('http');
var fs = require('fs');
var async = require('async');
var Data = require('../../data');
var _ = require('underscore');

// App Config
global.config = JSON.parse(fs.readFileSync(__dirname+ '/config.json', 'utf-8'));
global.seed = JSON.parse(fs.readFileSync(__dirname+ '/db/schema.json', 'utf-8'));

// Express.js Configuration
// -----------

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({secret: config['secret']}));
  app.use(app.router);
  app.use(express.static(__dirname+"/public", { maxAge: 41 }));
  app.use(express.static(__dirname+"/../../", { maxAge: 41 }));
  app.use(express.logger({ format: ':method :url' }));
});

var graph = new Data.Graph(seed, false);
var myapp = {};

// Showcasing middleware functionality
var Filters = {};
Filters.makeCrazy = function() {
  return {
    read: function(node, next, ctx) {
      node.crazy = true;
      next(node); // passes through the filtered node
    },

    write: function(node, next,ctx) {
      next(node); // no-op
    }
  };
};


// Connect to a data-store
graph.connect('couch', { 
  url: config.couchdb_url,
  filters: [
    Filters.makeCrazy()
  ]
});

// Serve Data.js backend along with an express server
graph.serve(app);


// Routes
// -----------

app.get('/', function(req, res) {
  html = fs.readFileSync(__dirname+ '/templates/app.html', 'utf-8');
  res.send(html.replace('{{{{seed}}}}', JSON.stringify(seed))
               .replace('{{{{session}}}}', JSON.stringify(req.session)));
});

console.log('READY: Server is listening http://'+config['server_host']+':'+config['server_port']);
app.listen(config['server_port'], config['server_host']);