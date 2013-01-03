var mongo = require("../data/mongo");
var ObjectID = require("mongodb").ObjectID;
var Q = require("q");
var _ = require("underscore");

var Base = {
	collection: "products",

	findOne: function(query) {
		var defer = Q.defer();

		query = mongo.query(query);

		mongo.collection(this.collection).then(function(collection) {
			return collection.findOne(query, function(error, result) {
				if (error) {
					return defer.reject(error);
				} else {
					return defer.resolve(result);
				}
			});
		});

		return defer.promise;
	},

	remove: function(query) {
		var defer = Q.defer();

		if(typeof query._id === 'string') {
			query._id = ObjectID(query._id);
		}

		mongo.collection(this.collection).then(function(collection) {
			return collection.remove(query, function(error, result) {
				if (error) {
					return defer.reject(error);
				} else {
					return defer.resolve(result);
				}
			});
		});

		return defer.promise;
	},

	find: function(query, options) {
		var defer = Q.defer();

		query = query || {};
		query = mongo.query(query);

		options = options || {};
		options = _.defaults(options, {
			limit: 30,
			skip: 0,
			sort: {modified: -1},
			fields: {}
		});

		mongo.collection(this.collection).then(function(collection) {
			return collection.find(query, options.fields).limit(options.limit).skip(options.skip).sort(options.sort).toArray(function(error, result) {
				if (error) {
					return defer.reject(error);
				} else {
					return defer.resolve(result);
				}
			});
		});
		return defer.promise;
	},

	save: function(data) {
		var defer = Q.defer();
		var _id;

		if (data._id) {
			_id = ObjectID(data._id);
			delete data._id;
		} else {
			_id = ObjectID();
		}

		mongo.collection(this.collection).then(function(collection) {
			return collection.findAndModify({
				_id: _id
			}, {}, {
				$set: data
			}, {
				upsert: true,
				"new": true
			}, function(error, object) {
				if (error) {
					return defer.reject(error);
				} else {
					return defer.resolve(object);
				}
			});
		});

		return defer.promise;
	}
};

module.exports = Base;