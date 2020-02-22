'use strict';

let networkInterfaces = require('os').networkInterfaces();

module.exports = {
	init: initialize
}

let ioServer;
let ioClient;
let portImRunningOn;
let socketToBrowser;
let myMAC;

function initialize (IO_SERVER, IO_CLIENT, myPort){
	myMAC = networkInterfaces['Wi-Fi'][0].mac;
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

	socketToClient.on('FromOtherServer_Message', fromOtherServer_Message)
}

function fromEither_Disconnect(){
	console.log('someone disconnected');
}

function fromBrowser_ImYourBrowser(){
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
}

function fromBrowser_ConnectToUser(obj){
	connectAsClientToServer(obj.ip, obj.port);
}

function fromBrowser_Message(msg){
	console.log('MessageFromBrowser: ' + msg);
	socketToBrowser.emit("MessageFromServer", "this is me the server responding. Hey!");
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
		socketToServer.emit("FromOtherServer_Message", "message sent from server to server")
	});
}

function fromOtherServer_Message(msg){
	console.log("Message from another server:");
	console.log(msg)
}