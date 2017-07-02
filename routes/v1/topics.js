'use strict';
/* globals module, require */

var Topics = require.main.require('./src/topics'),
	Posts = require.main.require('./src/posts'),
	apiMiddleware = require('./middleware'),
	errorHandler = require('../../lib/errorHandler'),
	utils = require('./utils'),
	winston = require.main.require('winston');

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
					pictures: req.body.pictures || [],
					uid: req.user.uid,
					timestamp: req.body.timestamp,
					thumb: req.body.thumb,
					etopic: req.body.etopic,
					pollData: req.body.pollData
				};

			Topics.post(payload, function(err, data) {
				return errorHandler.handle(err, res, data);
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
				errorHandler.handle(err, res, returnData);
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
				pictures: req.body.pictures || [],
				etopic: req.body.etopic,
				pollData: req.body.pollData
			};

			// Maybe a "set if available" utils method may come in handy
			if (req.body.handle) { payload.handle = req.body.handle; }
			if (req.body.title) { payload.title = req.body.title; }
			if (req.body.thumb) { payload.thumb = req.body.thumb; }
			if (req.body.tags) { payload.tags = req.body.tags; }

			Posts.edit(payload, function(err, returnData) {
				errorHandler.handle(err, res, returnData);
			});
		});

	app.route('/:tid/follow')
		.post(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.follow(req.params.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
			Topics.unfollow(req.params.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
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
