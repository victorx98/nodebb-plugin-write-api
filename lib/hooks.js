var Categories, Posts, Topics, async, privileges;

Posts = require.main.require('./src/posts');

Topics = require.main.require('./src/topics');

Categories = require.main.require('./src/categories');

privileges = require.main.require('./src/privileges');

async = require('async');

(function(Hooks) {
  Hooks.filter = {};
  Hooks.action = {};
  return Hooks.filter.groupCreate = function(obj, callback) {
    var data, groupData, parentCat;
    groupData = obj.groupData, data = obj.data;
    if (!obj.isClub) {
      return;
    }
    parentCat = null;
    return async.waterfall([
      function(next) {
        return Categories.create({
          name: data.name,
          description: data.description
        }, next);
      }, function(category, next) {
        var removePrivileges;
        parentCat = category;
        removePrivileges = ['topics:read', 'topics:create', 'topics:reply', 'posts:edit', 'posts:delete', 'topics:delete', 'upload:post:image'];
        return privileges.rescind(removePrivileges, parentCat.cid, 'registered-users', next);
      }, function(next) {
        var removePrivileges;
        removePrivileges = ['find', 'read', 'topics:read'];
        return privileges.rescind(removePrivileges, parentCat.cid, 'guests', next);
      }, function(next) {
        var defaultPrivileges;
        defaultPrivileges = ['find', 'read', 'topics:read', 'topics:create', 'topics:reply', 'posts:edit', 'posts:delete', 'topics:delete', 'upload:post:image'];
        return privileges.give(defaultPrivileges, parentCat.cid, data.name, next);
      }, function(next) {
        return async.parallel({
          voteCat: function(next) {
            return Categories.create({
              name: 'vote',
              parentCid: parentCat.cid
            }, next);
          },
          noticeCat: function(next) {
            return Categories.create({
              name: 'notice',
              parentCid: parentCat.cid
            }, next);
          },
          discussCat: function(next) {
            return Categories.create({
              name: 'discuss',
              parentCid: parentCat.cid
            }, next);
          }
        }, next);
      }
    ], function(err, ret) {
      groupData.mainCid = parentCat.cid;
      return callback(err, obj);
    });
  };
})(exports);
