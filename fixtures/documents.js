var documents_fixture = {
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
    "properties": {
      "title": "Protovis",
      "authors": ["Michael Bostock", "Jeffrey Heer"],
      "page_count": 8,
      "entities": ["/location/stanford", "/location/new_york"]
    }
  },
  "/doc/unveil_introduction": {
    "type": "/type/document",
    "properties": {
      "title": "Unveil.js",
      "authors": ["Michael Aufreiter", "Lindsay Kay"],
      "page_count": 5,
      "entities": []
    }
  },
  "/doc/processing_js_introduction": {
    "type": "/type/document",
    "properties": {
      "title": "Processing.js",
      "authors": ["Alistair MacDonald", "David Humphrey", "Michael Aufreiter"],
      "page_count": 20
    }
  },
  "/location/stanford": {
    "type": "/type/entity",
    "properties": {
      "name": "Stanford",
      "mentions": ["M0000001"]    
    }
  },
  "/location/new_york": {
    "type": "/type/entity",
    "properties": {
      "name": "New York",
      "mentions": ["M0000002", "M0000003"]
    }
  },
  "/location/toronto": {
    "type": "/type/entity",
    "properties": {
      "name": "Toronto",
      "mentions": ["M0000004"]
    }
  },
  "/person/michael_bostock": {
    "type": "/type/entity",
    "properties": {
      "name": "Michael Bostock",
      "mentions": ["M0000005"]
    }
  },
  "M0000001": {
    "type": "/type/mention",
    "properties": {
      "document": "/doc/protovis_introduction",
      "entity": "/location/stanford",
      "page": 2
    }
  },
  "M0000002": {
    "type": "/type/mention",
    "properties": {
      "document": "/doc/protovis_introduction",
      "entity": "/location/new_york",
      "page": 8
    }
  },
  "M0000003": {
    "type": "/type/mention",
    "properties": {
      "document": "/doc/processing_js_introduction",
      "entity": "/location/new_york",
      "page": 5
    }
  },
  "M0000004": {
    "type": "/type/mention",
    "properties": {
      "document": "/doc/processing_js_introduction",
      "entity": "/location/toronto",
      "page": 2
    }
  },
  "M0000005": {
    "type": "/type/mention",
    "properties": {
      "document": "/doc/protovis_introduction",
      "entity": "/person/michael_bostock",
      "page": 1
    }
  }
}