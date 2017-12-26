Posts = require.main.require('./src/posts')
Topics = require.main.require('./src/topics')
Categories = require.main.require('./src/categories')
privileges = require.main.require('./src/privileges')
db = require.main.require('./src/database')
winston = require.main.require('winston')
async = require('async')

((Hooks) ->
    Hooks.filter = {}
    Hooks.action = {}

    setCategoryPrivileges = (category, groupName, callback) ->
        async.waterfall [
            (next) ->
                # default public group user can find and read topics;
                removePrivileges = [
                    'read',
                    'topics:read',
                    'topics:create',
                    'topics:reply', 'topics:tag', 'posts:edit',
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

        cat = null
        async.waterfall [
            (next) ->
                createCategory {
                    name: data.name,
                    description: data.description,
                    groupSlug: group.slug,
                    groupName: group.name
                }, data.name, next
            (_cat, next) ->
                cat = _cat
                if data.password
                    key = 'group:password'
                    db.setObjectField key, group.name, data.password, next
                else
                    next null
        ], (err) ->
            group.cid = cat.cid
            group.brief = data.brief || ''
            group.hasPassword = data.hasPassword || !!data.password

            return callback(err, obj)

    Hooks.filter.categoryCreate = (obj, callback) ->
        {category, data} = obj
        category.groupSlug = data.groupSlug
        category.groupName = data.groupName
        return callback(null, obj)

    Hooks.action.groupUpdate = (obj)->
        {oldName, values} = obj
        name = values.name || oldName
        payload = {}

        if values.hasOwnProperty('brief')
            payload.brief = values.brief || ''

        if values.hasOwnProperty('hasPassword')
            payload.hasPassword = !!values.hasPassword
        else if values.hasOwnProperty('password')
            payload.hasPassword = true

        updateCategoryInfo = (cb) ->
          async.waterfall [
            (next)->
              db.getObjectFields 'group:'+name, ['cid', 'slug'], next
            (data, next)->
              if data.cid
                db.setObject "category:#{data.cid}",
                {groupName: name, groupSlug: data.slug}, next
              else
                next()
          ], cb

        async.parallel [
            (next)->
                db.setObject 'group:' + name, payload, next
            (next)->
                if values.password
                    key = 'group:password'
                    db.setObjectField key, name, values.password, next
                else
                    next null

            updateCategoryInfo
        ], (err)->
            if err
                winston.error(err)


)(exports)
