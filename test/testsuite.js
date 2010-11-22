// Data.js — A utility belt for data manipulation
//-------------

var items;

module("SortedHash", {
  setup: function() {
    items = new Data.SortedHash();
    items.set("at", "Austria");
    items.set("de", "Germany");
  },
  teardown: function() {
    delete items;
  }
});

test("construction from Array", function() {
  var numbers = new Data.SortedHash([1, 2, 5, 10]);
  
  ok(numbers.at(0) === 1);
  ok(numbers.at(1) === 2);
  ok(numbers.at(2) === 5);
  ok(numbers.at(3) === 10);

  // key equals index
  ok(numbers.get(0) === 1);
  ok(numbers.get(1) === 2);
  ok(numbers.get(2) === 5);
  ok(numbers.get(3) === 10);
  
  ok(numbers.length === 4);
});

test("construction from Hash", function() {
  var countries = new Data.SortedHash({
    'at': 'Austria',
    'de': 'Germany',
    'ch': 'Switzerland'
  });
  
  // please note: order is undetermined since native javascript hashes
  // are not sorted. please perform a sort() operation after construction
  // if you want to rely on item ordering.
  ok(countries.get('at') === 'Austria');
  ok(countries.get('de') === 'Germany');
  ok(countries.get("ch") === "Switzerland");
  ok(countries.length === 3);
});


test("insertion", function() {
  items.set("ch", "Switzerland");
  ok(items.length === 3);
});


test("value overwrite", function() {
  items.get("at") === "Austria";
  items.set("at", "Österreich");
  ok(items.length === 2);
  ok(items.get("at") === "Österreich");
});

test("clone", function() {
  // TODO: add some assertions
  items.clone();
});

test("key", function() {
  ok(items.key(0) === "at");
  ok(items.key(1) === "de");
});


test("hash semantics", function() {
  var keys = [];
  var values = [];
  
  ok(items.get("at") === "Austria");
  ok(items.get("de") === "Germany");
  
  // order is also reflected in eachKey
  items.each(function(item, key) {
    keys.push(key);
    values.push(item);
  });
  
  ok(keys.length === 2 && values.length === 2);
  ok(keys[0] === 'at');
  ok(keys[1] === 'de');
  ok(values[0] === 'Austria');
  ok(values[1] === 'Germany');
});

test("array semantics", function() {
  var values = [];
  items.get(0) === "Austria";
  items.get(1) === "Germany";
  items.length === 1;
  
  items.each(function(item, key, index) {
    values.push(item);
  });
  
  ok(values.length === 2);
  ok(values[0] === 'Austria');
  ok(values[1] === 'Germany');
  
  ok(items.first() === "Austria");
  ok(items.last() === "Germany");
  
});

test("SortedHash#del", function() {
  items.set("ch", "Switzerland");
  items.del('de');
  ok(items.length === 2);
  ok(items.keyOrder.length === 2);
  ok(items.get('de') === undefined);
});


test("SortedHash#each", function() {
  var enumerated = [];
  items.each(function(item, key, index) {
    enumerated.push(item);
  });
  
  ok(enumerated[0]==="Austria");
  ok(enumerated[1]==="Germany");
});

test("SortedHash#values", function() {
  items.set("ch", "Switzerland");
  var values = items.values();

  ok(values[0] === "Austria");
  ok(values[1] === "Germany");
  ok(values[2] === "Switzerland");
});


test("SortedHash#sort", function() {
  items.set("ch", "Switzerland");

  ok(items.at(0)==="Austria");
  ok(items.at(1)==="Germany");
  ok(items.at(2)==="Switzerland");
  
  // sort descending
  var sortedItems = items.sort(Data.Comparators.DESC);
  
  ok(sortedItems.at(0)==="Switzerland");
  ok(sortedItems.at(1)==="Germany");
  ok(sortedItems.at(2)==="Austria");
});



test("SortedHash#map", function() {
  var mappedItems = items.map(function (item) {
    return item.slice(0, 3);
  });
  
  // leave original SortedHash untouched
  ok(items.get('at') === 'Austria');
  ok(items.get('de') === 'Germany');
  ok(items.at(0) === 'Austria');
  ok(items.at(1) === 'Germany');

  ok(mappedItems.get('at') === 'Aus');
  ok(mappedItems.get('de') === 'Ger');  

  ok(mappedItems.at(0) === 'Aus');
  ok(mappedItems.at(1) === 'Ger');
});



test("SortedHash#select", function() {
  var selectedItems = items.select(function (item, key) {
        return item === 'Austria';
      });

  // leave original SortedHash untouched
  ok(items.get('at') === 'Austria');
  ok(items.get('de') === 'Germany');
  ok(items.at(0) === 'Austria');
  ok(items.at(1) === 'Germany');
  
  ok(selectedItems.at(0) === 'Austria');
  ok(selectedItems.get("at") === 'Austria');
  ok(selectedItems.length === 1);
});


