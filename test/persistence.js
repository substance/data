var fs = require('fs');
var assert = require('assert');
var Data = require('../data');
var crypto = require('crypto');
var _ = require('underscore');
var async = require('async');
var seed = JSON.parse(fs.readFileSync(__dirname+ '/../fixtures/artists.json', 'utf-8'));


// Setup a new connection and returns a graph instance
function connectGraph() {
  return new Data.Graph(seed).connect('couch', { url: "http://localhost:5984/datajs_test" });
}

// Setup the database
// ---------------------

function setup(callback) {
  var graph = new Data.Graph(seed, true).connect('couch', { url: "http://localhost:5984/datajs_test" });
  graph.adapter.flush(function() {
    graph.sync(callback);
  });
}

// Creating objects and sync with the database
// ---------------------

function testObjectInsertion(callback) {
  var graph = connectGraph();
  
  graph.set({
    "_id": "/artist/television",
    "type": "/type/artist",
    "name": "Television"
  });
  
  graph.set({
    "_id": "/artist/kraftwerk",
    "type": "/type/artist",
    "name": "Kraftwerk"
  });
  
  graph.set({
    "_id": "/artist/new_order",
    "type": "/type/artist",
    "name": "NewOrder",
    "influencees": ["/artist/television", "/artist/kraftwerk"]
  });
  
  graph.set({
    "_id": "/artist/bad_lieutenant",
    "type": "/type/artist",
    "name": "Bad Lieutenant",
    "influencees": ["/artist/new_order"]
  });
  
  graph.sync(function(err, invalidNodes) {
    assert.ok(!err && graph.dirtyNodes().length === 0);
    callback();
  });
}

// Test validation (on the server-side)
// ---------------------

function testValidation(callback) {
  var graph = connectGraph();
  
  // In order to skip local validation and perform it on the serverside
  // we need to talk to the adapter directly.
  var newObj = {
    "/artist/trentemoller": {
      "type": ["/type/artist"],
      "name": "Trentemøller" // Invalid since it contains a special character
    }
  };
  
  graph.adapter.write(newObj, function(err, g) {
    assert.ok(!g["/artist/trentemoller"]._rev);
    callback();
  });
}

// Simulate a conflict situation
// ---------------------

function testConflictDetection(callback) {
  var graph = connectGraph();
  var otherGraph = connectGraph();
  
  // Both clients fetch the latest version of /artist/kraftwerk
  graph.fetch({"_id": "/artist/kraftwerk"}, function() {
    otherGraph.fetch({"_id": "/artist/kraftwerk"}, function() {
      // First client updates the name of /artist/kraftwerk and saves it
      graph.get('/artist/kraftwerk').set({
        name: "KRAFTWERK"
      });
      graph.sync(function(err) {
        assert.ok(!err);
        
        // Second client wants to make a change too, but is late
        otherGraph.get('/artist/kraftwerk').set({
          name: "KrAfTwErK"
        });
        otherGraph.sync(function(err) {
          assert.ok(err);
          assert.ok(otherGraph.conflictedNodes().length === 1);
          callback();
        });
      });
    });
  });
}

function testQueryEngine(callback) {
  var graph = connectGraph();
  
  // Recursively fetch all influencees of /artist/bad_lieutenant
  var qry = {
    "_id": "/artist/bad_lieutenant",
    "influencees": {"_recursive": true}
  };
  
  graph.fetch(qry, function(err, nodes) {
    var obj = graph.get("/artist/bad_lieutenant");
    assert.ok(obj);
    assert.ok(obj.get('influencees').length == 1);
    assert.ok(obj.get('influencees').first().get('name'));
    assert.ok(obj.get('influencees').first().get('influencees').first().get('name'));
    callback();
  });
}

// Flush DB and perform tests
// ---------------------

async.series([
  setup,
  testObjectInsertion,
  testValidation,
  testConflictDetection,
  testQueryEngine
], function(err) {
  console.log('Tests completed.');
});