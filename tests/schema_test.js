"use strict";

// Import
// ========

var _    = require('underscore');
var Test = require('substance-test');
var assert = Test.assert;
var Data = require('../index');


// Test
// ========

var SCHEMA = {
  id: "schema-1",
  version: "1.0.0",
  types: {
    elem: {
      properties: {
        obj: "object",
        arr: "array",
        str: "string",
        num: "number",
        flag: "boolean",
        time: "date",
      }
    },
    node: {
      properties: {
        name: "string",
      }
    },
    numbers: {
      parent: "node",
      properties: {
        val: ["number"],
        arr: ["array", "number"]
      }
    },
  }
};

var SchemaTest = function() {
  Test.call(this);
};

SchemaTest.Prototype = function() {

  this.setup = function() {
    this.graph = new Data.Graph(SCHEMA);
    this.schema = this.graph.schema;
  };

  this.actions = [

    "Schema.getDefaultValue()", function() {

      assert.isDeepEqual({}, this.schema.getDefaultValue("object"));
      assert.isArrayEqual([], this.schema.getDefaultValue("array"));
      assert.isEqual("", this.schema.getDefaultValue("string"));
      assert.isEqual(0, this.schema.getDefaultValue("number"));
      assert.isEqual(false, this.schema.getDefaultValue("boolean"));
      // can only check if a default date is given
      assert.isDefined(this.schema.getDefaultValue("date"));
    },

    "Schema.parseValue()", function() {
      assert.isDeepEqual({a: "bla"}, this.schema.parseValue("object", '{"a": "bla"}'));
      assert.isArrayEqual([1,2,3], this.schema.parseValue("array", '[1,2,3]'));
      assert.isEqual("bla", this.schema.parseValue("string", 'bla'));
      assert.isEqual(42, this.schema.parseValue("number", '42'));
      assert.isEqual(true, this.schema.parseValue("boolean", 'true'));
      var expected = new Date(Date.now());
      var parsedDate = this.schema.parseValue("date", expected.toISOString());
      assert.isEqual(expected.getTime(), parsedDate.getTime());
    },

    "Schema.getProperties()", function() {
      var props = this.schema.getProperties("elem");

      assert.isDeepEqual(SCHEMA.types.elem.properties, props);
      // props should be a copy
      props["ooooh"] = "aaaaahh";
      assert.isFalse(_.isEqual(SCHEMA.types.elem.properties, props));
    },

    "Inheritance - type chain", function() {
      var chain = this.schema.getTypeChain("numbers");
      assert.isArrayEqual(["numbers", "node"], chain);
    },

    "Inheritance - properties", function() {
      var expected = _.extend({}, SCHEMA.types.node.properties, SCHEMA.types.numbers.properties);
      var actual = this.schema.getProperties("numbers");
      assert.isDeepEqual(expected, actual);
    },

    "Composite types", function() {
      var expected = ["array", "number"];
      var actual = this.schema.getPropertyType("numbers", "arr");
      assert.isArrayEqual(expected, actual);
    }
  ];
};
SchemaTest.Prototype.prototype = Test.prototype;
SchemaTest.prototype = new SchemaTest.Prototype();

module.exports = SchemaTest;