test("SortedHash#intersect", function() {
  var items2 = new Data.SortedHash(),
      intersected;
  
  items2.set('fr', 'France');
  items2.set('at', 'Austria');
  
  // leave original SortedHashes untouched
  ok(items.get('at') === 'Austria');
  ok(items.get('de') === 'Germany');
  ok(items.at(0) === 'Austria');
  ok(items.at(1) === 'Germany');
  
  ok(items2.get('fr') === 'France');
  ok(items2.get('at') === 'Austria');
  ok(items2.at(0) === 'France');
  ok(items2.at(1) === 'Austria');
  
  intersected = items.intersect(items2);
  ok(intersected.length === 1);
  ok(intersected.get('at') === 'Austria');
});


test("SortedHash#union", function() {
  var items2 = new Data.SortedHash(),
      unitedItems;
  
  items2.set('fr', 'France');
  items2.set('at', 'Austria');
  
  // leave original SortedHashes untouched
  ok(items.get('at') === 'Austria');
  ok(items.get('de') === 'Germany');
  ok(items.at(0) === 'Austria');
  ok(items.at(1) === 'Germany');
  
  ok(items2.get('fr') === 'France');
  ok(items2.get('at') === 'Austria');
  ok(items2.at(0) === 'France');
  ok(items2.at(1) === 'Austria');
  
  unitedItems = items.union(items2);
  ok(unitedItems.length === 3);
  ok(unitedItems.get('at') === 'Austria');
  ok(unitedItems.get('de') === 'Germany');
  ok(unitedItems.get('fr') === 'France');
});


test("fail prevention", function() {
  // null is a valid key
  items.set(null, 'Netherlands');
  // undefined is not
  items.set(undefined, 'Netherlands');
  items.set('null_value', null);
  items.set('undefined_value', undefined);
  ok(items.length === 5);
});


//-----------------------------------------------------------------------------
// Node API
//-----------------------------------------------------------------------------

var austrian, english, german, eu, austria, germany, uk;

module("Node", {
  setup: function() {
    austrian = new Data.Node({value: 'Austrian'});
    english = new Data.Node({value: 'English'});
    german = new Data.Node({value: 'German'});
    
    // confederations
    eu = new Data.Node();
    
    // countries
    austria = new Data.Node();
    germany = new Data.Node();
    uk = new Data.Node();
    
    // people
    barroso = new Data.Node({value: 'Barroso'});
    
    // connect some nodes
    austria.set('languages', 'at', austrian);
    austria.set('languages', 'ger', german);
    
    eu.set('president', 'barroso', barroso);
  },
  teardown: function() {
    
  }
});

test("get connected nodes", function() {
  // order should be preserved
  ok(austria.all('languages') instanceof Data.SortedHash); // => returns a SortedHash
  ok(austria.all('languages').at(0) === austrian);
  ok(austria.all('languages').at(1) === german);
  
  ok(austria.get('languages', 'at') === austrian);
  ok(austria.get('languages', 'ger') === german);
});

test("get first connected node", function() {  
  ok(eu.first('president') instanceof Data.Node);
  ok(eu.first('president').val === 'Barroso');
});

test("iteration of connected nodes", function() {
  var nodes = [];
  austria.all('languages').each(function(node) {
    nodes.push(node);
  });
  ok(nodes.length === 2);
});

test("Node#list", function() {
  // non-unqiue property
  ok(austria.all('languages').length === 2);
  ok(austria.all('languages').get('at') === austrian);
  ok(austria.all('languages').get('ger') === german);
  
  // unique property
  ok(eu.all('president').length === 1);
  ok(eu.values('president').first() === 'Barroso');
});

test("Node#values", function() {
  var values = austria.values('languages');
  
  // for non-unique properties
  ok(values.at(0) === 'Austrian');
  ok(values.at(1) === 'German');
  ok(values.get('at') === 'Austrian');
  ok(values.get('ger') === 'German');
  
  // for unique properties
  ok(eu.values('president').at(0) === 'Barroso');
});

test("Node#value", function() {
  var values = austria.values('languages');
  
  // for non-unique properties
  ok(austria.value('languages') === 'Austrian');
  
  // for unique properties
  ok(eu.value('president') === 'Barroso');
});

test("Allows null as a key for property values", function() {
  var root = new Data.Node({value: 'RootNode'});
  var nullNode = new Data.Node({value: null});
  root.set('values', null, nullNode);
  ok(root.value('values', null) === null);
});