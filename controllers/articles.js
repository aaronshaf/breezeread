//var Articles = require("../models/articles.js");

var ArticlesController = {
	initialize: function(app) {
		app.get('/', this.index);
		app.get('/a/:_id', this.view);
	},

	index: function(req, res) {
		res.render('articles/view', {
			title: 'Breezeread'
		});	
	},

	view: function(req, res) {
		res.render('articles/view', {
			title: 'Breezeread'
		});	
	}
}

module.exports = ArticlesController;