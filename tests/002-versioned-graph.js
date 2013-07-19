"use strict";

// Import
// ========

var _    = require('underscore');
var substance_test = require('substance-test');
var assert = substance_test.assert;
var registerTest = substance_test.registerTest;
var util = require('substance-util');

var Operator = require('substance-operator');
var Data = require('..');
var Chronicle = require('substance-chronicle');


// Test
// ========

var test = {};

var SCHEMA = {
  "views": {
    // Stores order for content nodes
    "content": {
    }
  },

  // static indexes
  "indexes": {
    // all comments are now indexed by node association
    "comments": {
      "type": "comment",
      "properties": ["node"]
    },
    // All comments are now indexed by node
    "annotations": {
      "type": "annotation", // alternatively [type1, type2]
      "properties": ["node"]
    }
  },

  "types": {
    // Specific type for substance documents, holding all content elements
    "content": {
      "properties": {

      }
    },
    "text": {
      "parent": "content",
      "properties": {
        "content": "string"
      }
    },

    "document": {
      "properties": {
        "views": "array"
      }
    },

    "view": {
      "properties": {
        "nodes": "array"
      }
    },

    "code": {
      "parent": "content",
      "properties": {
        "content": "string"
      }
    },
    "image": {
      "parent": "content",
      "properties": {
        "large": "string",
        "medium": "string",
        "caption": "string"
      }
    },
    "heading": {
      // TODO: this has been duplicate
      // "parent": "node",
      "properties": {
        "content": "string",
        "level": "number"
      },
      "parent": "content"
    },
    // Annotations
    "annotation": {
      "properties": {
        "node": "node",
        "pos": "object"
      }
    },
    "strong": {
      "properties": {
        "node": "string", // should be type:node
        "pos": "object"
      },
      "parent": "annotation"
    },
    "emphasis": {
      "properties": {
        "node": "string", // should be type:node
        "pos": "object"
      },
      "parent": "annotation"
    },
    "inline-code": {
      "parent": "annotation",
      "properties": {
        "node": "string", // should be type:node
        "pos": "object"
      }
    },
    "link": {
      "parent": "annotation",
      "properties": {
        "node": "string", // should be type:node
        "pos": "object",
        "url": "string"
      }
    },
    "idea": {
      "parent": "annotation",
      "properties": {
        "node": "string", // should be type:node
        "pos": "object",
        "url": "string"
      }
    },
    "error": {
      "parent": "annotation",
      "properties": {
        "node": "string", // should be type:node
        "pos": "object",
        "url": "string",
      }
    },
    "question": {
      "parent": "annotation",
      "properties": {
        "node": "string", // should be type:node
        "pos": "object",
        "url": "string"
      }
    },
    // Comments
    "comment": {
      "properties": {
        "content": "string",
        "node": "node"
      }
    }
  }
};


var OP1 = ["create", { "id": "document", "type": "document", "views": ["content", "figures"]} ];
var OP2 = ["create", { "id": "content", "type": "view", "nodes": []} ];
var OP3 = ["create", { "id": "h1", "type": "heading", "content": "Heading 1" } ];
var OP4 = ["update", "content", "nodes", Operator.ArrayOperation.Insert(0, "h1")];
var OP5 = ["create", { "id": "text1", "type": "text", "content": "This is text1." } ];
var OP6 = ["update", "content", "nodes", Operator.ArrayOperation.Insert(1, "text1") ];
var OP7 = ["update", "content", "nodes", Operator.ArrayOperation.Move(1, 0) ];
var OP8 = ["create", { "id": "text2", "type": "text", "content": "This is text2." } ];
var OP9 = ["update", "content", "nodes", Operator.ArrayOperation.Insert(1, "text2") ];

// Graph:
//
//  ROOT -    1 -   2 -   3 -   4 -   5 -   6 -   7
//                              |                   \
//                              |                     M1 (5,6,8,9,7)
//                              |                   /
//                              | -   8 -   9 -    -
//
//
//

test.setup = function() {
  this.graph = new Data.Graph(SCHEMA, {chronicle: Chronicle.create()});
  this.chronicle = this.graph.chronicle;
  this.index = this.chronicle.index;
  this.adapter = this.graph.chronicle.versioned;

  this.ID = ["ROOT"];
  this.M = ["ROOT"];

  var self = this;
  this.CHECKS = {"ROOT": function() {
    assert.isTrue(_.isEmpty(self.graph.nodes));
  }};
  this.chronicle.uuid = util.custom_uuid({id: 1});

};

test.actions = [

  "Creation", function() {
    var check;
    var self = this;

    this.CHECKS["ROOT"]();

    this.graph.apply(OP1);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isArrayEqual(["content", "figures"], self.graph.get("document").views);
    };
    check();

    this.graph.apply(OP2);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isArrayEqual([], self.graph.get("content").nodes);
    };
    check();

    this.graph.apply(OP3);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isEqual("Heading 1", self.graph.get("h1").content);
    };
    check();

    this.graph.apply(OP4);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isArrayEqual(["h1"], self.graph.get("content").nodes);
    };
    check();

    this.graph.apply(OP5);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isEqual("This is text1.", self.graph.get("text1").content);
    };
    check();

    this.graph.apply(OP6);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isArrayEqual(["h1", "text1"], self.graph.get("content").nodes);
    };
    check();

    this.graph.apply(OP7);
    this.ID.push(this.chronicle.getState());
    this.CHECKS[_.last(this.ID)] = check = function() {
      assert.isArrayEqual(["text1", "h1"], self.graph.get("content").nodes);
    };
    check();
  },

  "Random checkout", function() {
    this.graph.reset();

    var sequence = ["1", "7", "5", "4", "3", "2", "6"];

    _.each(sequence, function(id) {
      this.chronicle.open(id);
      this.CHECKS[id].call(this);
    }, this);
  },

  "Merge", function() {
    this.chronicle.open(this.ID[4]);
    this.graph.apply(OP8);
    this.ID.push(this.chronicle.getState());
    this.graph.apply(OP9);
    this.ID.push(this.chronicle.getState());

    this.chronicle.open(this.ID[7]);
    var mergeOptions = {
      sequence: [this.ID[5], this.ID[6], this.ID[8], this.ID[9], this.ID[7]],
      force: true
    };
    this.chronicle.merge(this.ID[9], "manual", mergeOptions);
    this.M.push(this.chronicle.getState());

    assert.isArrayEqual(["text1", "h1", "text2"], this.graph.get("content").nodes);
  },

];

registerTest(['Data', 'Versioned Graph'], test);
