"use strict";

var Data = {};

// Current version of the library. Keep in sync with `package.json`.
Data.VERSION = '0.8.0';

Data.Graph = require('./src/graph');
Data.COWGraph = require('./src/cow_graph');
Data.OperationalGraph = require('./src/chronicle/operational_graph');

module.exports = Data;
