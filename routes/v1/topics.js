'use strict';
/* globals module, require */

var Topics = require.main.require('./src/topics'),
	Posts = require.main.require('./src/posts'),
	db = require.main.require('./src/database'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	utils = require('./utils'),
	winston = require.main.require('winston'),
	async = require.main.require('async'),
	validator = module.parent.require('validator');

module.exports = function(middleware) {
	var app = require('express').Router();

	app.route('/')
		.post(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['cid', 'title', 'content'], req, res)) {
				return false;
			}
			if (req.body.link) {
				if (!validator.isURL(req.body.link)) {
					return callback(new Error('[[error:invalid-data]]'));
				}
			}

			var payload = {
				cid: req.body.cid,
				title: req.body.title,
				content: req.body.content,
				tags: req.body.tags || [],
				uid: req.user.uid,
				timestamp: req.body.timestamp,
				thumb: req.body.thumb,
				etopic: req.body.etopic,
				hiring: req.body.hiring,
				pollData: req.body.pollData
			};

			Topics.post(payload, function(err, returnData) {
				if (err) return errorHandler.handle(err, res, returnData);
				async.parallel([
					function (next) {
						if (req.body.documents) {
							returnData.topicData.documents = req.body.documents;
							db.setObjectField('topic:'+returnData.topicData.tid, 'documents', req.body.documents, next);
						} else if (req.body.link) {
							returnData.topicData.link = req.body.link;
							db.setObjectField('topic:'+returnData.topicData.tid, 'link', req.body.link, next);
						} else {
							next();
						}
					},
					function (next) {
						var fields = ['isFiles', 'isLinks', 'isTweets'];
						db.getObjectFields('category:' + returnData.topicData.category.cid, fields, function (err, catData) {
							if (err) return errorHandler.handle(err, res, returnData);
							if (catData.isFiles ||
								catData.isLinks ||
								catData.isTweets) {
								async.parallel([
									function (next) {
										db.sortedSetRemove("topics:recent", returnData.topicData.tid, next);
									},
									function (next) {
										db.sortedSetRemove("uid:"+req.uid+":topics", returnData.topicData.tid, next);
									}
								], next);
							} else {
								next();
							}
						});
					}
				], function (err) {
					errorHandler.handle(err, res, returnData);
				});
			});
		});

	app.route('/:tid')
		.post(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			if (!utils.checkRequired(['content'], req, res)) {
				return false;
			}

			var payload = {
					tid: req.params.tid,
					uid: req.user.uid,
					req: req,	// For IP recording
					content: req.body.content,
					timestamp: req.body.timestamp
				};

			if (req.body.toPid) { payload.toPid = req.body.toPid; }

			Topics.reply(payload, function(err, returnData) {
				if (err) return errorHandler.handle(err, res, returnData);
				if (req.body.audio) {
					db.setObjectField('post:'+returnData.pid, 'audio', req.body.audio, function (err) {
						returnData.audio = req.body.audio;
						errorHandler.handle(err, res, returnData);
					});
				} else {
					errorHandler.handle(err, res, returnData);	
				}
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.delete(req.params.tid, req.params._uid, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.put(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['pid', 'content'], req, res)) {
				return false;
			}
			if (req.body.link) {
				if (!validator.isURL(req.body.link)) {
					return callback(new Error('[[error:invalid-data]]'));
				}
			}

			var payload = {
				uid: req.user.uid,
				pid: req.body.pid,
				content: req.body.content,
				etopic: req.body.etopic,
				pollData: req.body.pollData
			};

			// Maybe a "set if available" utils method may come in handy
			if (req.body.handle) { payload.handle = req.body.handle; }
			if (req.body.title) { payload.title = req.body.title; }
			if (req.body.thumb) { payload.thumb = req.body.thumb; }
			if (req.body.tags) { payload.tags = req.body.tags; }

			Posts.edit(payload, function(err, returnData) {
				if (err) return errorHandler.handle(err, res, returnData);
				async.parallel([
					function (next) {
						if (req.body.documents) {
							returnData.topic.documents = req.body.documents;
							db.setObjectField('topic:'+returnData.topic.tid, 'documents', req.body.documents, next);
						} else if (req.body.link) {
							returnData.topic.link = req.body.link;
							db.setObjectField('topic:'+returnData.topic.tid, 'link', req.body.link, next);
						} else {
							next();
						}
					}
				], function (err) {
					errorHandler.handle(err, res, returnData);
				});
			});
		});

	app.route('/:tid/follow')
		.post(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.follow(req.params.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res, err ? null: {tid: req.params.tid, followed: true});
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.unfollow(req.params.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res, err ? null: {tid: req.params.tid, unfollowed: true});
			});
		});

	app.route('/:tid/tags')
		.post(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			if (!utils.checkRequired(['tags'], req, res)) {
				return false;
			}

			Topics.updateTags(req.params.tid, req.body.tags, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.deleteTopicTags(req.params.tid, function(err) {
				errorHandler.handle(err, res);
			});
		});

	// **DEPRECATED** Do not use.
	app.route('/follow')
		.post(apiMiddleware.requireUser, function(req, res) {
			winston.warn('[write-api] /api/v1/topics/follow route has been deprecated, please use /api/v1/topics/:tid/follow instead.');
			if (!utils.checkRequired(['tid'], req, res)) {
				return false;
			}

			Topics.follow(req.body.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, function(req, res) {
			winston.warn('[write-api] /api/v1/topics/follow route has been deprecated, please use /api/v1/topics/:tid/follow instead.');
			if (!utils.checkRequired(['tid'], req, res)) {
				return false;
			}

			Topics.unfollow(req.body.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		});

	return app;
};
