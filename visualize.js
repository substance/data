// Convert schema.json files to dot (graphviz' markup language)
//
// Usage:
//
// `node visualize.js schema.json | dot -Tpng -oschema.png`

var fs = require('fs')
,   _  = require('underscore')
,   Data = require('./data');

var schemaFile = process.ARGV[2]
,   schema = JSON.parse(fs.readFileSync(schemaFile, 'utf-8'))
,   graph = new Data.Graph(schema);

console.log(schemaToDot(graph));

function schemaToDot (graph) {
  var result = '';
  function puts (s) { result += s + '\n'; }
  
  function quote (s) { return '"' + s + '"'; }
  
  function getTypeName (type) {
    return (type.name || type._id.replace(/^\/type\//, '')).replace(/[^a-zA-Z0-9]/g, '');
  }
  
  puts('digraph schema {');
  graph.types().each(function (type) {
    var typeName = getTypeName(type);
    type.properties().each(function (property, propertyName) {
      _.each(property.expectedTypes, function (expectedType) {
        if (!/^\/type\//.test(expectedType)) return;
        expectedType = getTypeName(graph.get(expectedType));
        puts(quote(typeName) + ' -> ' + quote(expectedType) + ' [label=' + quote(propertyName) + '];');
      });
    });
  });
  puts('}'); // end digraph
  
  return result;
}
