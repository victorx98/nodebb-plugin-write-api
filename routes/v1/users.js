'use strict';
/* globals module, require */

var Users = require.main.require('./src/user'),
	Messaging = require.main.require('./src/messaging'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	auth = require('../../lib/auth'),
	utils = require('./utils'),
	async = require.main.require('async'),
	sysUtils = require.main.require('./src/utils');


module.exports = function(/*middleware*/) {
	var app = require('express').Router();

	app.post('/', apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
		if (!utils.checkRequired(['username'], req, res)) {
			return false;
		}

		Users.create(req.body, function(err, uid) {
			return errorHandler.handle(err, res, {
				uid: uid
			});
		});
	});

	app.route('/:uid')
		.put(apiMiddleware.requireUser, apiMiddleware.exposeAdmin, function(req, res) {
			if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10) && !res.locals.isAdmin) {
				return errorHandler.respond(401, res);
			}

			var userData = req.body;
			var userNameChanged;

			// This is the update uid
			userData.uid = req.params.uid;

			async.waterfall([
				function(next) {
					if (userData.rename) {
						Users.uniqueUsername({
							userslug: sysUtils.slugify(userData.rename),
							username: userData.rename
						}, next);
					} else {
						next(null, '');
					}
				},
				function(renamedUsername, next) {
					userNameChanged = !!renamedUsername;
					if (userNameChanged) {
						userData.username = renamedUsername;
						userData.userslug = sysUtils.slugify(renamedUsername);
					}
					Users.updateProfile(req.uid, userData, next);
				}
			], function(err) {
				if (!err && userNameChanged) {
					Users.notifications.sendNameChangeNotification(userData.uid, userData.username);
				}
				return errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.exposeAdmin, function(req, res) {
			if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10) && !res.locals.isAdmin) {
				return errorHandler.respond(401, res);
			}

			// Clear out any user tokens belonging to the to-be-deleted user
			async.waterfall([
				async.apply(auth.getTokens, req.params.uid),
				function(tokens, next) {
					async.each(tokens, function(token, next) {
						auth.revokeToken(token, 'user', next);
					}, next);
				},
				async.apply(Users.delete, req.user.uid, req.params.uid)
			], function(err) {
				return errorHandler.handle(err, res);
			});
		});

	app.put('/:uid/password', apiMiddleware.requireUser, apiMiddleware.exposeAdmin, function(req, res) {
		if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10) && !res.locals.isAdmin) {
			return errorHandler.respond(401, res);
		}

		Users.changePassword(req.user.uid, {
			uid: req.params.uid,
			currentPassword: req.body.current || '',
			newPassword: req.body['new'] || ''
		}, function(err) {
			errorHandler.handle(err, res);
		});
	});

	app.post('/:uid/follow', apiMiddleware.requireUser, function(req, res) {
		Users.follow(req.user.uid, req.params.uid, function(err) {
			return errorHandler.handle(err, res, err ? null: {uid: req.params.uid, followed: true});
		});
	});

	app.delete('/:uid/follow', apiMiddleware.requireUser, function(req, res) {
		Users.unfollow(req.user.uid, req.params.uid, function(err) {
			return errorHandler.handle(err, res, err ? null: {uid: req.params.uid, unfollowed: true});
		});
	});

	app.route('/:uid/chats')
		.post(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['message'], req, res)) {
				return false;
			}

			var timestamp = parseInt(req.body.timestamp, 10) || Date.now();

			Messaging.canMessageUser(req.user.uid, req.params.uid, function(err) {
				if (err) {
					return errorHandler.handle(err, res);
				}

				Messaging.newRoom(req.user.uid, [req.params.uid], function(err, roomId) {
					Messaging.addMessage(req.user.uid, roomId, req.body.message, timestamp, function(err, message) {
						if (parseInt(req.body.quiet, 10) !== 1 && !timestamp) {
							Messaging.notifyUsersInRoom(req.user.uid, roomId, message);
						}

						return errorHandler.handle(err, res, message);
					});
				});
			});
		});

	app.route('/:uid/ban')
		.post(apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
			Users.ban(req.params.uid, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
			Users.unban(req.params.uid, function(err) {
				errorHandler.handle(err, res);
			});
		});

	app.route('/:uid/tokens')
		.get(apiMiddleware.requireUser, function(req, res) {
			if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
				return errorHandler.respond(401, res);
			}

			auth.getTokens(req.params.uid, function(err, tokens) {
				return errorHandler.handle(err, res, {
					tokens: tokens
				});
			});
		})
		.post(apiMiddleware.requireUser, function(req, res) {
			if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid)) {
				return errorHandler.respond(401, res);
			}

			auth.generateToken(req.params.uid, function(err, token) {
				return errorHandler.handle(err, res, {
					token: token
				});
			});
		});

	app.delete('/:uid/tokens/:token', apiMiddleware.requireUser, function(req, res) {
		if (parseInt(req.params.uid, 10) !== req.user.uid) {
			return errorHandler.respond(401, res);
		}

		auth.revokeToken(req.params.token, 'user', function(err) {
			errorHandler.handle(err, res);
		});
	});

	return app;
};
