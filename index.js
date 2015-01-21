"use strict";

var Data = {};

// Current version of the library. Keep in sync with `package.json`.
Data.VERSION = '0.8.0';

Data.Graph = require('./src/graph');
Data.COWGraph = require('./src/cow_graph');
Data.OperationalGraph = require('./src/chronicle/operational_graph');
Data.PathObject = require('./src/path_object');
Data.COWPathObject = require('./src/cow_path_object');

module.exports = Data;
