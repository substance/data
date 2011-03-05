/*global Buffer */

var Http = require('http'),
    Url = require('url'),
    EventEmitter = require('events').EventEmitter,
    querystring = require('querystring');


var POOL_SIZE = 200; // Maximum number of concurrent connections allowed.
var MAX_DOCS = 1000; // The maximum number of docs to send in a single batch

// Handles changes made in node v0.3.0
var NOT_FOUND_ERR_NO = process.ENOENT ? process.ENOENT : require('constants').ENOENT;

function noOp(err) { if (err) { throw err; } }

var pool = new Array(POOL_SIZE);
var poolIndex = 0;
function getServerFromPool(uri, callback) {
  try {
    poolIndex = (poolIndex + 1) % POOL_SIZE;
    if (!pool[poolIndex]) {
      pool[poolIndex] = Http.createClient(uri.port, uri.hostname);
    }
    process.nextTick(function () {
      callback(null, pool[poolIndex]);
    });
  } catch (err) {
    process.nextTick(function () {
      callback(err);
    });
  }
}

var CONNECTION_DEFAULTS = {
  host: '127.0.0.1:5984',
  port: 5984,
  hostname: '127.0.0.1',
  pathname: "/"
};



function CouchClient(url) {
  var uri = Url.parse(url);
  uri.__proto__ = CONNECTION_DEFAULTS;
  var revCache = {};

  // A simple wrapper around node's http client.
  function request(method, path, body, callback) {
    var stream;
    // Body is optional
    if (typeof body === 'function' && typeof callback === 'undefined') {
      callback = body;
      body = undefined;
    }
    // Return a stream if no callback is specified
    if (!callback) {
      stream = new EventEmitter();
      stream.setEncoding = function () {
        throw new Error("This stream is always utf8");
      };
    }

    function errorHandler(err) {
      if (callback) { callback(err); }
      if (stream) { stream.emit('error', err); }
    }

    var headers = {
      "Host": uri.host
    };
    if (body) {
      body = JSON.stringify(body);
      headers["Content-Length"] = Buffer.byteLength(body);
      headers["Content-Type"] = "application/json";
    }
    getServerFromPool(uri, function (err, server) {
      var request = server.request(method, path, headers);
      if (body) {
        request.write(body, 'utf8');
      }
      request.end();

      request.on('response', function (response) {
        response.setEncoding('utf8');
        var body = "";
        response.on('data', function (chunk) {
          if (callback) { body += chunk; }
          if (stream) { stream.emit('data', chunk); }
        });
        response.on('end', function () {
          if (callback) { callback(null, JSON.parse(body)); }
          if (stream) { stream.emit('end'); }
        });
        response.on('error', errorHandler);
      });
      request.on('error', errorHandler);
    });

    return stream;
  }

  // Requests UUIDs from the couch server in tick batches
  var uuidQueue = [];
  function getUUID(callback) {
    uuidQueue.push(callback);
    if (uuidQueue.length > 1) { return; }
    function consumeQueue() {
      var pending = uuidQueue.splice(0, MAX_DOCS);
      if (uuidQueue.length) { process.nextTick(consumeQueue); }
      // console.log("Bulk getting UUIDs %s", pending.length);
      request("GET", "/_uuids?count=" + pending.length, function (err, result) {
        if (err) {
          pending.forEach(function (callback) {
            callback(err);
          });
          return;
        }
        if (result.uuids.length !== pending.length) {
          throw new Error("Wrong number of UUIDs generated " + result.uuids.length + " != " + pending.length);
        }
        result.uuids.forEach(function (uuid, i) {
          pending[i](null, uuid);
        });
      });
    }
    process.nextTick(consumeQueue);
  }

  // Saves documents in batches
  var saveValues = [];
  var saveQueue = [];
  function realSave(doc, callback) {
    // Put key and rev on the value without changing the original
    saveValues.push(doc);
    saveQueue.push(callback);
    if (saveQueue.length > 1) { return; }
    function consumeQueue() {
      var pending = saveQueue.splice(0, MAX_DOCS);
      var body = saveValues.splice(0, MAX_DOCS);
      if (saveQueue.length) { process.nextTick(consumeQueue); }
      // console.log("Bulk saving %s", body.length);
      request("POST", uri.pathname + "/_bulk_docs", {docs: body}, function (err, results) {
        if (results.error) {
          err = new Error("CouchDB Error: " + JSON.stringify(results));
          if (results.error === 'not_found') { err.errno = NOT_FOUND_ERR_NO; }
        }
        if (err) {
          pending.forEach(function (callback) {
            callback(err);
          });
          return;
        }
        results.forEach(function (result, i) {
          var doc = body[i];
          doc._id = result.id;
          doc._rev = result.rev;
          revCache[result.id] = result.rev;
          pending[i](null, doc);
        });
      });
    }
    process.nextTick(consumeQueue);
  }

  var getQueue = [];
  var getKeys = [];
  function realGet(key, includeDoc, callback) {
    getKeys.push(key);
    getQueue.push(callback);
    if (getQueue.length > 1) { return; }
    function consumeQueue() {
      var pending = getQueue.splice(0, MAX_DOCS);
      var keys = getKeys.splice(0, MAX_DOCS);
      if (getQueue.length) { process.nextTick(consumeQueue); }
      var path = uri.pathname + "/_all_docs";
      if (includeDoc) { path += "?include_docs=true"; }
      // console.log("Bulk Getting %s documents", keys.length);
      request("POST", path, {keys: keys}, function (err, results) {
        if (!results.rows) {
          err = new Error("CouchDB Error: " + JSON.stringify(results));
        }
        if (err) {
          pending.forEach(function (callback) {
            callback(err);
          });
          return;
        }
        results.rows.forEach(function (result, i) {
          var err;
          if (includeDoc) {
            if (result.error) {
              err = new Error("CouchDB Error: " + JSON.stringify(result));
              if (result.error === 'not_found') { err.errno = NOT_FOUND_ERR_NO; }
              pending[i](err);
              return;
            }
            if (!result.doc) {
              err = new Error("Document not found for " + JSON.stringify(result.key));
              err.errno = NOT_FOUND_ERR_NO;
              pending[i](err);
              return;
            }
            pending[i](null, result.doc);
            return;
          }
          pending[i](null, result.value);
        });
      });
    }
    process.nextTick(consumeQueue);
  }


  function save(doc, callback) {
    if (!callback) { callback = noOp; }
    if (doc._id) {
      if (!doc._rev) {
        if (!revCache.hasOwnProperty(doc._id)) {
          realGet(doc._id, false, function (err, result) {
            if (err) { return callback(err); }
            if (result) {
              revCache[doc._id] = result.rev;
              doc._rev = result.rev;
            }
            realSave(doc, callback);
          });
          return;
        }
        doc._rev = revCache[doc._id];
      }
    }
    realSave(doc, callback);
  }

  function get(key, callback) {
    realGet(key, true, callback);
  }

  function remove(doc, callback) {
    if (typeof doc === 'string') {
      doc = {_id: doc};
    }
    doc._deleted = true;
    save(doc, callback);
  }

  function changes(since, callback) {
    var stream = request("GET", uri.pathname + "/_changes?feed=continuous&heartbeat=1000&since=" + since);
    var data = "";
    function checkData() {
      var p = data.indexOf("\n");
      if (p >= 0) {
        var line = data.substr(0, p).trim();
        data = data.substr(p + 1);
        if (line.length) {
          callback(null, JSON.parse(line));
        }
        checkData();
      }
    }
    stream.on('error', callback);
    stream.on('data', function (chunk) {
      data += chunk;
      checkData();
    });
    stream.on('end', function () {
      throw new Error("Changes feed got broken!");
    });
  }
  
  function view(viewName, obj, callback) {
    if (typeof obj === 'function') {
      callback = obj;
      obj = null;
    }
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(function(key){
        obj[key] = JSON.stringify(obj[key]);
      });
      var getParams = querystring.stringify(obj);
      if (getParams){
        viewName = viewName + '?' + getParams;
      }
    }
    request("GET", viewName, callback);
  }

  // Expose the public API
  return {
    get: get,
    save: save,
    remove: remove,
    changes: changes,
    request: request,
    uri: uri,
    view: view
  };
}

module.exports = CouchClient;