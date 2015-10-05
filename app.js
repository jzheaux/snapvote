// app.js
var restify = require("restify");
//var restifyOAuth2 = require("restify-oauth2");

var server  = restify.createServer({ name : 'snapvote',
	formatters: {
		"application/hal+json": function (req, res, body) {
			return res.formatters["application/json"](req, res, body);
		}
	}
});

server
		.use(restify.authorizationParser())
		.use(restify.fullResponse(	))
		.use(restify.bodyParser({ mapParams : false }));


/*
server.get("/", function (req, res) {
	var response = {
		message : "success!"
	}
	
	res.contentType = "application/hal+json";
	res.send(response);
});
*/

server.pre(function(req, res, next) {
	var agent = req.headers["user-agent"];
	var address = req.connection.remoteAddress;
	req.hash = new Buffer(agent + address).toString('base64');
	next();
});

var voteService = require(__dirname + '/service/voteService')(server);
//restifyOAuth2.ropc(server, { tokenEndpoint : "/token", hooks : userService });

server.get('/', restify.serveStatic({
	directory : __dirname,
	default : 'index.html'
}));

server.get('/client/.*', restify.serveStatic({
	directory : __dirname
}));

server.listen(3000, function() {
	console.log('%s listening at %s', server.name, server.url);
})

var logfmt = require("logfmt");	
