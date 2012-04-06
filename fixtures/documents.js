var documents_fixture = {
  "/type/document": {
    "type": "/type/type",
    "name": "Document",
    "properties": {
      "title": {
        "name": "Document Title",
        "unique": true,
        "type": "string"
      },
      "entities": {
        "name": "Associated Entities",
        "unique": false,
        "type": "/type/entity"
      },
      "page_count": {
        "name": "Page Count",
        "unique": true,
        "type": "number"
      },
      "authors": {
        "name": "Authors",
        "unique": false,
        "type": "string"
      },
      "info": {
        "name": "Info",
        "unique": true,
        "type": "object"
      }
    },
    "indexes": {
      "by_authors": ["authors"]
    }
  },
  "/type/entity": {
    "type": "/type/type",
    "name": "Entity",
    "properties": {
      "name": {
        "name": "Entity Name",
        "unique": true,
        "type": "string"
      },
      "mentions": {
        "name": "Mentions",
        "unique": false,
        "type": "/type/mention"
      }
    }
  },
  "/type/mention": {
    "name": "Mention",
    "type": "/type/type",
    "properties": {
      "document": {
        "name": "Document",
        "unique": true,
        "type": "/type/document"
      },
      "entity": {
        "name": "Entity",
        "unique": true,
        "type": "/type/entity"
      },
      "page": {
        "name": "Occured on page",
        "unique": true,
        "type": "number"
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
    "entities": [],
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

// Expose to to CommonJS
if (typeof exports !== 'undefined') {
  exports = documents_fixture;
}