var Test = require('substance-test');

var SimpleDataTest = require("./simple-data-test");
var SimpleVersionedDataTest = require("./simple-versioned-data-test");

Test.registerTest(['Substance.Data', 'Simple'], new SimpleDataTest());
Test.registerTest(['Substance.Data', 'Versioned'], new SimpleVersionedDataTest());
