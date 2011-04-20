var fs = require('fs');
var assert = require('assert');
var Data = require('../../../data');
var crypto = require('crypto');
var _ = require('underscore');

var config = JSON.parse(fs.readFileSync(__dirname+ '/../config.json', 'utf-8'));
var seed = JSON.parse(fs.readFileSync(__dirname+ '/schema.json', 'utf-8'));

// Setup Data.Adapter
Data.setAdapter('couch', { url: config.couchdb_url });

// var encryptPassword = function (password) {
//   var hash = crypto.createHash('sha256');
//   hash.update(password);
//   return hash.digest('hex');
// };

var graph = new Data.Graph(seed, true);

// Example User

// var user = graph.set("/user/demo", {
//   "type": "/type/user",
//   "username": "demo",
//   "name": "Demo User",
//   "email": "demo@dejavis.org",
//   "password": encryptPassword('demo'),
//   "datasource_permissions": [],
//   "created_at": new Date()
// });



if (process.argv[2] == "--flush") {
  Data.adapter.flush(function(err) {
    console.log('DB Flushed.');
    err ? console.log(err)
        : graph.sync(function(err, invalidNodes) {
          console.log('invalidNodes:');
          if (invalidNodes) console.log(invalidNodes.keys());
          
          err ? console.log(err)
              : console.log('Couch seeded successfully.\nStart the server: $ node server.js');
        });
  });
} else {
  graph.sync(function(err, invalidNodes) {
    console.log('invalidNodes:');
    if (invalidNodes) console.log(invalidNodes.keys());
    err ? console.log(err)
        : console.log('Couch seeded successfully.\nStart the server: $ node server.js');
  });
}
