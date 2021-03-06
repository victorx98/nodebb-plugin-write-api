'use strict';
/* globals module */

var crypto = require('crypto');
// var bcrypt = require('bcrypt');

function wxBizDataCrypt (appId, sessionKey) {
  this.appId = appId;
  this.sessionKey = sessionKey;
}

wxBizDataCrypt.prototype.decryptData = function (encryptedData, iv) {
  // base64 decode
  var sessionKey = new Buffer(this.sessionKey, 'base64');
  var encryptedData64 = new Buffer(encryptedData, 'base64');
  var iv64 = new Buffer(iv, 'base64')
  var decoded;

  try {
    // 解密
    var decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, iv64);
    // 设置自动 padding 为 true，删除填充补位
    decipher.setAutoPadding(true);
    decoded = decipher.update(encryptedData64, 'binary', 'utf8');
    decoded += decipher.final('utf8');

    decoded = JSON.parse(decoded);
  } catch (err) {
    throw new Error('Illegal Buffer');
  }

  if (decoded.watermark.appid !== this.appId) {
    throw new Error('Illegal Buffer');
  }

  return decoded;
}

module.exports = wxBizDataCrypt;
