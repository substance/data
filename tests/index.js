var Test = require('substance-test');

var SchemaTest = require("./schema_test");
var GraphManipulationTest = require("./graph_manipulation_test");
var GraphIndexTest = require("./graph_index_test");
var VersionedGraphTest = require("./versioned_graph_test");
var GraphEventsTest = require("./graph_events_test");
var COWGraphTest = require('./cow_graph_test');

Test.registerTest(['Substance.Data', 'Schema'], new SchemaTest());
Test.registerTest(['Substance.Data', 'Graph Manipulation'], new GraphManipulationTest());
Test.registerTest(['Substance.Data', 'Graph Indexes'], new GraphIndexTest());
Test.registerTest(['Substance.Data', 'Versioned Graph'], new VersionedGraphTest());
Test.registerTest(['Substance.Data', 'Graph Events'], new GraphEventsTest());
Test.registerTest(['Substance.Data', 'CopyOnWrite Graph'], new COWGraphTest());
