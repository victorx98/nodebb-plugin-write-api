'use strict';
/* globals module, require */

var posts = require.main.require('./src/posts'),
  User = require.main.require('./src/user'),
  db = require.main.require('./src/database'),
  topics = require.main.require('./src/topics'),
  privileges = require.main.require('./src/privileges'),
  apiMiddleware = require('./middleware'),
  errorHandler = require('../../lib/errorHandler'),
  async = require('async'),
  utils = require('./utils');

function handleSignup(req, res) {
	return topics.etopicSignup(req.params.etid, req.uid, function(err) {
		if (err) {
			return handleError(res, err);
		}
		return res.status(200).json({
			code: 'ok'
		});
	});
};

function handleUnSignup(req, res) {
	return topics.etopicUnsignup(req.params.etid, req.uid, function(err) {
		if (err) {
			return handleError(res, err);
		}
		return res.status(200).json({
			code: 'ok'
		});
	});
};

module.exports = function(middleware) {
  var app = require('express').Router();

  app.route('/:etid/signup')
		.post(apiMiddleware.requireUser, handleSignup);

  app.route('/:etid/unsignup')
		.post(apiMiddleware.requireUser, handleUnSignup);

	return app;
};
