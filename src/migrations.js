"use strict";

var _ = require("underscore");
var util = require("substance-util");

var MigrationError = util.errors.define("MigrationError", -1);

// Migration support for Data.Graphs
// =================================
//
// A Graph instance can provide migrations to be able to open older document
// versions by transforming them into the current one.
// For that, `graph.getMigrations()` should return a map of migration functions.
// A migration function takes a json object of the previous version and returns
// a transformed object.
//
// Example:
//
// function v010000_v020000(v1_data) {}
//   var migrator = new Migrator(v1_data);
//   migrator.removeNodes({"type": 'mynode'});
//   migrator.renameNodeType('old_type', 'new_type');
//   return migrator.getResult();
// }
//
// Article.protoype.getMigrations = function() {
//   return {
//    "2.0.0": v010000_v020000
//   };
// }
//
// Note:

var Migrations = function(graph) {
  Array.call(this);
  var self = this;

  this.graph = graph;
  _.each(graph.getMigrations(), function(migrationFunction, versionStr) {
    self.push({
      version: Migrations.versionFromString(versionStr),
      process: migrationFunction
    });
  });

  // sort the version semantically
  this.sort(Migrations.compareMigrations);
};

Migrations.Prototype = function() {

  // lookup the migration by version string
  this.findIndex = function(versionStr) {
    var pattern = {
      version: Migrations.versionFromString(versionStr)
    };
    for (var i = this.length - 1; i >= 0; i--) {
      if (Migrations.compareMigrations(pattern, this[i]) === 0) {
        return i;
      }
    }
    return -1;
  };


  this.migrate = function(data) {
    var migrator = new Migrations.Migrator(data);

    if (migrator.getVersion() === this.graph.schema.version) {
      return;
    }

    // look for the given version
    var idx = this.findIndex(migrator.getVersion());
    if (idx < 0) {
      throw new MigrationError("No migration found for version" + migrator.getVersion());
    }

    // we apply all subsequent migrations
    for (idx = idx + 1; idx < this.length; idx++) {
      var nextMigration = this[idx];
      var nextVersionStr = nextMigration.version.join(".");
      console.log("Migrating", this.graph.schema.id+"@"+migrator.getVersion(), "->", this.graph.schema.id+"@"+nextVersionStr);
      nextMigration.process(migrator);
      migrator.setVersion();
    }

    // return the migrator to allow to do something with it, e.g., display problems...
    return migrator;
  };
};

Migrations.Prototype.prototype = Array.prototype;
Migrations.prototype = new Migrations.Prototype();

var versionFromString = function(versionStr) {
  var arr = versionStr.split(".");
  return arr.map(function(s) { return parseInt(s, 10); });
};

var compareMigrations = function(a, b) {
  var v1 = a.version;
  var v2 = b.version;
  for (var i = 0; i < 3; i++) {
    if (v1[i] < v2[i]) return -1;
    if (v1[i] > v2[i]) return 1;
  }
  return 0;
};

var Migrator = function(data) {
  this.data = data;
  this.warnings = [];
};

Migrator.Prototype = function() {

  this.getVersion = function() {
    return this.data.schema[1];
  };

  this.setVersion = function(version) {
    this.data.schema[1] = version;
  };

  this.removeType = function(nodeType) {
    throw new MigrationError("Not yet implemented", nodeType);
  };

  this.renameType = function(nodeType, newType) {
    throw new MigrationError("Not yet implemented", nodeType, newType);
  };

  this.removeProperty = function(nodeType, propertyName) {
    throw new MigrationError("Not yet implemented", nodeType, propertyName);
  };

  this.renameProperty = function(nodeType, propertyName, newPropertyName) {
    throw new MigrationError("Not yet implemented", nodeType, propertyName, newPropertyName);
  };

  this.addProperty = function(nodeType, propertyName, defaultValue) {
    _.each(this.data.nodes, function(n) {
      if (n.type === nodeType) {
        n[propertyName] = defaultValue;
      }
    }, this);
  };

  this.reportWarning = function(msg, data) {
    this.warnings.push({
      message: msg,
      data: data
    });
  };
};
Migrator.prototype = new Migrator.Prototype();

Migrations.MigrationError = MigrationError;
Migrations.versionFromString = versionFromString;
Migrations.compareMigrations = compareMigrations;
Migrations.Migrator = Migrator;

module.exports = Migrations;
