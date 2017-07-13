Posts = require.main.require('./src/posts')
Topics = require.main.require('./src/topics')
Categories = require.main.require('./src/categories')
privileges = require.main.require('./src/privileges')
async = require('async')

((Hooks) ->
    Hooks.filter = {}
    Hooks.action = {}

    setCategoryPrivileges = (category, groupName, callback) ->
        async.waterfall [
            (next) ->
                # default public group user can find and read topics;
                removePrivileges = [
                    # 'topics:read',
                    'topics:create',
                    'topics:reply', 'posts:edit',
                    'posts:delete', 'topics:delete',
                    'upload:post:image'
                ]

                privileges.categories.rescind removePrivileges,
                category.cid, 'registered-users', next
            (next) ->
                removePrivileges = [
                    'find', 'read', 'topics:read'
                ]
                privileges.categories.rescind removePrivileges,
                category.cid, 'guests', next
            (next) ->
                defaultPrivileges = ['find', 'read', 'topics:read',
                'topics:create', 'topics:reply',
                'posts:edit', 'posts:delete', 'topics:delete',
                'upload:post:image',
                'etopic:create', 'hiring:create', 'poll:create']

                privileges.categories.give defaultPrivileges,
                category.cid, groupName, next
        ], callback

    createCategory = (data, groupName, callback) ->
        Categories.create data, (err, category)->
            return callback err if err
            setCategoryPrivileges category, groupName, (err)->
                return callback err, category

    Hooks.filter.groupCreate = (obj, callback)->
        {group, data} = obj
        return callback(null, obj) if !data.isClub
        parentCat = null

        async.waterfall [
            (next) ->
                createCategory {
                    name: data.name,
                    description: data.description
                }, data.name, next

            (category, next) ->
                # create children categories
                parentCat = category

                async.waterfall [
                    (next) ->
                        createCategory {
                            name: '活动',
                            isEvent: true,
                            parentCid: parentCat.cid,
                        }, data.name, next
                    (cat, next) ->
                        createCategory {
                            name: '投票',
                            isPoll: true,
                            parentCid: parentCat.cid,
                        }, data.name, next
                    (cat, next) ->
                        createCategory {
                            name: '二手物品',
                            isSale: true,
                            parentCid: parentCat.cid,
                        }, data.name, next
                ], next
        ], (err, ret) ->
            group.mainCid = parentCat.cid
            return callback(err, obj)

    Hooks.filter.categoryCreate = (obj, callback) ->
        {category, data} = obj
        category.isEvent = data.isEvent
        category.isPoll = data.isPoll
        category.isSale = data.isSale
        return callback(null, obj)

)(exports)
