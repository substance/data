// Data.js — A uniform interface to domain data
// -------------


(function() {

  // Helpers
  // -------

  suite('Data.js API', function() {
    var stopwatch, items;

    // Data.Graph
    // -------------

    suite('Data.Graph', function() {
      var graph,
          documentType,
          entitiesProperty,
          protovis,
          unveil,
          processingjs,
          mention,
          stanford,
          newYork,
          anotherMention;

      setup(function() {
        graph = new Data.Graph(documents_fixture);
        protovis = graph.get('/doc/protovis_introduction');
        unveil = graph.get('/doc/unveil_introduction');
        processingjs = graph.get('/doc/processing_js_introduction');
        mention = graph.get('M0000003');
        anotherMention = graph.get('M0000003');
        stanford = graph.get('/location/stanford');
        newYork = graph.get('/location/new_york');
      });


      test("valid construction", function() {
        assert.ok(graph != undefined);
        assert.ok(graph.types.length == 3);

        assert.ok(graph.types[0] instanceof Data.Type);
        assert.ok(graph.types[1] instanceof Data.Type);
        assert.ok(graph.types[2] instanceof Data.Type);
      });


      test("Type inspection", function() {
        documentType = graph.get('/type/document');
        assert.ok(Object.keys(documentType.properties).length === 5);
        assert.ok(documentType._id === '/type/document');
        assert.ok(documentType.name === 'Document');
      });

      
      test("Property inspection", function() {
        documentType = graph.get('/type/document');
        entitiesProperty = documentType.properties.entities;
        assert.ok(entitiesProperty.name === 'Associated Entities');
        assert.ok(_.include(entitiesProperty.type, '/type/entity'));
      });


      test("Object inspection", function() {
        assert.ok(protovis instanceof Data.Object);
        assert.ok(mention instanceof Data.Object);
        assert.ok(anotherMention instanceof Data.Object);
      });


      // There are four different access scenarios:
      // For convenience there's a get method, which always returns the right result depending on the
      // schema information. However, internally, every property of a resource is represented as a
      // non-unique Set of Node objects, even if it's a unique property. So if
      // you want to be explicit you should use the native methods of the Node API.

      test("1. Unique value types", function() {
        assert.ok(protovis.get('page_count') === 8);
        assert.ok(protovis.get('title') === 'Protovis');
      });


      test("2. Non-Unique value types", function() {
        assert.ok(protovis.get('authors').length === 2);
        assert.ok(protovis.get('authors')[0] === 'Michael Bostock');
        assert.ok(protovis.get('authors')[1] === 'Jeffrey Heer');
      });


      test("3. Unique object types (one resource)", function() {
        assert.ok(mention.get('entity')._id === '/location/new_york');
      });


      test("4. Non-unique object types (many resources)", function() {
        assert.ok(protovis.get('entities').length === 2);        
        assert.ok(protovis.get('entities')[0]._id === '/location/stanford');
        assert.ok(protovis.get('entities')[1]._id === '/location/new_york');
      });

      test("References to the same resource should result in object equality", function() {
        assert.ok(mention.get('entity') === anotherMention.get('entity'));
      });


      test("Graph traversal (navigation)", function() {
        // Hop from a document to the second entity, picking the 2nd mention and go
        // to the associated document of this mention.
        assert.ok(protovis.get('entities')[1] // => Entity#/location/new_york
                .get('mentions')[1]    // => Mention#M0000003
                .get('document')       // => /doc/processing_js_introduction
                ._id === '/doc/processing_js_introduction');
      });


      // Data.Object Manipulation

      // Set new nodes on the graph
      test("Set new nodes on the graph", function() {
        var substance = graph.set({
          "_id": "/document/substance",
          "type": "/type/document",
          "title": "Substance Introduction",
          "authors": ["Michael Aufreiter"],
          "page_count": 12,
          "entities": ["/location/stanford", "/location/new_york"]
        });
        
        assert.ok(substance.get('title') === 'Substance Introduction');
        assert.ok(substance.get('page_count') === 12);
        
        // Allow null being passed explicitly for an object type property
        var mention = graph.set({
          "type": "/type/mention",
          "document": null,
          "entity": "/location/stanford",
          "page": 5
        });
        assert.ok(!mention.get('document'));
      });


      test("Set value properties of existing nodes", function() {
        // Value properties
        protovis.set({
          'title': 'Protovis Introduction',
          'page_count': 20
        });
        
        protovis.set({
          'page_count': 20
        });

        assert.ok(protovis.get('title') === 'Protovis Introduction');
        assert.ok(protovis.get('page_count') === 20);
      });


      test("Set value type objects", function() {
        protovis.set({
          info: {"foo": "bar"}
        });
        assert.ok(protovis.get('info').foo === "bar");
        protovis.set({
          info: {"bar": "baz"}
        });
        assert.ok(protovis.get('info').bar === "baz");
      });

      test("Set object properties of existing nodes", function() {
        assert.ok(_.first(protovis.get('entities')).get('name') === 'Stanford');
        assert.ok(_.last(protovis.get('entities')).get('name') === 'New York');

        protovis.set({
          entities: ['/location/toronto'],
          authors: 'Michael Aufreiter'
        });
        assert.ok(_.first(protovis.get('entities')) === graph.get('/location/toronto'));
      });

      test("Find objects", function() {
        // By type
        var documents = graph.find({"type": "/type/document"});

        assert.ok(documents.length === 3);

        // By authors
        documents = graph.find({
          "type": "/type/document",
          "authors": "Michael Aufreiter"
        });
        assert.ok(documents.length === 2);
      });
    });

    suite('Data.Collection', function() {
      var c;

      setup(function() {
        c = new Data.Collection(countries_fixture);
      });

      test("valid construction", function() {
        assert.ok(c != undefined);
        assert.ok(c.type instanceof Data.Type);
      });

      test("each", function() {
        var count = 0;
        c.each(function(obj, key, index) {
          assert.ok(count === index);
          count ++;
        });
        assert.ok(count === c.length);
      });

      test("at", function() {
        assert.ok(c.at(6)._id === 'ca');
      });

      test("get", function() {
        assert.ok(c.get('at')._id === 'at');
      });

      test("index", function() {
        assert.ok(c.index('at') === 0);
      });

      test("key", function() {
        assert.ok(c.key(0) === "at");
      });

      test("find objects", function() {
        assert.ok(c != undefined);
        assert.ok(c.type instanceof Data.Type);

        var countries = c.find({"name": "Austria"});
        assert.ok(countries.length === 1);
      });
    });

  });
}).call(this);