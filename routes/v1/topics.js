'use strict';
/* globals module, require */

var Topics = require.main.require('./src/topics'),
	PostTools = require.main.require('./src/postTools'),
	apiMiddleware = require('../../middleware'),
	errorHandler = require('../../lib/errorHandler'),
	utils = require('./utils');


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
					content:req.body.content,
					uid: req.user.uid
				};

			Topics.post(payload, function(err, data) {
				if (err) { return errorHandler.handle(err, res); }

				res.status(200).json({
					status: 'ok',
					data: {
						topic: data.topicData,
						post: data.postData
					}
				});
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
				options: {}
			};

			// Maybe a "set if available" utils method may come in handy
			if (req.body.handle) { payload.handle = req.body.handle; }
			if (req.body.title) { payload.title = req.body.title; }
			if (req.body.topic_thumb) { payload.options.topic_thumb = req.body.topic_thumb; }
			if (req.body.tags) { payload.options.tags = req.body.tags; }

			PostTools.edit(payload, function(err) {
				errorHandler.handle(err, res);
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
					content: req.body.content
				};

			if (req.body.toPid) { payload.toPid = req.body.toPid; }

			Topics.reply(payload, function(err, returnData) {
				errorHandler.handle(err, res, returnData);
			});
		});

	app.route('/follow')
		.post(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['tid'], req, res)) {
				return false;
			}

			Topics.follow(req.body.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		})
		.delete(apiMiddleware.requireUser, function(req, res) {
			if (!utils.checkRequired(['tid'], req, res)) {
				return false;
			}

			Topics.unfollow(req.body.tid, req.user.uid, function(err) {
				errorHandler.handle(err, res);
			});
		});

	return app;
};