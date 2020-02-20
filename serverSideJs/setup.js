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

	socket.on('chat message', function(msg){
		console.log('message: ' + msg);
	});
}