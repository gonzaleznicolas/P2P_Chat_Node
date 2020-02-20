let express = require('express');
let app = express();
let http = require('http').createServer(app);
require('./serverSideJs/setup.js')(require('socket.io')(http));

// allow files in public directory to be served as static files
app.use(express.static('public'));

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});