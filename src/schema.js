"use strict";

var _ = require("underscore");
var util = require("substance-util");

// Data.Schema
// ========
//
// Provides a schema inspection API

var Schema = function(schema) {
  _.extend(this, schema);

  this._typeChains = {};
  this._properties = {};

  _.each(schema.types, function(type, name) {
    this.getTypeChain(name);
    this.getProperties(name);
  }, this);
};

Schema.Prototype = function() {

  // Return Default value for a given type
  // --------
  //

  this.getDefaultValue = function(valueType) {
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

  this.ensureType = function(valueType, value) {
    if (value === null) {
      return value;
    }
    if (_.isString(value)) {
      if (valueType === "object") return JSON.parse(value);
      if (valueType === "array") return JSON.parse(value);
      if (valueType === "string") return value;
      if (valueType === "number") return new Number(value);
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
      }
      else if (valueType === 'object') {
        if (!_.isObject(value)) {
          throw new Error("Illegal value type: expected object.");
        }
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
        if (!_.isDate(value)) {
          throw new Error("Illegal value type: expected date.");
        }
      }
      return value;
    }
  };

  // Return type object for a given type id
  // --------
  //

  this.getType = function(typeId) {
    return this.types[typeId];
  };

  // For a given type id return the type hierarchy
  // --------
  //
  // => ["base_type", "specific_type"]

  this.getTypeChain = function(typeId) {
    if (!this.types[typeId]) {
      throw new Error("Unknonw type: " + typeId);
    }
    if (!this._typeChains[typeId]) {
      var typeChain = [typeId];
      var type = this.types[typeId];
      while (type.parent) {
        typeChain.push(type.parent);
        type = type.parent;
      }
      this._typeChains[typeId] = typeChain;
    }
    return this._typeChains[typeId];
  };

  this.isInstanceOf = function(type, parentType) {
    return (this.getTypeChain(type).indexOf(parentType) > 0);
  };

  // Provides the top-most parent type of a given type.
  // --------
  //

  this.getBaseType = function(typeId) {
    var typeChain = this.getTypeChain(typeId)[0];
    return _.last(typeChain);
  };

  // Return all properties for a given type
  // --------
  //

  this.getProperties = function(typeId) {
    if (!this.types[typeId]) {
      throw new Error("Unknown type: " + typeId);
    }
    if (!this._properties[typeId]) {
      var typeChain = this.getTypeChain(typeId);
      var properties = {};
      _.each(typeChain, function(typeId) {
        _.extend(properties, this.types[typeId].properties);
      }, this);
      this._properties[typeId] = properties;
    }
    return this._properties[typeId];
  };

  // Returns the full type for a given property
  // --------
  //
  // => ["array", "string"]

  this.getPropertyType = function(type, property) {
    var properties = this.getProperties(type);
    var propertyType = properties[property];
    if (!propertyType) throw new Error("Property not found for" + type +'.'+property);
    return propertyType;
  };

  // Returns the base type for a given property
  // --------
  //
  //  ["string"] => "string"
  //  ["array", "string"] => "array"

  this.getPropertyBaseType = function(type, property) {
    var propertyType = this.getPropertyType(type, property);
    return _.isArray(propertyType) ? propertyType[0] : propertyType;
  };
};

Schema.prototype = new Schema.Prototype();

module.exports = Schema;
