'use strict';
/* globals module, require */

var Groups = require.main.require('./src/groups'),
	Meta = require.main.require('./src/meta'),
	Categories = require.main.require('./src/categories'),
	Events = require.main.require('./src/events'),
	db = require.main.require('./src/database'),
	image = require.main.require('./src/image'),
	file = require.main.require('./src/file'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	accountHelpers = require.main.require('./src/controllers/accounts/helpers'),
	uploadsController = require.main.require('./src/controllers/uploads'),
	async = require('async'),
	utils = require('./utils'),
	mime = require.main.require('mime'),
	path = require.main.require('path'),
	validator = require.main.require('validator');

Groups.updateThumbnail = function (uid, data, callback) {
	var tempPath = data.file ? data.file : '';
	var url;
	var type = data.file ? mime.lookup(data.file) : 'image/png';

	if (!data.imageData && !data.file && !data.url) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			if (data.url) {
				if (!validator.isURL(data.url)) {
					return callback(new Error('[[error:invalid-data]]'));
				} else {
					Groups.setGroupField(data.groupName, 'thumbnail:url', data.url, function (err) {
						callback(err, { url: data.url });
					});
				}
			} else {
				next();
			}
		},
		function (next) {
			if (tempPath) {
				return next(null, tempPath);
			}
			image.writeImageDataToTempFile(data.imageData, next);
		},
		function (_tempPath, next) {
			tempPath = _tempPath;

			uploadsController.uploadGroupCover(uid, {
				name: 'groupThumbnail' + path.extname(tempPath),
				path: tempPath,
				type: type,
			}, next);
		},
		function (uploadData, next) {
			url = uploadData.url;
			Groups.setGroupField(data.groupName, 'thumbnail:url', url, next);
		}
	], function (err) {
		file.delete(tempPath);
		callback(err, { url: url });
	});
};

