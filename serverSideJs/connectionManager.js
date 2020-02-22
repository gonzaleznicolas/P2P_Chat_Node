'use strict';

let networkInterfaces = require('os').networkInterfaces();
const publicIp = require('public-ip');

module.exports = {
	init: initialize
}

let ioServer;
let ioClient;
let portImRunningOn;
let socketToBrowser;
let myMAC;
let myUsername;
let serversInMyChatMap = new Map();
let myIP; // string

function initialize (IO_SERVER, IO_CLIENT, myPort){
	myMAC = networkInterfaces['Wi-Fi'][0].mac;

	(async () => {
		myIP = await publicIp.v4();
		console.log("my ip is:"+myIP)
	 
		//console.log(await publicIp.v6());
	})();

	portImRunningOn = myPort;
	ioServer = IO_SERVER;
	ioServer.on('connection', ioServerOnConnection);

	ioClient = IO_CLIENT;
	
}

function ioServerOnConnection(socketToClient){
	console.log('a user connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToUser', fromBrowser_ConnectToUser);
	socketToClient.on('FromBrowser_Message', fromBrowser_Message);

	socketToClient.on('FromOtherServer_NewConnection', FromOtherServer_NewConnection)
	socketToClient.on('FromOtherServer_Message', fromOtherServer_Message)
}

function fromEither_Disconnect(){
	console.log('someone disconnected');
}

function fromBrowser_ImYourBrowser(username){
	myUsername = username;
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
}

function fromBrowser_ConnectToUser(obj){
	connectAsClientToServer(obj.ip, obj.port);
}

function fromBrowser_Message(msg){
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
	console.log('MessageFromBrowser: ' + msg);
	socketToBrowser.emit("FromServer_Message", "this is me the server responding. Hey!");
}

function connectAsClientToServer(ipToConnectTo, portToConnectTo){
	console.log("Going to try to connect to server running at ip " + 
		ipToConnectTo + " on port: "+portToConnectTo);

	let socketToServer = ioClient.connect(
		"http://" + ipToConnectTo + ":" + portToConnectTo +"/",
		{reconnection: true}
	);

	socketToServer.on('connect', function(){
		console.log("I successfully connected to server running on port.")
		console.log("I will send it a message...")
		socketToServer.emit("FromOtherServer_NewConnection", {

		})
	});
}

function FromOtherServer_NewConnection(obj){
	console.log("received new connectoin message from other server")
}

function fromOtherServer_Message(msg){
	console.log("Message from another server:");
	console.log(msg)
}