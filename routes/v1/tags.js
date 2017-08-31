'use strict';
/* globals module, require */

var db = require.main.require('./src/database'),
  topics = require.main.require('./src/topics'),
  errorHandler = require('../../lib/errorHandler'),
  apiMiddleware = require('./middleware'),
  async = require('async');

module.exports = function(middleware) {
  var app = require('express').Router();
  app.route('/:tag')
    .post(apiMiddleware.requireUser, function(req, res) {
    	topics.followTag(req.params.tag, req.uid, function(err) {
        errorHandler.handle(err, res);
      });
    })
    .delete(apiMiddleware.requireUser, function(req, res) {
      topics.unfollowTag(req.params.tag, req.uid, function(err) {
        errorHandler.handle(err, res);
      });
    });
  return app;
}
