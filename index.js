let express = require('express');
let app = express();
let http = require('http').createServer(app);
let ioServer = require('socket.io')(http);
let ioClient = require('socket.io-client');
let chatLogic = require('./serverSideJs/chatLogic.js');

const port = parseInt(process.argv[2]);
if (isNaN(port)){
	console.log("Invalid port number passed in. Program will exit.");
	process.exit();
}

// allow files in public directory to be served as static files
app.use(express.static('public'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

http.listen(port, function(){
	console.log(new Date().getTime(), 'listening on *:' + port);
});

chatLogic.initialize(ioServer, ioClient, port)