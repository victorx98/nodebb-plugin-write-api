$.ajax({
    url: "/register",
    method: 'post',
    headers: {
        'x-csrf-token': config.csrf_token
    },
    data: {
        email: 'test-river-01@gmail.com',
        username: 'test-river-01',
        password: '123456'
    }
});


$.ajax({
    url: "/register",
    method: 'post',
    headers: {
        'x-csrf-token': config.csrf_token
    },
    data: {
        email: 'test-river-02@gmail.com',
        username: 'test-river-02',
				registerFrom: 'mobile',
        password: '123456'
    }
});

socket.emit('user.emailConfirm', {}, function(err, data){
    console.log(err, data);
});

$.ajax({
    url: "/api/v1/users/39",
    method: 'put',
    headers: {
        'x-csrf-token': config.csrf_token
    },
    data: {
        username: 'riveryang',
				firstName: '先生3',
				lastName: '杨'
    }
});

$.ajax({
    url: "/api/v1/users/39",
    method: 'put',
    headers: {
        'x-csrf-token': config.csrf_token
    },
    data: {
        rename: 'riveryang',
				firstName: '先生3',
				lastName: '杨'
    }
});
