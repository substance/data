var MochaTestRunner = require("substance-test").MochaTestRunner;

require("./001-data-graph");
require("./002-versioned-graph");
require("./003-persistent-graph");

new MochaTestRunner().run();
