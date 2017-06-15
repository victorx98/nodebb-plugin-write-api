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
                async.parallel {
                    voteCat: (next) ->
                        Categories.create {
                            name: 'vote',
                            parentCid: parentCat.cid,
                        }, next
                    eventCat: (next) ->
                        Categories.create {
                            name: 'event',
                            parentCid: parentCat.cid,
                        }, next
                    discussCat: (next) ->
                        Categories.create {
                            name: 'discuss',
                            parentCid: parentCat.cid,
                        }, next
                }, next
        ], (err, ret) ->
            group.mainCid = parentCat.cid
            return callback(err, obj)

)(exports)
