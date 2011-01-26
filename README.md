Data.js
==================

Data.js is a data manipulation and persistence framework for JavaScript. It has
been extracted from [Unveil.js](http://github.com/michael/unveil), and is now being developed in the context of [Substance](http://github.com/michael/substance), a data-driven, real-time document authoring engine.

I took some inspiration from various existing data manipulation libraries such
as the [Google Visualization API](http://code.google.com/apis/visualization/documentation/reference.html) or [Underscore.js](http://documentcloud.github.com/underscore/). Data.js is meant to be used as an extension to Underscore.js, on which it depends on.  It can be used in the browser and within CommonJS environments. 

Until a dedicated documentation is available, please have a look at the [annotated source code](http://quasipartikel.at/data.js).


Features
------------------

**New in Data.js 0.2.0**

* Persistence Layer for Data.Graph's
* Data.Adapter (An interface for connecting data-stores)
* [Data.CouchAdapter](https://github.com/michael/data/blob/master/adapters/couch_adapter.js) (CouchDB Graph Persistence)


**Data.js 0.1.0**

* Data.Hash (A sortable Hash data-structure)
* Data.Node (A JavaScript Node implementation that introduces properties that can be used to create Multipartite Graphs)
* Data.Graph (A data abstraction for all kinds of linked data)
* Data.Collection (A simplified interface for tabular data that uses a Data.Graph internally)


The all new Data.Graph Persistence API that will ship with Data.js 0.2.0
------------------

Data.js 0.2.0 comes with a Data.Adapter for CouchDB, so this will be our first graph data-store.

Graph Persistence is easy and fun. Let's have a look at the API:

**First, we describe our domain model, which will serve as our type system**

    var schema = {
  
      // Person
      // --------------------
  
      "/type/person": {
        "type": "type",
        "name": "Person",
        "properties": {
          "name": {
            "name": "Name",
            "unique": true,
            "expected_type": "string"
          },
          "origin": {
            "name": "Page Count",
            "unique": true,
            "expected_type": "/type/location"
          }
        }
      },
  
      // Location
      // --------------------
  
      "/type/location": {
        "type": "type",
        "name": "Location",
        "properties": {
          "name": {
            "name": "Name",
            "unique": true,
            "expected_type": "string"
          },
          "citizens": {
            "name": "Citizens",
            "unique": false,
            "expected_type": "/type/person"
          }
        }
      }
    };

**Now lets store our domain model in Couch:**

    Data.setAdapter('couch', { url: 'http://localhost:5984/simpsons' });

    var graph = new Data.Graph(schema);
    graph.sync(); // Stores the Data.Graph in Couch, asynchronously
    

**Let's add a Person object:**

    graph.set('/person/bart', {
      name: "Bart Simpson"
    });

Because of prefixing the type to every object_id we can derive the type property automatically.

**We could sync with the DB now, but we wait until we've added more objects:**

    graph.set('/location/springfield', {
      name: "Springfield",
      citizens: ["/person/bart"]
    });

**Now Springfield is aware of bart as a citizen, but Bart doesn't have an origin yet:**

    graph.get('/person/bart')
      .set({origin: "/location/springfield"});


**Well, now Homer wants to join the fun:**

    graph.set('/person/homer', {
      name: "Homer Simpson",
      origin: "/location/springfield",
    });

**Mayor, there's a new citizen:**

    graph.get('/location/springfield').set({
      citizens: ["/person/bart", "/person/homer"]
    });


**Okay, now suppose Mayor Quimby wants to display a list of inhabitants — Luckily he's got some basic Javascript skills:**

We start with an empty graph, supposing that we've set up the Data.Adapter already.

    var graph = new Data.Graph();
    
    graph.get('/location/springfield').get('citizens').each(function(person) {
      console.log(person.get('name'));
    });

The Data.Graph will start fetching nodes from the database on demand. So what we get here's is an infinitely huge object space we can traverse step by step, and on demand. However, the chain-able asynchronous API for Data.Graph#get isn't available yet. We need to use asynchronous method queues in order to make this work.

For the moment you have to use the asynchronous Data.Graph#fetch method, that receives a callback when the data has arrived.

    graph.fetch({'_id': '/location/springfield'}, {expand: true}, function(err, res) {
      // Even more Springfielders
      graph.get('/location/springfield').get('citizens').get('/person/mr_burns');
    });

**Finally, we store the graph by simply calling `Data.Graph#sync`:**

    graph.syncfunction(err) {
      console.log('The Graph has been stored on the server');
    });


**Some background:**

Eventually, this whole thing is all about creating applications with a dynamic type system. You can at any time adjust your types by adding or removing properties.

While the Graph Persistence API is under development, please have a look at the [Tests](https://github.com/michael/data/blob/master/test/persistence.js), that reflect the API that has been yet implemented.

The first target is CouchDB to allow Graph Persistence with Node.js. But there will also be adapters for Ajax and Websockets, that allow to use exactly the same API from within the browser. Having a Data.Graph in the browser that is able to fetch additional nodes on demand is a great thing. The browser can keep a growing number of nodes in memory, which allows to build responsive interfaces. User input can be stored within Data.Graph nodes and at some point the whole graph (all dirty nodes) can be saved in one go. And best of all, you'll never have to deal with models again, since all schema information (type nodes) is stored in the graph as well.


Data.Graph
------------------

A `Data.Graph` can be used for representing arbitrary complex object graphs. 
Relations between objects are expressed through links that point to referred objects.
Data.Graphs can be traversed in various ways. See the testsuite for usage. 

In future we'll introduce `Data.Transformers` that allow you specify individual computations
to generate a new graph based on an existing input graph.


**Based on the Metaweb Object model**

The Data.Graph format is highly inspired by the [Metaweb Object Model](http://www.freebase.com/docs/mql/ch02.html) that is used at Freebase.com. So if you're familiar with Freebase and MQL, you should have already gotten the basic idea. However, there's one important difference: In Data.js a Data.Object can only be member of one single type. It assumes a type property (which isn't a regular property) that points to the id of the corresponding type node. By contrast in Freebase an object (resource) can be a member of multiple types. Thus, in Freebase the type property is a member of the `/type/object` type and is seen as a regular property. For simplicity, in Data.js, we simply use the type property to depict the object's one-and-only (unique) type.


**Why not RDF?**

Actually, I was considering building this framework on top of an existing RDF-based serialization format. However I ended up with introducing my own JSON based format for various reasons:

* Every single Javascript developer prefers JSON ;-)

* RDF is designed to work in a global distributed scenario, involving in a more verbose syntax. A `Data.Graph` operates in a local scenario, and therefore allows for a tighter syntax.

* From my experience, proprietary formats are perfectly valid as long as mapping data back and forth is easy. Since RDF and `Data.Graph` are both modeling a graph, translation should be easy enough.

* Ontologies are important for the Semantic Web, but for the task of client-side data-processing they are most often irrelevant.

However in future RDF support (for construction and serialization) may be added to the library. Until then, a scenario involving RDF could look like so:

1. Fetch data from a SPARQL endpoint
1. Translate the result to the Data.Graph format
1. Do data processing using Data.js
1. Display the results on the fly (e.g. using a visualization for encoding the results)


**Data.Graphs are exchanged through a uniform JSON Serialization Format:**

    {
      "/type/document": {
        "type": "type",
        "name": "Document",
        "properties": {
          "title": {
            "name": "Document Title",
            "unique": true,
            "expected_type": "string"
          },
          "entities": {
            "name": "Associated Entities",
            "unique": false,
            "expected_type": "/type/entity"
          },
          "page_count": {
            "name": "Page Count",
            "unique": true,
            "expected_type": "number"
          },
          "authors": {
            "name": "Authors",
            "unique": false,
            "expected_type": "string"
          }
        }
      },
      "/type/entity": {
        "type": "type",
        "name": "Entity",
        "properties": {
          "name": {
            "name": "Entity Name",
            "unique": true,
            "expected_type": "string"
          },
          "mentions": {
            "name": "Mentions",
            "unique": false,
            "expected_type": "/type/mention"
          }
        }
      },
      "/type/mention": {
        "name": "Mention",
        "type": "type",
        "properties": {
          "document": {
            "name": "Document",
            "unique": true,
            "expected_type": "/type/document"
          },
          "entity": {
            "name": "Entity",
            "unique": true,
            "expected_type": "/type/entity"
          },
          "page": {
            "name": "Occured on page",
            "unique": true,
            "expected_type": "number"
          }
        }
      },
      "/doc/protovis_introduction": {
        "type": "/type/document",
        "title": "Protovis",
        "authors": ["Michael Bostock", "Jeffrey Heer"],
        "page_count": 8,
        "entities": ["/location/stanford", "/location/new_york"]
      },
      "/doc/unveil_introduction": {
        "type": "/type/document",
        "title": "Unveil.js",
        "authors": ["Michael Aufreiter", "Lindsay Kay"],
        "page_count": 8,
        "entities": []
      },
      "/doc/processing_js_introduction": {
        "type": "/type/document",
        "title": "Processing.js",
        "authors": ["Alistair MacDonald", "David Humphrey", "Michael Aufreiter"],
        "page_count": 20
      },
      "/location/stanford": {
        "type": "/type/entity",
        "name": "Stanford",
        "mentions": ["M0000001"]
      },
      "/location/new_york": {
        "type": "/type/entity",
        "name": "New York",
        "mentions": ["M0000002", "M0000003"]
      },
      "/location/toronto": {
        "type": "/type/entity",
        "name": "Toronto",
        "mentions": ["M0000004"]
      },
      "/person/michael_bostock": {
        "type": "/type/entity",
        "name": "Michael Bostock",
        "mentions": ["M0000005"]
      },
      "M0000001": {
        "type": "/type/mention",
        "document": "/doc/protovis_introduction",
        "entity": "/location/stanford",
        "page": 2
      },
      "M0000002": {
        "type": "/type/mention",
        "document": "/doc/protovis_introduction",
        "entity": "/location/new_york",
        "page": 8
      },
      "M0000003": {
        "type": "/type/mention",
        "document": "/doc/processing_js_introduction",
        "entity": "/location/new_york",
        "page": 5
      },
      "M0000004": {
        "type": "/type/mention",
        "document": "/doc/processing_js_introduction",
        "entity": "/location/toronto",
        "page": 2
      },
      "M0000005": {
        "type": "/type/mention",
        "document": "/doc/protovis_introduction",
        "entity": "/person/michael_bostock",
        "page": 1
      }
    }


For Usage please have a look at the [Testsuite](https://github.com/michael/data/blob/master/test/testsuite.js)
  


Data.Collection
-----------------

A Collection is a simple data abstraction format where a data-set under investigation conforms to a collection of data items that describes all facets of the underlying data in a simple and universal way. You can think of a Collection as a table of data, except it provides precise information about the data contained (meta-data). A Data.Collection just wraps a `Data.Graph` internally, in order to simplify the interface, for cases where you do not have to deal with linked data.


**A Data.Collection specification looks like so:**

    {
      "properties": {
        "name": {
          "name": "Country Name",
          "expected_type": "string",
          "unique": true
        },
        "form_of_government": {
          "name": "Form of governmennt",
          "expected_type": "string",
          "unique": false
        },
        "population": {
          "name": "Population",
          "expected_type": "number",
          "unique": true
        }
      },
      "items": {
        "austria": {
          "name": "Austria",
          "official_language": "Croatian language",
          "form_of_government": [
            "Federal republic",
            "Parliamentary republic"
          ],
          "currency_used": "Euro",
          "population": 8356700,
          "gdp_nominal": 432400000000.0,
          "area": 83872.0,
          "date_founded": "1955-07-27"
        },
        "ger": {
          "name": "Germany",
          "official_language": "German Language",
          "form_of_government": [
            "Federal republic",
            "Democracy",
            "Parliamentary republic"
          ],
          "currency_used": "Euro",
          "population": 82062200,
          "gdp_nominal": 3818000000000.0,
          "area": 357092.9,
          "date_founded": "1949-05-23"
        },
      }
    }

For Usage please have a look at the [Testsuite](https://github.com/michael/data/blob/master/test/testsuite.js)


Data.Aggregators
------------------

**Usage**

    var values = new Data.Hash();
    values.set('0', 4);
    values.set('1', 5);
    values.set('2', -3);
    values.set('3', 1);

    ok(Data.Aggregators.SUM(values) === 7);
    ok(Data.Aggregators.MIN(values) === -3);
    ok(Data.Aggregators.MAX(values) === 5);
    ok(Data.Aggregators.COUNT(values) === 4);


    var population = c.get("properties", "population");
    ok(population.aggregate(Data.Aggregators.MIN) === 8356700);
    ok(population.aggregate(Data.Aggregators.MAX) === 306108000);


Installation
-----------------

**Browser**

Download the latest [tarball](https://github.com/michael/data/tarball/master) or pick a specific release. Don't forget to include a recent version of Underscore.js.

**Node.js**


npm:

    npm install data
    
usage:
    
    var Data = require('data');
    var items = new Data.Hash({a: 123, b: 34, x: 53});
    ...
