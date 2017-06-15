'use strict';
/* globals module, require */

var Groups = require.main.require('./src/groups'),
	Meta = require.main.require('./src/meta'),
	Categories = require.main.require('./src/categories'),
	User = require.main.require('./src/user'),
	Events = require.main.require('./src/events'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	async = require('async'),
	utils = require('./utils');

module.exports = function(middleware) {
	var app = require('express').Router();

	app.post('/', apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
		if (!utils.checkRequired(['name'], req, res)) {
			return false;
		}

		Groups.create(req.body, function(err, groupObj) {
			errorHandler.handle(err, res, groupObj);
		});
	});

	app.post('/:slug', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		Groups.update(res.locals.groupName, req.body, function (err, data) {
			errorHandler.handle(err, res, data);
		});
	});

	app.delete('/:slug', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		if (!res.locals.groupName) {
			return errorHandler.handle(null, res);
		}
		Groups.getGroupsData([res.locals.groupName], function (err, groupsData) {
			if (err) {
				return errorHandler.handle(err, res);
			}
			if (!Array.isArray(groupsData) || !groupsData[0]) {
				return errorHandler.handle(err, res);
			}
			var groupObj = groupsData[0];

			Groups.destroy(res.locals.groupName, function(err) {
				if (groupObj.mainCid) {
					Categories.getChildren([groupObj.mainCid], req.uid, function (err, result) {
						if (!result || !result[0] || !result[0].length) {
							return errorHandler.handle(err, res);
						}
						async.each(result[0], function (child, next) {
							Categories.purge(child.cid, req.uid, next);
						}, function (err) {
							if (err) {
								return errorHandler.handle(err, res);
							}

							// delete this category
							Categories.purge(groupObj.mainCid, req.uid, function (err) {
								errorHandler.handle(err, res);
							})
						});
					})

				} else {
					errorHandler.handle(err, res);
				}
			});
		});
	});

	app.post('/:slug/membership', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, function(req, res) {
		var groupName = res.locals.groupName;
		if (groupName === 'administrators' || Groups.isPrivilegeGroup(groupName)) {
			return errorHandler.handle(new Error('[[error:not-allowed]]'), res);
		}

		if (Meta.config.allowPrivateGroups !== '0') {
			Groups.getGroupData(groupName, function (err, groupData) {
				if (groupData.private && groupData.disableJoinRequests) {
					return errorHandler.handle(new Error('[[error:join-requests-disabled]]'), res);
				}

				if (!groupData.private) {
					Groups.join(groupName, req.user.uid, function (err) {
						errorHandler.handle(err, res);
					});
				} else {
					Groups.requestMembership(res.locals.groupName, req.user.uid, function(err) {
						errorHandler.handle(err, res);
					});
				}
			});
		} else {
			Groups.join(res.locals.groupName, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		}
	});

	app.delete('/:slug/membership', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, function(req, res) {
		Groups.isMember(req.user.uid, res.locals.groupName, function(err, isMember) {
			if (isMember) {
				Groups.leave(res.locals.groupName, req.user.uid, function(err) {
					errorHandler.handle(err, res);
				});
			} else {
				errorHandler.respond(400, res);
			}
		});
	});

	app.post('/:slug/membership/accept', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		var toUid = req.body.toUid;
		var groupName = res.locals.groupName;
		var uid = req.user.uid;

		async.waterfall([
			function (next) {
				Groups.acceptMembership(groupName, toUid, next);
			},
			function (next) {
				Events.log({
					type: 'accept-membership',
					uid: uid,
					ip: req.ip,
					groupName: groupName,
					targetUid: toUid,
				});
				setImmediate(next);
			}
		], function (err) {
			errorHandler.handle(err, res);
		});
	});
	app.post('/:slug/membership/reject', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		var toUid = req.body.toUid;
		var groupName = res.locals.groupName;
		var uid = req.user.uid;

		async.waterfall([
			function (next) {
				Groups.rejectMembership(groupName, toUid, next);
			},
			function (next) {
				Events.log({
					type: 'reject-membership',
					uid: uid,
					ip: req.ip,
					groupName: groupName,
					targetUid: toUid,
				});
				setImmediate(next);
			},
		], function (err) {
			errorHandler.handle(err, res);
		});
	});
	app.post('/:slug/membership/acceptall', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		var groupName = res.locals.groupName;
		var uid = req.user.uid;
		var acceptFunc = function (toUid, next) {
			Groups.acceptMembership(groupName, toUid, function (err) {
				if (!err) {
					Events.log({
						type: 'accept-membership',
						uid: uid,
						ip: req.ip,
						groupName: groupName,
						targetUid: toUid,
					});
				}
				return next(err);
			});

		};

		async.waterfall([
			function (next) {
				Groups.getPending(groupName, next);
			},
			function (uids, next) {
				async.each(uids, acceptFunc, next);
			}
		], function (err) {
			errorHandler.handle(err, res);
		});
	});

	app.post('/:slug/membership/rejectall', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		var groupName = res.locals.groupName;
		var uid = req.user.uid;
		var rejectFunc = function (toUid, next) {
			Groups.rejectMembership(groupName, toUid, function (err) {
				if (!err) {
					Events.log({
						type: 'reject-membership',
						uid: uid,
						ip: req.ip,
						groupName: groupName,
						targetUid: toUid,
					});
				}
				return next(err);
			});

		};

		async.waterfall([
			function (next) {
				Groups.getPending(groupName, next);
			},
			function (uids, next) {
				async.each(uids, rejectFunc, next);
			}
		], function (err) {
			errorHandler.handle(err, res);
		});
	});


	return app;
};
