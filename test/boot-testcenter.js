
var Substance = require('substance');
var Test = require('substance-test');

require('./index');

window.onload = function() {
  var testCenter = new Test.TestCenter();
  testCenter.render();
  document.body.appendChild(testCenter.el);
  if (window.location.hash) {
    var suiteId = window.location.hash.substring(1);
    if (testCenter.hasSuite(suiteId)) {
      testCenter.runSuite(suiteId);
    } else {
      testCenter.runAll();
    }
  } else {
    testCenter.runAll();
  }
};
