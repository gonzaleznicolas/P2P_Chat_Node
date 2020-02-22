let express = require('express');
let app = express();
let http = require('http').createServer(app);
require('./serverSideJs/setup.js')(require('socket.io')(http));

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
	console.log('listening on *:' + port);
});