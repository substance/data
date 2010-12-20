var sys = require('sys');
var assert = require('assert');
var vows = require('vows');
var Data = require('../data');
var CouchAdapter = require('../adapters/couch_adapter');
var fs = require('fs');
var _ = require('underscore');

var documents_fixture = require('../fixtures/documents');

// Schema
// -------------------

var graph_fixture = {
  "/type/location": {
    "type": "/type/type",
    "name": "Location",
    "properties": {
      "name": {
        "name": "Name",
        "unique": true,
        "expected_type": "string"
      },
      "citizens": {
        "name": "Citizens",
        "unique": false,
        "expected_type": "/type/person"
      }
    }
  }
};

// Initialize a new graph

var graph = new Data.Graph(graph_fixture);

assert.ok(graph.get('/type/location').type === '/type/type');

// Set adapter
Data.setAdapter('couch', { url: 'http://localhost:5984/documents' });

graph.fetch({'type': '/type/document'}, {expand: true}, function(err) {
  
  // Yeah we've got new data
  assert.ok(graph.get('/doc/protovis_introduction').get('title') === "Protovis Introduction");

  // Now lets do some graph manipulation
  var protovis = graph.get('/doc/protovis_introduction');
  
  var randomPageCount = parseInt(Math.random()*400);
  
  protovis.set({
    'page_count': randomPageCount
  });
  
  // Store our modified graph on the server
  graph.save(function(err) {
    // Now we create a whole new graph and fetch the protovis node to check if the changes have landed in the DB
    var anotherGraph = new Data.Graph();
    
    anotherGraph.fetch({'_id': '/doc/protovis_introduction'}, {expand: true}, function(err, res) {
      assert.ok(graph.get('/doc/protovis_introduction').get('page_count') === randomPageCount);
    });
  });
});