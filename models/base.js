var mongo = require("../data/mongo");
var ObjectID = require("mongodb").ObjectID;
var Q = require("q");
var _ = require("underscore");

var Base = {
	collection: "products",

	findOne: function(query) {
		var defer = Q.defer();

		if(!this.collection) {
			defer.reject('Collection name not set.');
			return defer.promise;
		}

		query = mongo.query(query);
		redis.get(this.collection, query).then(function(value) {
			if (defer.promise.isResolved()) {
				return;
			}
			if (value) {
				return defer.resolve(value);
			}
		});

		mongo.collection(this.collection).then(function(collection) {
			return collection.findOne(query, function(error, result) {
				if (error) {
					return defer.reject(error);
				} else {
					if (result) {
						redis.set(collection.collectionName, query, result);
					}
					if (!defer.promise.isResolved()) {
						return defer.resolve(result);
					}
				}
			});
		});

		return defer.promise;
	},

	remove: function(query) {
		var defer = Q.defer();

		if(!this.collection) {
			defer.reject('Collection name not set.');
			return defer.promise;
		}

		if(typeof query._id === 'string') {
			query._id = ObjectID(query._id);
		}

		mongo.collection(this.collection).then(function(collection) {
			return collection.remove(query, function(error, result) {
				if (error) {
					return defer.reject(error);
				} else {
					if (result) {
						redis.del(collection.collectionName, query);
					}
					if (!defer.promise.isResolved()) {
						return defer.resolve(result);
					}
				}
			});
		});

		return defer.promise;
	},

	find: function(query, options) {
		var defer = Q.defer();
		if(!this.collection) {
			defer.reject('Collection name not set.');
			return defer.promise;
		}
		query = query || {};
		query = mongo.query(query);

		options = options || {};
		options = _.defaults(options, {
			limit: 30,
			skip: 0,
			sort: {modified: -1},
			fields: {}
		});

		redis.get(this.collection, query).then(function(value) {
			if (defer.promise.isResolved()) {
				return;
			}
			if (value) {
				return defer.resolve(value);
			}
		});

		mongo.collection(this.collection).then(function(collection) {
			return collection.find(query, options.fields).limit(options.limit).skip(options.skip).sort(options.sort).toArray(function(error, result) {
				if (error) {
					return defer.reject(error);
				} else {
					if (result) {
						redis.set(collection.collectionName, query, result);
					}
					if (!defer.promise.isResolved()) {
						return defer.resolve(result);
					}
				}
			});
		});
		return defer.promise;
	},

	isolate: function(request, data) {
		if(request.session.group && !data._id) {
			data.group_id = request.session.group._id.toString();
		}
		return data;
	},

	prepare: function(data) {
		data.modified = new Date();

		//Stupid for this to be in the base model -- temporary
		if(data.new_password) {
			data.password = krypto.sha512('xcedo' + data.new_password);
			delete data.new_password;
		}

		return data;
	},

	save: function(data) {
		var defer = Q.defer();
		var _id;

		data = this.prepare(data);

		console.log(data);

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
	},

	search: function(query) {
		return indexden.search(this.collection, query).then(function(results) {
			var defer = Q.defer();

			var x;
			for(x in results.results) {
				results.results[x]._id = results.results[x].docid;
				delete results.results[x].docid;
			}

			return results;
			
			defer.resolve(results);

			return defer.promise;
		});
	},

	index: function(data) {
		indexden.set(this.collection,data);
	}
};

module.exports = Base;