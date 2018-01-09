// create group
// db.getCollection('objects').find({_key: /group:test/})
//
$.post('/api/v1/groups', {
    name: 'test-group-02',
    isClub: true
}).then(function (res) {
    console.log(res);
});

// create topic in the group category.
// db.getCollection('objects').find({_key: /topic:\d+$/}).sort({_id: -1})
// db.getCollection('objects').find({_key: 'post:213:documents'})
// db.getCollection('objects').find({_key: /category:15:(documents|links|audios)/})
// db.getCollection('objects').find({_key: 'document:1'})
// db.getCollection('objects').find({_key: /post:\d+:(audios|documents|pictures|links)/}).sort({_id: -1})
$.post('/api/v1/topics', {
    cid: 15,
    title: 'group topic title test 01',
    content: 'group topic content test 01',
    documents: [{
        filename: 'abc.txt',
        filepath: '/abc.txt'
    }, {
        filename: 'edf.txt',
        filepath: '/edf.txt'
    }]
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/topics', {
    cid: 15,
    title: 'group topic title test 02',
    content: 'group topic content test 02',
    links: [{
        link: 'https://v2mm.tech',
        name: 'v2mm'
    }, {
        link: 'https://github.com',
        name: 'github'
    }]
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/topics', {
    cid: 15,
    title: 'group topic title test 02',
    content: 'group topic content test 02',
    audio: {
        src: 'https://v2mm.tech/v2mm.mp3',
        name: 'v2mm.mp3'
    }
}).then(function (res) {
    console.log(res);
});

// jobType & h1bSponsor
// db.getCollection('objects').find({_key: /^hiring:(fulltime|parttime|intern|h1bSponsor:true|h1bSponsor:false)/})
$.post('/api/v1/topics', {
    cid: 15,
    title: 'hiring topic fulltime 1111',
    content: 'hiring topic content test 02',
    hiring: {
				startDate: "2018-01-01 08:00:00",
				endDate: "2018-01-11 08:00:00",
				jobType: 'fulltime',
				company: 'Google inc',
        location: "Newyork, US"
    }
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/topics', {
    cid: 15,
    title: 'hiring topic h1bSponsor 1111',
    content: 'hiring topic content test 02',
    hiring: {
				startDate: "2018-01-01 08:00:00",
				endDate: "2018-01-11 08:00:00",
				h1bSponsor: true,
				company: 'Google inc',
        location: "Newyork, US"
    }
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/topics', {
    cid: 15,
    title: 'hiring topic h1bSponsor 222',
    content: 'hiring topic content test 02',
    hiring: {
				startDate: "2018-01-01 08:00:00",
				endDate: "2018-01-11 08:00:00",
				h1bSponsor: false,
				company: 'Google inc',
        location: "Newyork, US"
    }
}).then(function (res) {
    console.log(res);
});

// reply topic
$.post('/api/v1/topics/115', {
    cid: 15,
    content: 'group topic content test 02',
    documents: [{
        filename: 'abc-reply.txt',
        filepath: '/abc-reply.txt'
    }, {
        filename: 'edf-reply.txt',
        filepath: '/edf-reply.txt'
    }]
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/topics/115', {
    cid: 15,
    content: 'group topic content test 02',
    links: [{
        link: 'https://v2mm.tech/topic/3',
        name: 'v2mm-reply'
    }, {
        link: 'https://github.com',
        name: 'github-reply'
    }]
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/topics/115', {
    cid: 15,
    content: 'group topic content test 02',
    audio: {
        src: 'https://v2mm.tech/v2mm-reply.mp3',
        name: 'v2mm-reply.mp3'
    }
}).then(function (res) {
    console.log(res);
});

// edit topic/post
$.ajax({
    method: 'put',
    url: '/api/v1/topics/113',
    data: {
        cid: 15,
        pid: 222,
        content: 'group topic content test 03 --edited',
        documents: [{
            filename: 'abc-edit.txt',
            filepath: '/abc-edit.txt'
        }, {
            filename: 'edf-edit.txt',
            filepath: '/edf-edit.txt'
        }]
    }
}).then(function (res) {
    console.log(res);
});

$.ajax({
    method: 'put',
    url: '/api/v1/topics/114',
    data: {
        cid: 15,
        pid: 223,
        content: 'group topic content test 03 --edited',
        links: [{
            link: 'https://v2mm.tech/topic/3',
            name: 'v2mm-edit'
        }, {
            link: 'https://github.com',
            name: 'github-edit'
        }]
    }
}).then(function (res) {
    console.log(res);
});

$.ajax({
    method: 'put',
    url: '/api/v1/topics/115',
    data: {
        cid: 15,
        pid: 224,
        content: 'group topic content test 03 --edited',
        audio: {
            src: 'https://v2mm.tech/v2mm-edit.mp3',
            name: 'v2mm-edit.mp3'
        }
    }
}).then(function (res) {
    console.log(res);
});

// edit post which is not mainPost
$.ajax({
    method: 'put',
    url: '/api/v1/topics/115',
    data: {
        cid: 15,
        pid: 226,
        content: 'group topic content test 03 --edited',
        documents: [{
            filename: 'abc-edit-2.txt',
            filepath: '/abc-edit-2.txt'
        }, {
            filename: 'edf-edit-2.txt',
            filepath: '/edf-edit-2.txt'
        }]
    }
}).then(function (res) {
    console.log(res);
});

// delete topic
// db.getCollection('objects').find({_key: /category:\d+:(link|document)/})
socket.emit('topics.delete', {
    tids: [113],
    cid: 15
}, function(err, data){
    console.log(err, data);
});

socket.emit('topics.restore', {
    tids: [113],
    cid: 15
}, function(err, data){
    console.log(err, data);
});
