Data.js
=====================

Data.js is a data representation framework for Javascript. It's being developed in the context of Substance, an open publishing platform.

For documentation, usage, and examples, see the offical documentation: http://substance.io/michael/data-js


With Data.js you can:
---------------------

* Model your domain data using a simple graph-based object model that can be serialized to JSON.
* Traverse your graph, including relationships using a simple API.
* Manipulate and query data on the client (browser) or on the server (Node.js) by using exactly the same API.


Features
---------------------

* `Data.Graph` (A data abstraction for all kinds of linked data)
* `Data.Collection` (A simplified interface for tabular data)


Getting Started
---------------------

Define a schema

```js
var schema = {
  "/type/person": {
    "type": "/type/type",
    "name": "Person",
    "properties": {
      "name": {"name": "Name", "type": "string", "required": true},
      "origin": {"name": "Origin", "type": "/type/location" }
    }
  },
  "/type/location": {
    "type": "/type/type",
    "name": "Location",
    "properties": {
      "name": { "name": "Name", "unique": true, "type": "string", "required": true },
      "citizens": {"name": "Citizens", "unique": false, "type": "/type/person"}
    }
  }
};
```

Create a new Data.Graph.

```js
var graph = new Data.Graph(schema);
```

Add some objects.

```js
graph.set({
  _id: "/person/bart",
  type: "/type/person",
  name: "Bart Simpson"
});

graph.set({
  _id: "/location/springfield",
  name: "Springfield",
  type: "/type/location",
  citizens: ["/person/bart"]
});
```

Set properties (including relationships to other objects)

```js
graph.get('/person/bart')
     .set({origin: '/location/springfield'});
```

Access your data.

```js
var citizens = graph.get('/location/springfield').get('citizens');

_.each(citizens, function(person) {
  console.log(person.get('name'));
});
```


In The Wild
------------------

* [Substance](http://substance.io) - A web-based document authoring and publication platform that relies on Data.js for object persistence.
* [Déjàvis](http://beta.dejavis.org) - A tool for analyzing and visualizing data. It uses Data.js for filtering and aggregating data
* [Dance.js](http://github.com/michael/dance) Dance.js - A data-driven visualization library.
