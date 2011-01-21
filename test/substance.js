// Testsuite covering the usecases of Substance
// -------------------
// 
// See http://github.com/michael/substance

var fs = require('fs');
var assert = require('assert');
var Data = require('../data');
var _ = require('underscore');
var async = require('async');


// Setup Data.Adapter
Data.setAdapter('couch', { url: 'http://localhost:5984/substance' });

// Our Domain Model with some sample data

var seedGraph = {
  
  // User
  // --------------------
  
  "/type/user": {
    "_id": "/type/user",
    "type": "/type/type",
    "properties": {
      "username": {
        "name": "Username",
        "unique": true,
        "expected_type": "string",
      },
      "email": {
        "name": "Email",
        "unique": true,
        "expected_type": "string",
      },
      "password": {
        "name": "Password",
        "unique": true,
        "expected_type": "string",
      },
      "firstname": {
        "name": "Firstname",
        "unique": true,
        "expected_type": "string"
      },
      "lastname": {
        "name": "Lastname",
        "unique": true,
        "expected_type": "string"
      }
    }
  },
  
  
  // Document
  // --------------------
  
  "/type/document": {
    "_id": "/type/document",
    "type": "/type/type",
    "properties": {
      "title": {
        "name": "Document Title",
        "unique": true,
        "expected_type": "string"
      },
      "user": {
        "name": "User",
        "unique": true,
        "expected_type": "/type/user"
      },
      "children": {
        "name": "Sections",
        "unique": false,
        "expected_type": "/type/section"
      }
    }
  },
  
  
  // Section
  // --------------------
  
  "/type/section": {
    "_id": "/type/section",
    "type": "/type/type",
    "properties": {
      "name": {
        "name": "Name",
        "unique": true,
        "expected_type": "string"
      },
      "children": {
        "name": "Children",
        "unique": false,
        "expected_type": "/type/text" // ["/type/text", "/type/image", "/type/quote"]
      }
    }
  },
  
  // Text
  // --------------------
  
  "/type/text": {
    "_id": "/type/text",
    "type": "/type/type",
    "properties": {
      "content": {
        "name": "Content",
        "unique": true,
        "expected_type": "string",
      }
    }
  },
  
  // Image
  // --------------------
  
  "/type/image": {
    "_id": "/type/image",
    "type": "/type/type",
    "properties": {
      "title": {
        "name": "Image Title",
        "unique": true,
        "expected_type": "string",
      },
      "url": {
        "name": "Image URL",
        "unique": true,
        "expected_type": "string"
      }
    }
  }
};

var graph = new Data.Graph(seedGraph);
var doc, user;

function storeSchema(callback) {
  graph.sync(function(err) {
    err ? callback(err) : callback();
  });
};

function createDocument(callback) {
  var id = '/document/substance';
  
  // Setup a user first
  user = graph.set('/user/michael', {
    username: 'michael',
    email: 'email@domain.com',
    firstname: 'Michael',
    lastname: 'Aufreiter'
  });
  
  // Add a document
  doc = graph.set(id, {
    title: 'Document authoring with Substance',
    user: "/user/michael", // references the user object
    children: []
  });
  
  callback();

  assert.ok(doc.get('title') === 'Document authoring with Substance');  
  assert.ok(doc.get('user').get('email') === 'email@domain.com');
  assert.ok(doc.get('user').get('firstname') === 'Michael');
  assert.ok(doc.get('user').get('lastname') === 'Aufreiter');
};


function addSections(callback) {
  callback();
};


// Tests are run sequentially as they depend on each other
async.waterfall([
  Data.adapter.flush,
  storeSchema,
  createDocument,
  addSections,
], function(err) {
  console.log('Testsuite passed.');
});
