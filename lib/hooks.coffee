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
        parentCat = filesCat = linksCat = tweetsCat = null

        async.waterfall [
            (next) ->
                createCategory {
                    name: data.name,
                    description: data.description,
                    groupSlug: group.slug,
                }, data.name, next

            (category, next) ->
                # create children categories
                parentCat = category

                async.waterfall [
                    (next) ->
                        createCategory {
                            name: 'Files',
                            isFiles: true,
                            parentCid: parentCat.cid,
                            groupSlug: group.slug
                        }, data.name, next
                    (cat, next) ->
                        filesCat = cat
                        createCategory {
                            name: 'Links',
                            isLinks: true,
                            parentCid: parentCat.cid,
                            groupSlug: group.slug
                        }, data.name, next
                    (cat, next) ->
                        linksCat = cat
                        createCategory {
                            name: 'Tweets',
                            isTweets: true,
                            parentCid: parentCat.cid,
                            groupSlug: group.slug
                        }, data.name, next
                ], next
        ], (err, cat) ->
            tweetsCat = cat
            group.mainCid = parentCat.cid
            group.filesCid = filesCat.cid
            group.linksCid = linksCat.cid
            group.tweetsCid = tweetsCat.cid
            group.description2 = data.description2

            return callback(err, obj)

    Hooks.filter.categoryCreate = (obj, callback) ->
        {category, data} = obj
        category.isFiles = data.isFiles
        category.isLinks = data.isLinks
        category.isTweets = data.isTweets
        category.groupSlug = data.groupSlug
        return callback(null, obj)

)(exports)
