let express = require('express');
let app = express();
let http = require('http').createServer(app);
require('./serverSideJs/setup.js')(require('socket.io')(http));

// allow files in public directory to be served as static files
app.use(express.static('public'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

http.listen(parseInt(process.argv[2]), function(){
	console.log('argv[2] == the port to run on == ' + process.argv[2])
	console.log('listening on *:' + process.argv[2]);
});