"use strict";

var _ = require("underscore");
var util = require("substance-util");


// Data.Schema
// ========
//
// Provides a schema inspection API

var Schema = function(schema) {
  _.extend(this, schema);
};

Schema.Prototype = function() {

  // Return Default value for a given type
  // --------
  //

  this.defaultValue = function(valueType) {
    if (valueType === "object") return {};
    if (valueType === "array") return [];
    if (valueType === "string") return "";
    if (valueType === "number") return 0;
    if (valueType === "boolean") return false;
    if (valueType === "date") return new Date();

    return null;
    // throw new Error("Unknown value type: " + valueType);
  };

  // Return type object for a given type id
  // --------
  //

  this.parseValue = function(valueType, value) {
    if (value === null) {
      return value;
    }

    if (_.isString(value)) {
      if (valueType === "object") return JSON.parse(value);
      if (valueType === "array") return JSON.parse(value);
      if (valueType === "string") return value;
      if (valueType === "number") return parseInt(value, 10);
      if (valueType === "boolean") {
        if (value === "true") return true;
        else if (value === "false") return false;
        else throw new Error("Can not parse boolean value from: " + value);
      }
      if (valueType === "date") return new Date(value);

      // all other types must be string compatible ??
      return value;

    } else {
      if (valueType === 'array') {
        if (!_.isArray(value)) {
          throw new Error("Illegal value type: expected array.");
        }
        value = util.deepclone(value);
      }
      else if (valueType === 'string') {
        if (!_.isString(value)) {
          throw new Error("Illegal value type: expected string.");
        }
      }
      else if (valueType === 'object') {
        if (!_.isObject(value)) {
          throw new Error("Illegal value type: expected object.");
        }
        value = util.deepclone(value);
      }
      else if (valueType === 'number') {
        if (!_.isNumber(value)) {
          throw new Error("Illegal value type: expected number.");
        }
      }
      else if (valueType === 'boolean') {
        if (!_.isBoolean(value)) {
          throw new Error("Illegal value type: expected boolean.");
        }
      }
      else if (valueType === 'date') {
        value = new Date(value);
      }
      else {
        throw new Error("Unsupported value type: " + valueType);
      }
      return value;
    }
  };

  // Return type object for a given type id
  // --------
  //

  this.type = function(typeId) {
    return this.types[typeId];
  };

  // For a given type id return the type hierarchy
  // --------
  //
  // => ["base_type", "specific_type"]

  this.typeChain = function(typeId) {
    var type = this.types[typeId];
    if (!type) {
      throw new Error('Type ' + typeId + ' not found in schema');
    }

    var chain = (type.parent) ? this.typeChain(type.parent) : [];
    chain.push(typeId);
    return chain;
  };

  this.isInstanceOf = function(type, parentType) {
    var typeChain = this.typeChain(type);
    if (typeChain && typeChain.indexOf(parentType) >= 0) {
      return true;
    } else {
      return false;
    }
  };

  // Provides the top-most parent type of a given type.
  // --------
  //

  this.baseType = function(typeId) {
    return this.typeChain(typeId)[0];
  };

  // Return all properties for a given type
  // --------
  //

  this.properties = function(type) {
    type = _.isObject(type) ? type : this.type(type);
    var result = (type.parent) ? this.properties(type.parent) : {};
    _.extend(result, type.properties);
    return result;
  };

  // Returns the full type for a given property
  // --------
  //
  // => ["array", "string"]

  this.propertyType = function(type, property) {
    var properties = this.properties(type);
    var propertyType = properties[property];
    if (!propertyType) throw new Error("Property not found for" + type +'.'+property);
    return _.isArray(propertyType) ? propertyType : [propertyType];
  };

  // Returns the base type for a given property
  // --------
  //
  //  ["string"] => "string"
  //  ["array", "string"] => "array"

  this.propertyBaseType = function(type, property) {
    return this.propertyType(type, property)[0];
  };
};

Schema.prototype = new Schema.Prototype();

module.exports = Schema;
