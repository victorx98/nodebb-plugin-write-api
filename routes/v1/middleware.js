'use strict';
/* globals module, require */

var passport = require.main.require('passport'),
	async = require.main.require('async'),
	jwt = require('jsonwebtoken'),
	auth = require('../../lib/auth'),
	db = require.main.require('./src/database'),
	user = require.main.require('./src/user'),
	groups = require.main.require('./src/groups'),
	topics = require.main.require('./src/topics'),
	utils = require.main.require('./src/utils'),
	categories = require.main.require('./src/categories'),
	errorHandler = require('../../lib/errorHandler'),
	request = require('request'),
	Middleware = {};

var WxBizDataCrypt = require('../../lib/wxBizDataCrypt');

function getUidByWechatId(wxid, callback) {
	db.getObjectField('wxid:uid', wxid, function (err, uid) {
		if (err) {
			return callback(err);
		}
		callback(null, uid);
	});
}

Middleware.requireUser = function(req, res, next) {
	var writeApi = require.main.require('nodebb-plugin-write-api');
	var routeMatch;

	if (req.headers.hasOwnProperty('authorization')) {
		passport.authenticate('bearer', { session: false }, function(err, user) {
			if (err) { return next(err); }
			if (!user) { return errorHandler.respond(401, res); }

			// If the token received was a master token, a _uid must also be present for all calls
			if (user.hasOwnProperty('uid')) {
				req.login(user, function(err) {
					if (err) { return errorHandler.respond(500, res); }

					req.uid = user.uid;
					next();
				});
			} else if (user.hasOwnProperty('master') && user.master === true) {
				if (req.body.hasOwnProperty('_uid') || req.query.hasOwnProperty('_uid')) {
					user.uid = req.body._uid || req.query._uid;
					delete user.master;

					req.login(user, function(err) {
						if (err) { return errorHandler.respond(500, res); }

						req.uid = user.uid;
						next();
					});
				} else {
					res.status(400).json(errorHandler.generate(
						400, 'params-missing',
						'Required parameters were missing from this API call, please see the "params" property',
						['_uid']
					));
				}
			} else {
				return errorHandler.respond(500, res);
			}
		})(req, res, next);
	} else if (writeApi.settings['jwt:enabled'] === 'on'
		&& req.body.code
		&& req.body.encryptedData) {
		console.log('wechat login request data: ', req.body);

		var appId = writeApi.settings['wechat:appId'];
		var appSecret = writeApi.settings['wechat:appSecret'];
		var jwtSecret = writeApi.settings['jwt:secret'];

		var expiresIn = 60 * 60 * 48; // expires in 48 hours

		var encryptedData = req.body.encryptedData;
		var code = req.body.code;
		var iv = req.body.iv;
		var sessionKey = '';
		var path = 'https://api.weixin.qq.com/sns/jscode2session?appid=' +
		appId + '&secret='+appSecret+'&js_code='+code+'&grant_type=authorization_code';
		var requestOptions = {
		    url: path,
		    method: 'GET',
		    json: {}
		};
		request(
			requestOptions,
			function (err, response, body) {
				if (err || body.errcode) {
				  console.error(err, body)
				  return errorHandler.handle(err || body.errmsg || body, res);
				}
				sessionKey = body.session_key;

				var pc = new WxBizDataCrypt(appId, sessionKey);
				var data = pc.decryptData(encryptedData, iv);

				// use unionId as user identify key then openId
				var wechatId = data.unionId || data.openId;
				// fix wechat logo protocol, use https instead.
				var avatarUrl = (data.avatarUrl || '').replace('http://wx.qlogo.cn', 'https://wx.qlogo.cn');

				// fix for some special wechat nickname
				var wechatName = data.nickName.replace(/[^'"\s\-+.*0-9\u00BF-\u1FFF\u2C00-\uD7FF\w]/g, '');

				console.log('login to wechat: ', {
					wechatName: wechatName,
					nickName: data.nickName,
					unionId: data.unionId,
					openId: data.openId
				})

				function _login (uid) {
					req.login({
						uid: uid
					}, function(err) {
						if (err) { return errorHandler.handle(err, res);}
						user.getUserData(uid, function (err, userData) {
							if (err) { return errorHandler.handle(err, res);}
							userData.nickName = data.nickName;

							// 兼容旧版本对于 weiXin 的调用
							userData.weiXin = {
								nickName: data.nickName,
								avatarUrl: avatarUrl
							};

							auth.generateToken(uid, function(err, token){
								if (err) { return errorHandler.handle(err, res);}
								/*
								var token = jwt.sign(userData, jwtSecret, {
								  expiresIn: expiresIn
								});
								*/

								req.uid = uid;

								req.body = {
									token: token,
									user: userData
								};
								next();
							});
						});
					});
				}

				getUidByWechatId(wechatId, function (err, uid) {
					if (err) {
						return errorHandler.handle(err, res);
					}
					// console.log('get uid: ', uid);
					if (uid !== null) {
						_login(uid);
					} else {
						// fullname could be duplicate, but username must be unique.
						user.create({
							username: wechatName,
							fullname: data.nickName
						}, function (err, uid) {
							if (err) {
								console.error(err);
								return errorHandler.handle(err, res);
							}
							user.setUserField(uid, 'wxid', wechatId);
							db.setObjectField('wxid:uid', wechatId, uid);

							if (avatarUrl) {
								user.setUserField(uid, 'picture', avatarUrl);
							}
							_login(uid);
						});
					}
				});
			}
		);
		// var token = (writeApi.settings['jwt:payloadKey'] ? (req.query[writeApi.settings['jwt:payloadKey']] || req.body[writeApi.settings['jwt:payloadKey']]) : null) || req.query.token || req.body.token;
		// jwt.verify(token, writeApi.settings['jwt:secret'], {
		// 	ignoreExpiration: true,
		// }, function(err, decoded) {
		// 	if (!err && decoded) {
		// 		if (!decoded.hasOwnProperty('_uid')) {
		// 			return res.status(400).json(errorHandler.generate(
		// 				400, 'params-missing',
		// 				'Required parameters were missing from this API call, please see the "params" property',
		// 				['_uid']
		// 			));
		// 		}

		// 		req.login({
		// 			uid: decoded._uid
		// 		}, function(err) {
		// 			if (err) { return errorHandler.respond(500, res); }

		// 			req.uid = decoded._uid
		// 			req.body = decoded;
		// 			next();
		// 		});
		// 	} else {
		// 		errorHandler.respond(401, res);
		// 	}
		// });
	} else if ((routeMatch = req.originalUrl.match(/^\/api\/v\d+\/users\/(\d+)\/tokens$/)) && req.body.hasOwnProperty('password')) {
		// If token generation route is hit, check password instead
		var uid = routeMatch[1];

		user.isPasswordCorrect(uid, req.body.password, function (err, ok) {
			if (ok) {
				req.login({ uid: parseInt(uid, 10) }, function(err) {
					if (err) { return errorHandler.respond(500, res); }

					req.uid = user.uid;
					next();
				});
			} else {
				errorHandler.respond(401, res);
			}
		});
	} else {
		if (req.user && req.user.uid) {
			return next();
		}
		console.error('requireUser login data error', req.body);
		errorHandler.respond(401, res);
	}
};

Middleware.associateUser = function(req, res, next) {
	// console.log('###req.headers', req.headers);
	if (req.headers.hasOwnProperty('authorization')) {
		passport.authenticate('bearer', { session: false }, function(err, user) {
			if (err || !user) { return next(err); }

			// If the token received was a master token, a _uid must also be present for all calls
			if (user.hasOwnProperty('uid')) {
				req.login(user, function(err) {
					if (err) { return errorHandler.respond(500, res); }

					req.uid = user.uid;
					next();
				});
			} else if (user.hasOwnProperty('master') && user.master === true) {
				if (req.body.hasOwnProperty('_uid') || req.query.hasOwnProperty('_uid')) {
					user.uid = req.body._uid || req.query._uid;
					delete user.master;

					req.login(user, function(err) {
						if (err) { return errorHandler.respond(500, res); }

						req.uid = user.uid;
						next();
					});
				} else {
					res.status(400).json(errorHandler.generate(
						400, 'params-missing',
						'Required parameters were missing from this API call, please see the "params" property',
						['_uid']
					));
				}
			} else {
				return errorHandler.respond(500, res);
			}
		})(req, res, next);
	} else {
		return next();
	}
};

Middleware.requireAdmin = function(req, res, next) {
	if (!req.user) {
		return errorHandler.respond(401, res);
	}

	user.isAdministrator(req.user.uid, function(err, isAdmin) {
		if (err || !isAdmin) {
			return errorHandler.respond(403, res);
		}

		next();
	});
};

Middleware.exposeAdmin = function(req, res, next) {
	// Unlike `requireAdmin`, this middleware just checks the uid, and sets `isAdmin` in `res.locals`
	res.locals.isAdmin = false;

	if (!req.user) {
		return next();
	}

	user.isAdministrator(req.user.uid, function(err, isAdmin) {
		if (err) {
			return errorHandler.handle(err, res);
		} else {
			res.locals.isAdmin = isAdmin;
			return next();
		}
	});
}

Middleware.validateTid = function(req, res, next) {
	if (req.params.hasOwnProperty('tid')) {
		topics.exists(req.params.tid, function(err, exists) {
			if (err) {
				errorHandler.respond(500, res);
			} else if (!exists) {
				errorHandler.respond(404, res);
			} else {
				next();
			}
		});
	} else {
		errorHandler.respond(404, res);
	}
};

Middleware.validateCid = function(req, res, next) {
	if (req.params.hasOwnProperty('cid')) {
		categories.exists(req.params.cid, function(err, exists) {
			if (err) {
				errorHandler.respond(500, res);
			} else if (!exists) {
				errorHandler.respond(404, res);
			} else {
				next();
			}
		});
	} else {
		errorHandler.respond(404, res);
	}
};

Middleware.validateGroup = function(req, res, next) {
	if (res.locals.groupName) {
		next();
	} else {
		errorHandler.respond(404, res);
	}
};

Middleware.requireGroupOwner = function(req, res, next) {
	if (!req.user || !req.user.uid) {
		errorHandler.respond(401, res);
	}

	async.parallel({
		isAdmin: async.apply(user.isAdministrator, req.user.uid),
		isOwner: async.apply(groups.ownership.isOwner, req.user.uid, res.locals.groupName)
	}, function(err, checks) {
		if (checks.isOwner || checks.isAdmin) {
			next();
		} else {
			errorHandler.respond(403, res);
		}
	});
};

module.exports = Middleware;
