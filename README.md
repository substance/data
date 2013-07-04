Data.js
=====================

Data.js is a data representation framework for Javascript. It's being developed in the context of Substance, an open publishing platform.


With Data.js you can:
---------------------

* Model your domain data using a simple graph-based object model that can be serialized to JSON.
* Traverse your graph, including relationships using a simple API.
* Manipulate and query data on the client (browser) or on the server (Node.js) by using exactly the same API.


Features
---------------------

* `Data.Graph` (A data abstraction for all kinds of linked data)
* [Persistence](http://github.com/substance/store) (You an persist your data to a Data.Store)
* [Replication](http://github.com/substance/replicator) (graphs can be synchronized with any)
* [Versioning](http://github.com/substance/chronicle) (Every graph operation is remembered and can be reverted)