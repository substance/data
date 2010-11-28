Data.js
==================

Data.js is a data abstraction and manipulation framework for JavaScript. It has
been extracted from [Unveil.js](http://github.com/michael/unveil),
in order to make it available as a separate library that can be used in the
browser or within CommonJS environments.

I took some inspiration from various existing data manipulation libraries such
as the Google Visualization API or [Underscore.js](http://documentcloud.github.com/underscore/). I updated the API so most of 
the methods conform to the API of Underscore.js. Actually, Data.js is meant to 
be used as an extension to Underscore.js, on which it depends on.

Until a dedicated documentation is available, please have a look at the [annotated source code](http://quasipartikel.at/data.js).


Features
------------------

* Data.Set (A sortable Set data-structure)
* Data.Node (A JavaScript Node implementation that introduces properties that can be used to create Multipartite Graphs)
* Data.Graph (A data abstraction for all kinds of linked data)
* Data.Collection (A simplified interface for tabular data that uses a Data.Graph internally)


Data.Graph
------------------

A `Data.Graph` can be used for representing arbitrary complex object graphs. 
Relations between objects are expressed through links that point to referred objects.
Data.Graphs can be traversed in various ways. See the testsuite for usage. 
They're meant to be used read-only in a functional style.

In future we'll introduce `Data.Transformers` that allow you specify individual computations
to generate a new graph based on an existing input graph.


**Based on the Metaweb Object model**

The Data.Graph format is highly inspired by the [Metaweb Object Model](http://www.freebase.com/docs/mql/ch02.html) that is used at Freebase.com. So if you're familiar with Freebase and MQL, you should have already gotten the basic idea. However, there's one important difference: In Data.js a Data.Object can only be member of one single type. It assumes a type property (which isn't a regular property) that points to the id of the corresponding type node. By contrast in Freebase an object (resource) can be a member of multiple types. Thus, in Freebase the type property is a member of the `/type/object` type and is seen as a regular property. For simplicity, in Data.js, we simply use the type property to depict the object's one-and-only (unique) type.


Data.Graphs are exchanged through a uniform JSON Serialization Format:

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


**Usage:**

    var graph,
        documentType,
        entitiesProperty,
        protovis,
        unveil,
        processingjs,
        mention,
        anotherMention;
    
    module("Data.Graph", {
      setup: function() {
        graph = new Data.Graph(documents_fixture);
      },
      teardown: function() {
        delete graph;
      }
    });

    test("valid construction", function() {
      ok(graph != undefined);
      ok(graph.all('types').length == 3);
  
      ok(graph.get('types', '/type/document') instanceof Data.Type);
      ok(graph.get('types', '/type/entity') instanceof Data.Type);
      ok(graph.get('types', '/type/mention') instanceof Data.Type);
    });


    test("Type inspection", function() {
      documentType = graph.get('types', '/type/document');
      ok(documentType.all('properties').length === 4);
      ok(documentType.key === '/type/document');
      ok(documentType.name === 'Document');
    });


    test("Property inspection", function() {
      entitiesProperty = documentType.get('properties', 'entities');
      ok(entitiesProperty.name === 'Associated Entities');
      ok(entitiesProperty.expected_type === '/type/entity');
    });

    test("Object inspection", function() {
      protovis = graph.get('objects', '/doc/protovis_introduction');
      unveil = graph.get('objects', '/doc/unveil_introduction');
      processingjs = graph.get('objects', '/doc/processing_js_introduction');
      mention = graph.get('objects', 'M0000003');
      anotherMention = graph.get('objects', 'M0000003');
  
      ok(protovis instanceof Data.Object);
      ok(mention instanceof Data.Object);
      ok(anotherMention instanceof Data.Object);
    });


    // There are four different access scenarios:
    // For convenience there's a get method, which always returns the right result depending on the
    // schema information. However, internally, every property of a resource is represented as a
    // non-unique Set of Node objects, even if it's a unique property. So if
    // you want to be explicit you should use the native methods of the Node API.

    test("1. Unique value types", function() {
      ok(protovis.get('page_count') === 8);
      ok(protovis.get('title') === 'Protovis');
  
      // internally delegates to
      ok(protovis.get('page_count') === 8);
    });


    test("2. Non-Unique value types", function() {
      ok(protovis.get('authors').length === 2);
      ok(protovis.get('authors').at(0) === 'Michael Bostock');
      ok(protovis.get('authors').at(1) === 'Jeffrey Heer');
  
      // internally delegates to
      ok(protovis.values('authors').length === 2);
    });

    test("3. Unique object types (one resource)", function() {
      ok(mention.get('entity').key === '/location/new_york');

      // internally delegates to
      ok(mention.first('entity').key === '/location/new_york');
    });

    test("4. Non-unique object types (many resources)", function() {
      ok(protovis.get('entities').length === 2);
      ok(protovis.get('entities').at(0).key === '/location/stanford');
      ok(protovis.get('entities').at(1).key === '/location/new_york');

      // internally delegates to
      ok(protovis.all('entities').length === 2);
    });

    test("References to the same resource should result in object equality", function() {
      ok(mention.first('entity') === anotherMention.first('entity'));
    });


    test("Graph traversal (navigation)", function() {
      // Hop from a document to the second entity, picking the 2nd mention and go
      // to the associated document of this mention.
      ok(protovis.get('entities').at(1) // => Entity#/location/new_york
              .get('mentions').at(1)    // => Mention#M0000003
              .get('document')          // => /doc/processing_js_introduction
              .key === '/doc/processing_js_introduction');
    });


    test("Querying information", function() {
      var cities = graph.all('objects').select(function(res, key) {
        return /or/.test(res.get('name'))
      });
    
      ok(cities.length === 3);
      ok(cities.get('/location/new_york'));
      ok(cities.get('/location/toronto'));
      ok(cities.get('/location/stanford'));
    });


    test("Value identity", function() {
      // If the values of a property are shared among resources they should have
      // the same identity as well.
      ok(unveil.all('authors').at(0) === processingjs.all('authors').at(2));
      ok(unveil.get('authors').at(0) === 'Michael Aufreiter');
      ok(processingjs.get('authors').at(2) === 'Michael Aufreiter');
  
      // This allows questions like:
      // Show all unique values of a certain property e.g. /type/document.authors
      ok(protovis.type.get('properties', 'authors').all('values').length === 6);
    });
    

Data.Collection
-----------------

A Collection is a simple data abstraction format where a data-set under investigation conforms to a collection of data items that describes all facets of the underlying data in a simple and universal way. You can think of a Collection as a table of data, except it provides precise information about the data contained (meta-data). A Data.Collection just wraps a `Data.Graph` internally, in order to simplify the interface, for cases where you do not have to deal with linked data.


The simplified JSON Serialization Format looks like so:

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


**Usage**

    var c = new Data.Collection(countries_fixture);

    test("has some properties", function() {
      ok(c.get('properties', 'area') instanceof Data.Node);
      ok(c.get('properties', 'currency_used') instanceof Data.Node);
      ok(c.get('properties', 'doesnotexit') === undefined);
    });

    test("property is connected to values", function() {
      var governmentForms = c.get('properties', 'form_of_government');
      ok(governmentForms.all('values').length === 10);
    });

    test("read item property values", function() {
      var item = c.get('items', 'austria');
      // Unique properties
      ok(item.get('name') === 'Austria');
      ok(item.get('area') === 83872);
      // Non-unique properties
      ok(item.get('form_of_government').length === 2);
    });

    test("get values of a property", function() {
      var population = c.get('properties', 'population');
      ok(population.all('values').length === 6);
    });

    // useful for non-unique properties
    test("get value of a property", function() {
      var population = c.get('properties', 'population');
      ok(population.value('values') === 8356700);
    });
    


Data.Aggregators
------------------

**Usage**

    test("Aggregators", function() {
      var values = new Data.Set();
      values.set('0', 4);
      values.set('1', 5);
      values.set('2', -3);
      values.set('3', 1);

      ok(Data.Aggregators.SUM(values) === 7);
      ok(Data.Aggregators.MIN(values) === -3);
      ok(Data.Aggregators.MAX(values) === 5);
      ok(Data.Aggregators.COUNT(values) === 4);
    });


    test("allow aggregation of property values", function() {
      var population = c.get("properties", "population");
      ok(population.aggregate(Data.Aggregators.MIN) === 8356700);
      ok(population.aggregate(Data.Aggregators.MAX) === 306108000);
    });
