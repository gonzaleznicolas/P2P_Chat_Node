'use strict';

let io;
let ioClient

module.exports = function (IO, IO_CLIENT){
	io = IO;
	io.on('connection', onConnection);

	ioClient = IO_CLIENT;
}

function onConnection(socket){
	console.log('a user connected');

	socket.on('disconnect', function(){
		console.log('user disconnected');
	});

	socket.on('connect to user', function(obj){
		console.log("Going to try to connect to server running at ip " + 
			obj.ip + " on port: "+obj.port);

		let socketToServer = ioClient.connect("http://localhost:"+obj.port+"/", {
			reconnection: true
		});

		socketToServer.on('connect', function(){
			console.log("I successfully connected to server running on port.")
			console.log("I will send it a message...")
			socketToServer.emit("message from browser", "message sent from server to server")
		});

	});

	socket.on('message from browser', function(msg){
		console.log('message from browser: ' + msg);
	});
}