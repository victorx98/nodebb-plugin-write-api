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

        async.waterfall [
            (next) ->
                createCategory {
                    name: data.name,
                    description: data.description,
                    groupSlug: group.slug,
                }, data.name, next
        ], (err, cat) ->
            group.cid = cat.cid
            group.brief = data.brief || ''

            return callback(err, obj)

    Hooks.filter.categoryCreate = (obj, callback) ->
        {category, data} = obj
        category.groupSlug = data.groupSlug
        return callback(null, obj)

)(exports)
