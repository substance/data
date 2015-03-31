"use strict";

var Substance = require('substance');

var Data = require('./index');
var VersionedData = require('./src/versioned-data');
Substance.extend(VersionedData, Data);

module.exports = VersionedData;
