(function(root) {

// var _ = root._;
var Substance = root.Substance;
// var util = Substance.util;
var assert = Substance.assert;
var ot = root.Substance.Chronicle.ot;
//var Data = root.Substance.Data;
var MemoryStore = root.Substance.MemoryStore;

var test = {};

var SCHEMA = {
  indexes : {
    "all": {
      "type": "node",
    },
    "foos": {
      "type": "foo",
    },
    "bars": {
      "type": "bar",
    },
    "by_category": {
      "type": "node",
      "properties": ["category"]
    }
  },
  types: {
    node: {
      properties: {
        category: "string"
      }
    },
    foo: {
      parent: "node"
    },
    bar: {
      parent: "node"
    }
  }
};

test.setup = function() {
  this.store = new MemoryStore();
  this.graph = new Substance.Data.Graph(SCHEMA, {store: this.store});
  this.nodes = this.graph.__nodes__;
};

var NODE1 = {
  id: "the_foo",
  type: "foo",
  category: "bla"
};
var NODE2 = {
  id: "the_bar",
  type: "bar",
  category: "blupp"
};

test.actions = [
  "Created node should be persisted", function() {
    this.graph.create(NODE1);
    this.graph.create(NODE2);

    var actual = this.nodes.get(NODE1.id);
    assert.isObjectEqual(NODE1, actual);

    actual = this.nodes.get(NODE2.id);
    assert.isObjectEqual(NODE2, actual);
  },

  "Deleted node should be removed from store", function() {
    this.graph.delete(NODE1.id);

    var actual = this.nodes.get(NODE1.id);
    assert.isUndefined(actual);
  },

  "Update: property updates should be persisted", function() {
    this.graph.update([NODE2.id, "category"], ot.TextOperation.fromOT("blupp", [2, -3, "a"]));

    var actual = this.nodes.get(NODE2.id);
    assert.isEqual("bla", actual.category);
  },

  "Set: property updates should be persisted", function() {
    this.graph.set([NODE2.id, "category"], "blupp");

    var actual = this.nodes.get(NODE2.id);
    assert.isEqual("blupp", actual.category);
  },

  "Import: persisted graph should be restored", function() {
    var graph = new Substance.Data.Graph(SCHEMA, {store: this.store}).load();
    var actual = graph.get(NODE2.id);
    assert.isObjectEqual(NODE2, actual);
  }
];

root.Substance.registerTest(['Data', 'Persistent Graph'], test);

})(this);
