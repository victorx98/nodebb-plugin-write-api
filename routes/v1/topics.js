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
							Posts.addAttachments(returnData.postData.pid, 'document', req.body.documents, next);
						} else if (req.body.links) {
							Posts.addAttachments(returnData.postData.pid, 'link', req.body.links, next);
						} else if (req.body.audios) {
							Posts.addAttachments(returnData.postData.pid, 'audio', req.body.audios, next);
						} else if (req.body.audio) {
							Posts.addAttachments(returnData.postData.pid, 'audio', [req.body.audio], next);
						} else {
							next();
						}
					},
					function (next) {
						if (req.body.documents) {
							returnData.postData.documents = req.body.documents;
							db.setObjectField('post:'+returnData.postData.pid, 'documents', req.body.documents, next);
						} else if (req.body.links) {
							returnData.postData.links = req.body.links;
							db.setObjectField('post:'+returnData.postData.pid, 'links', req.body.links, next);
						} else if (req.body.audios) {
							returnData.postData.audios = req.body.audios;
							db.setObjectField('post:'+returnData.postData.pid, 'audios', req.body.audios, next);
						} else if (req.body.audio) {
							returnData.postData.audio = req.body.audio;
							db.setObjectField('post:'+returnData.postData.pid, 'audio', req.body.audio, next);
						} else {
							next();
						}
					},
					function (next) {
						db.getObjectField('category:' + returnData.topicData.category.cid, 'groupSlug', function (err, groupSlug) {
							if (err) return errorHandler.handle(err, res, returnData);
							if (groupSlug) {
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

				async.parallel([
					function (next) {
						if (req.body.documents) {
							Posts.addAttachments(returnData.pid, 'document', req.body.documents, next);
						} else if (req.body.links) {
							Posts.addAttachments(returnData.pid, 'link', req.body.links, next);
						} else if (req.body.audios) {
							Posts.addAttachments(returnData.pid, 'audio', req.body.audios, next);
						} else if (req.body.audio) {
							Posts.addAttachments(returnData.pid, 'audio', [req.body.audio], next);
						} else {
							next();
						}
					},
					function (next) {
						if (req.body.documents) {
							returnData.documents = req.body.documents;
							db.setObjectField('post:'+returnData.pid, 'documents', req.body.documents, next);
						} else if (req.body.links) {
							returnData.links = req.body.links;
							db.setObjectField('post:'+returnData.pid, 'links', req.body.links, next);
						} else if (req.body.audios) {
							returnData.audios = req.body.audios;
							db.setObjectField('post:'+returnData.pid, 'audios', req.body.audios, next);
						} else if (req.body.audio) {
							returnData.audio = req.body.audio;
							db.setObjectField('post:'+returnData.pid, 'audio', req.body.audio, next);
						} else {
							next();
						}
					},
					function (next) {
						db.getObjectField('category:' + returnData.cid, 'groupSlug', function (err, groupSlug) {
							if (err) return errorHandler.handle(err, res, returnData);
							if (groupSlug) {
								async.parallel([
									function (next) {
										db.sortedSetRemove("topics:recent", returnData.tid, next);
									},
									function (next) {
										db.sortedSetRemove("uid:"+req.uid+":topics", returnData.tid, next);
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

			var payload = {
				uid: req.user.uid,
				pid: req.body.pid,
				content: req.body.content,
				etopic: req.body.etopic,
				pollData: req.body.pollData,
				hiring: req.body.hiring
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
						var k,f,c;
						if (req.body.etopic) {
							k = 'etid';
							f = function (etid, cb) {
								Topics.getEventTopic(etid, req.uid, cb);
							};
							c = 'etopic';
						} else if (req.body.hiring) {
							k = 'htid';
							f = Topics.getHiringTopic;
							c = 'hiring';
						} else {
							return next();
						}
						async.waterfall([
							function (next) {
								return db.getObjectField('topic:'+returnData.topic.tid, k, next);
							},
							function (kid, next) {
								if (!kid) return next();
								f(kid, next);
							}
						], function (err, data) {
							returnData.topic[c] = data;
							next(err);
						});
					},
					function (next) {
						async.parallel([
							function (next) {
								if (req.body.documents) {
									Posts.addAttachments(returnData.post.pid, 'document', req.body.documents, next);
								} else if (req.body.links) {
									Posts.addAttachments(returnData.post.pid, 'link', req.body.links, next);
								} else if (req.body.audios) {
									Posts.addAttachments(returnData.post.pid, 'audio', req.body.audios, next);
								} else if (req.body.audio) {
									Posts.addAttachments(returnData.post.pid, 'audio', [req.body.audio], next);
								} else {
									next();
								}
							},
							function (next) {
								if (req.body.documents) {
									returnData.post.documents = req.body.documents;
									db.setObjectField('post:'+returnData.post.pid, 'documents', req.body.documents, next);
								} else if (req.body.links) {
									returnData.post.links = req.body.links;
									db.setObjectField('post:'+returnData.post.pid, 'links', req.body.links, next);
								} else if (req.body.audios) {
									returnData.post.audios = req.body.audios;
									db.setObjectField('post:'+returnData.post.pid, 'audios', req.body.audios, next);
								} else if (req.body.audio) {
									returnData.post.audio = req.body.audio;
									db.setObjectField('post:'+returnData.post.pid, 'audio', req.body.audio, next);
								} else {
									next();
								}
							},
							function (next) {
								db.getObjectField('category:' + returnData.topic.cid, 'groupSlug', function (err, groupSlug) {
									if (err) return errorHandler.handle(err, res, returnData);
									if (groupSlug) {
										async.parallel([
											function (next) {
												db.sortedSetRemove("topics:recent", returnData.topic.tid, next);
											},
											function (next) {
												db.sortedSetRemove("uid:"+req.uid+":topics", returnData.topic.tid, next);
											}
										], next);
									} else {
										next();
									}
								});
							}
						], next);
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
