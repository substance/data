Data.js
==================

Data.js is a data abstraction and manipulation framework for JavaScript. It is
being extracted from [Unveil.js](http://github.com/michael/unveil)
in order to make it available as a separate library, that can be used in the
browser or within CommonJS environments.

I took some inspiration from various existing data manipulation libraries such
as the Google Visualization API or Underscore.js. I updated the API so most of 
the methods conform to the API of Underscore.js. Actually Data.js is meant to 
be used as an extension to Underscore.js, on which it depends on.

Until a dedicated documentation is available, please have a look at the tests
and the [Unveil.js documentation](http://docs.quasipartikel.at/#/unveil)
(see SortedHash API, Node API, Collection API).

Modules available
------------------

* Data.SortedHash (A SortedHash data-structure)
* Data.Node (A JavaScript Graph implementation that hides graph complexity from the interface)

Upcoming modules (in this order)
------------------

* Data.Graph (A data abstraction for all kinds of linked data)
* Data.Collection (A simple interface for tabular data)