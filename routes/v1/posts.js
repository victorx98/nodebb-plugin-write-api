'use strict';
/* globals module, require */

var posts = require.main.require('./src/posts'),
  User = require.main.require('./src/user'),
  db = require.main.require('./src/database'),
  apiMiddleware = require('./middleware'),
  errorHandler = require('../../lib/errorHandler'),
  async = require('async'),
  utils = require('./utils');


module.exports = function(middleware) {
  var app = require('express').Router();

  app.route('/:pid')
    .put(apiMiddleware.requireUser, function(req, res) {
      if (!utils.checkRequired(['content'], req, res)) {
        return false;
      }

      var payload = {
        uid: req.user.uid,
        pid: req.params.pid,
        content: req.body.content,
        options: {}
      };

      if (req.body.handle) { payload.handle = req.body.handle; }
      if (req.body.title) { payload.title = req.body.title; }
      if (req.body.topic_thumb) { payload.options.topic_thumb = req.body.topic_thumb; }
      if (req.body.tags) { payload.options.tags = req.body.tags; }

      posts.edit(payload, function(err) {
        errorHandler.handle(err, res);
      })
    })
    .delete(apiMiddleware.requireUser, function(req, res) {
      posts.delete(req.params.pid, req.user.uid, function(err) {
        errorHandler.handle(err, res);
      });
    });

  app.route('/:pid/bookmark').post(apiMiddleware.requireUser, function(req, res) {
    posts.bookmark(req.params.pid, req.user.uid, function(err) {
      errorHandler.handle(err, res);
    })
  });
  app.route('/:pid/unbookmark').post(apiMiddleware.requireUser, function(req, res) {
    posts.unbookmark(req.params.pid, req.user.uid, function(err) {
      errorHandler.handle(err, res);
    })
  });
  app.route('/:pid/bookmarked-users').get(apiMiddleware.requireUser, function(req, res) {
    var pid = req.params.pid;
    async.waterfall([
      function(next) {
        db.getSetMembers('pid:'+pid+':users_bookmarked', next)
      },
      function(members, next) {
        User.getUsersData(members, next);
      }
    ], function(err, data) {
      errorHandler.handle(err, res, data);
    })
  });

  app.route('/:pid/upvote').post(apiMiddleware.requireUser, function(req, res) {
    posts.upvote(req.params.pid, req.user.uid, function(err, data) {
			errorHandler.handle(err, res, data);
    });
  });
	app.route('/:pid/downvote').post(apiMiddleware.requireUser, function(req, res) {
    posts.downvote(req.params.pid, req.user.uid, function(err, data) {
      errorHandler.handle(err, res, data);
    });
  });
	app.route('/:pid/unvote').post(apiMiddleware.requireUser, function(req, res) {
    posts.unvote(req.params.pid, req.user.uid, function(err, data) {
      errorHandler.handle(err, res, data);
    });
  });

  return app;
};
