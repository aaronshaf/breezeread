var Base = require('./base');
var _ = require("underscore");

var Articles = {
  collection: 'articles'
};

Articles.prototype = Base;
module.exports = Articles;