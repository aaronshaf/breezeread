var express = require('express'),
	http = require('http'),
	path = require('path'),
	nowww = require('nowww');

var ArticlesController = require('./controllers/articles');

var app = express();

app.configure(function(){
	app.set('port', process.env.PORT || 3000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(nowww());
	//app.use(express.favicon());

	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(path.join(__dirname, 'public')));

	app.get('/*', function(req, res, next) {
		next();
		return;
		if (req.headers.host.match(/^www/) === null ) {
			res.redirect('http://' + req.headers.host.replace(/^www\./, '') + req.url);
		} else {
			next();
		}
	});

	app.use(app.router);
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

ArticlesController.initialize(app);

var server = http.createServer(app);

server.listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});