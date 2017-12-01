$.post('/api/v1/groups', {
    name: 'test-group-07',
    isClub: true,
    password: '123456'
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/groups/test-group-07', {
    brief: 'brief',
    password: '12345678'
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/groups/test-group-07/password', {
    password: '123456789999999999'
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/groups/test-group-07/password', {
    password: ''
}).then(function (res) {
    console.log(res);
});

// join group with password
$.post('/api/v1/groups/test-group-07/membership', {
    password: 'xxx'
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/groups/test-group-07/membership', {
    password: '123456'
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/groups/test-group-07/self_intro', {
    intro: '12345654321'
}).then(function (res) {
    console.log(res);
});

$.get('/api/v1/groups/get_intro', {
    userId: '1',
    groupName: 'test-group-07'
}).then(function (res) {
    console.log(res);
});

$.post('/api/v1/groups/test-group-07/uploadthumbnail', {
    url: 'https://mentorxmop.s3.amazonaws.com/mop_upload/ebfda620-a3e0-4dba-b893-edcd1a3c6ea3'
}).then(function (res) {
    console.log(res);
});