module.exports = function(middleware) {
	var app = require('express').Router();

	app.get('/:userslug/:type', apiMiddleware.requireUser, function(req, res){
		var userData;
		var groupsData;
		var groupNames;
		var memberOf;
		async.waterfall([
			function (next) {
				accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
			},
			function (_userData, next) {
				userData = _userData;
				if (!userData) {
					return errorHandler.handle(true, res);
				}
				db.getSortedSetRevRange('groups:visible:createtime', 0, -1, next);
			},
			function (_groupNames, next) {
				groupNames = _groupNames;
				var method = Groups.isPending;
				if (req.params.type === 'invited') {
					method = Groups.isInvited;
				}
				async.map(groupNames, function (name, next) {
					method(userData.uid, name, next);
				}, next);
			},
			function (isMembers, next) {
				memberOf = [];
				isMembers.forEach(function (isMember, index) {
					if (isMember) {
						memberOf.push(groupNames[index]);
					}
				});

				Groups.getGroupsData(memberOf, next);
			},
			function (_groupsData, next) {
				groupsData = _groupsData;
				Groups.getMemberUsers(memberOf, 0, 3, next);
			},
			function (members, next) {
				groupsData.forEach(function (group, index) {
					group.members = members[index];
					group.isMember = false;
					group.isInvited = req.params.type === 'invited';
					group.isPending = req.params.type === 'pending';
				});

				async.map(memberOf, function (name, next) {
					Groups.getMemberCount(name, next);
				}, next);
			}
		], function (err, memberCounts) {
			groupsData.forEach(function (group, index) {
				group.memberCount = memberCounts[index];
			});
			errorHandler.handle(err, res, groupsData);
		});
	});

	app.get('/search', apiMiddleware.requireUser, function (req, res) {
		Groups.search(req.query.q, {filterHidden: true}, function (err, groups) {
			groups = (groups || []).filter(function (group) {
				return group.cid;
			});
			errorHandler.handle(err, res, groups);
		});
	});

	app.post('/', apiMiddleware.requireUser, function(req, res) {
		if (!utils.checkRequired(['name'], req, res)) {
			return false;
		}

		req.body.ownerUid = req.uid;

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
				if (groupObj.cid) {
					// delete this category
					Categories.purge(groupObj.cid, req.uid, function (err) {
						errorHandler.handle(err, res);
					});
				} else {
					errorHandler.handle(err, res);
				}
			});
		});
	});

	app.post('/:slug/uploadthumbnail', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		async.waterfall([
			function (next) {
				Groups.ownership.isOwner(req.uid, res.locals.groupName, next);
			},
			function (isOwner, next) {
				if (!isOwner) {
					return next(new Error('[[error:no-privileges]]'));
				}

				Groups.updateThumbnail(req.uid, {
					file: req.files && req.files.files ? req.files.files[0].path : '',
					groupName: res.locals.groupName,
					imageData: req.body.imageData,
					url: req.body.url
				}, next);
			},
		], function (err, data) {
			errorHandler.handle(err, res, data);
		});
	});

	app.route('/:slug/self_intro')
	  .post(apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, function(req, res) {
		var key = 'user:'+req.uid+':group_intro';
		db.setObjectField(key, res.locals.groupName, req.body.intro, function (err) {
			errorHandler.handle(err, res);
		});
	  });

	app.get('/get_intro', function(req, res) {
		var key = 'user:'+req.query.userId+':group_intro';
		db.getObjectField(key, req.query.groupName, function (err, intro) {
			errorHandler.handle(err, res, {intro: intro});
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
					if (groupData.hasPassword && req.body.password) {
						Groups.isPending(req.uid, groupName, function (err, isPending) {
							if (err) return errorHandler.handle(err, res);

							var key = 'group:password';
							db.getObjectField(key, groupName, function (err, pwd) {
								if (err) return errorHandler.handle(err, res);

								if (pwd === req.body.password) {
									if (isPending) {
										Groups.acceptMembership(groupName, req.uid, function (err) {
											errorHandler.handle(err, res, {member: true});
										});
									} else {
										Groups.join(groupName, req.user.uid, function (err) {
											errorHandler.handle(err, res, {member: true});
										});
									}

								} else {
									err = new Error('[[error:invalid-password]]');
									errorHandler.handle(err, res);
								}
							});
						});
					} else {
						Groups.requestMembership(res.locals.groupName, req.user.uid, function(err) {
							errorHandler.handle(err, res, {pending: true});
						});
					}
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

	app.delete('/:slug/kickout', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		var toUid = req.body.toUid;

		Groups.leave(res.locals.groupName, toUid, function(err) {
			errorHandler.handle(err, res);
		});
	});

	app.post('/:slug/membership/accept_or_reject', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, apiMiddleware.requireGroupOwner, function(req, res) {
		var toUid = req.body.toUid;
		var type = req.body.type || 'accept';
		if (type !== 'accept' && type !== 'reject') {
			return errorHandler.handle(true, res);
		}

		var groupName = res.locals.groupName;
		var uid = req.user.uid;
		var method = type === 'accept' ? Groups.acceptMembership : Groups.rejectMembership;

		async.waterfall([
			function (next) {
				method(groupName, toUid, next);
			}
		], function (err) {
			Events.log({
				type: type+'-membership',
				uid: uid,
				ip: req.ip,
				groupName: groupName,
				targetUid: toUid,
			});
			errorHandler.handle(err, res);
		});
	});
	app.post('/:slug/membership/agree_or_disagree', apiMiddleware.requireUser, middleware.exposeGroupName, apiMiddleware.validateGroup, function(req, res) {
		var groupName = res.locals.groupName;
		var uid = req.user.uid;
		var type = req.body.type || 'agree';
		if (type !== 'agree' && type !== 'disagree') {
			return errorHandler.handle(true, res);
		}
		var method = type === 'agree' ? Groups.acceptMembership : Groups.rejectMembership;

		async.waterfall([
			function (next) {
				method(groupName, uid, next);
			}
		], function (err) {
			Events.log({
				type: 'reject-membership',
				uid: uid,
				ip: req.ip,
				groupName: groupName,
				targetUid: uid,
			});
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
