'use strict';

let io;

module.exports = function (IO){
	io = IO;
	io.on('connection', onConnection);
}

function onConnection(socket){
	console.log('a user connected');

	socket.on('disconnect', function(){
		console.log('user disconnected');
	});

	socket.on('connect to user', function(obj){
		obj.ip;
		console.log("port: "+obj.port);
	});

	socket.on('message from browser', function(msg){
		console.log('message from browser: ' + msg);
	});
}