global._ = require('underscore');
var Test = require("substance-test");

require("./index");

new Test.MochaRunner().run();
