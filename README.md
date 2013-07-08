Substance.Data    [![Build Status](https://travis-ci.org/substance/data.png)](https://travis-ci.org/substance/data)
=====================

Substance.Data is a data representation framework for Javascript. It's being developed in the context of Substance, an open publishing platform.


With Substance.Data you can:
---------------------

* Model your domain data using a simple graph-based object model that can be serialized to JSON.
* Traverse your graph, including relationships using a simple API.
* Manipulate and query data on the client (browser) or on the server (Node.js) by using exactly the same API.

Features
---------------------

* `Data.Graph` (A data abstraction for all kinds of linked data)
* [Persistence](http://github.com/substance/store) (You can persist your data to a Data.Store)
* [Operational Transformation](http://github.com/substance/operator) (for incremental updates)
* [Versioning](http://github.com/substance/chronicle) (Every graph operation is remembered and can be reverted)

Install
---------------------

Using the latest NPM release

```bash
$ npm install substance-data
```

Or clone from repository

```bash
$ git clone https://github.com/substance/data
$ cd data 
$ npm install
```

For running the testsuite, make sure you have mocha installed

```bash
sudo npm install -g mocha
```

Run the tests

```bash
sudo npm test
```

