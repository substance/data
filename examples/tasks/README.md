Tasks — A Data.js Demo App
==================

Tasks is meant to be used as a starting point for building applications on top of Data.js. 

It covers the following functionality:

* Offline editing — by enabling local Data.Graph persistence
* Sync with Couch — once you press the sync button your local changes get synchronized with the server, resp. CouchDB
* Conflict detection — in a multi-user scenario

Feedback is welcome!
Please feel free to contribute!


Install
==================

1. Have a CouchDB instance running
2. Install packages
   `$ npm install now express`
3. Update `config.json` appropriately
4. Seed the DB
   `$ node db/seed.js --flush`
5. Start the server
   `$ node server.js`