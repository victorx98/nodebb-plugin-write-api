'use strict';
/* globals module, require */

var	passport = module.parent.require('passport'),
	BearerStrategy = require('passport-http-bearer').Strategy,

	meta = require.main.require('./src/meta'),

	auth = require('./lib/auth'),
	sockets = require('./lib/sockets'),

	API = {};

// var JwtStrategy = require('passport-jwt').Strategy;
// var ExtractJwt = require('passport-jwt').ExtractJwt;

// API.getStrategy = function (strategies, callback) {
// 	console.log('######## getStrategy');
// 	var opts = {};
// 	opts.jwtFromRequest = ExtractJwt.fromAuthHeader();
// 	// opts.secretOrKey = '123123123';
// 	opts.passReqToCallback = true;

// 	passport.use('jwt', new JwtStrategy(opts, function (req, jwtPayload, done) {
// 	  // todo:此处需要处理（例如使用jwt-simple）成jwt_payload.id来访问
// 	  console.log('###jwtPayload:', jwtPayload);
// 	  done(null, false);
// 	}));

// 	return callback(null, strategies);
// };

API.init = function(data, callback) {
	// API Versions
	var routes = require('./routes')(data.middleware);
	data.router.use('/api/v1', routes.v1);

	// Set up HTTP bearer authentication via Passport
	passport.use(new BearerStrategy({}, function(token, done) {
		// Find the user by token.  If there is no user with the given token, set
		// the user to `false` to indicate failure.  Otherwise, return the
		// authenticated `user`.  Note that in a production-ready application, one
		// would want to validate the token for authenticity.
		console.log('### use BearerStrategy', token);
		auth.verifyToken(token, done);
	}));

	require('./routes/admin')(data.router, data.middleware);	// ACP
	sockets.init();	// WebSocket listeners

	API.reloadSettings();

	data.router.post('/weapp/login', require('./routes/v1/middleware').requireUser, function (req, res) {
		res.status(200).json(req.body);
	});

	callback();
};

API.addMenuItem = function(custom_header, callback) {
	custom_header.plugins.push({
		route: '/plugins/write-api',
		icon: 'fa-cogs',
		name: 'Write API'
	});

	callback(null, custom_header);
};

API.authenticate = function(data) {
	require('./routes/v1/middleware').requireUser(data.req, data.res, data.next);
};

API.associateUser = require('./routes/v1/middleware').associateUser;

API.reloadSettings = function(hash) {
	if (!hash || hash === 'settings:writeapi') {
		meta.settings.get('writeapi', function(err, settings) {
			API.settings = settings;
		});
	}
};

module.exports = API;
