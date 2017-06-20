Posts = require.main.require('./src/posts')
Topics = require.main.require('./src/topics')
Categories = require.main.require('./src/categories')
privileges = require.main.require('./src/privileges')
async = require('async')

((Hooks) ->
    Hooks.filter = {}
    Hooks.action = {}

    Hooks.filter.groupCreate = (obj, callback)->
        {group, data} = obj
        return callback(null, obj) if !data.isClub
        parentCat = null

        async.waterfall [
            (next) ->
                # create Uni category
                Categories.create {
                    name: data.name,
                    description: data.description,
                }, next
            (category, next) ->
                parentCat = category
                removePrivileges = [
                    'topics:read', 'topics:create',
                    'topics:reply', 'posts:edit',
                    'posts:delete', 'topics:delete',
                    'upload:post:image'
                ]

                privileges.categories.rescind removePrivileges,
                parentCat.cid, 'registered-users', next

            (next) ->
                removePrivileges = [
                    'find', 'read', 'topics:read'
                ]
                privileges.categories.rescind removePrivileges,
                parentCat.cid, 'guests', next

            (next) ->
                defaultPrivileges = ['find', 'read', 'topics:read',
                'topics:create', 'topics:reply',
                'posts:edit', 'posts:delete', 'topics:delete',
                'upload:post:image', 'etopic:create']
                privileges.categories.give defaultPrivileges,
                parentCat.cid, data.name, next

            (next) ->
                # create children categories
                async.waterfall [
                    (next) ->
                        Categories.create {
                            name: '活动',
                            isEvent: true,
                            parentCid: parentCat.cid,
                        }, next
                    (cat, next) ->
                        Categories.create {
                            name: '投票',
                            isVote: true,
                            parentCid: parentCat.cid,
                        }, next
                    (cat, next) ->
                        Categories.create {
                            name: '话题',
                            isDiscuss: true,
                            parentCid: parentCat.cid,
                        }, next
                ], next
        ], (err, ret) ->
            group.mainCid = parentCat.cid
            return callback(err, obj)

    Hooks.filter.categoryCreate = (obj, callback) ->
        {category, data} = obj
        category.isEvent = data.isEvent
        category.isVote = data.isVote
        category.isDiscuss = data.isDiscuss
        return callback(null, obj)

)(exports)
