var app = require('express')();
var http = require('http').createServer(app);
require('./serverSideJs/setup.js')(require('socket.io')(http));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});