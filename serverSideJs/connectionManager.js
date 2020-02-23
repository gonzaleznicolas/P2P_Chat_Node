'use strict';

let networkInterfaces = require('os').networkInterfaces()["Wi-Fi"];
const publicIp = require('public-ip');

module.exports = {
	init: initialize
}

let ioServer;
let ioClient;
let myPort;
let socketToBrowser;
let myMAC;
let myUsername;
let serversImConnectedTo = new Map();
let myIP; // string

function initialize (IO_SERVER, IO_CLIENT, portImRunningOn){
	//console.log(networkInterfaces);
	myMAC = networkInterfaces[0].mac;
	console.log("myMAC: " + myMAC);

	// if all computers on same private network
	let q = networkInterfaces.find( e => e.family == 'IPv4');
	if(q !== undefined)
		myIP = q.address;
	console.log("myIP: " + myIP);

	// if each computer on public
	/*
	(async () => {
		myIP = await publicIp.v4();
		console.log("my ip is:"+myIP)
	 
		//console.log(await publicIp.v6());
	})();
	*/

	myPort = portImRunningOn;
	ioServer = IO_SERVER;
	ioServer.on('connection', ioServerOnConnection);

	ioClient = IO_CLIENT;
	
}

function ioServerOnConnection(socketToClient){
	console.log('someone connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToUser', fromBrowser_ConnectToUser);
	socketToClient.on('FromBrowser_Message', fromBrowser_Message);

	socketToClient.on('FromOtherServer_NewConnection', fromOtherServer_NewConnection)
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
	if (serversImConnectedTo.has(machineIdentifier(ipToConnectTo, portToConnectTo)))
		return;

	console.log("Going to try to connect to server running at ip " + 
		ipToConnectTo + " on port: "+portToConnectTo);

	let socketToServer = ioClient.connect(
		"http://" + ipToConnectTo + ":" + portToConnectTo +"/",
		{reconnection: true}
	);

	socketToServer.on('connect', function(){
		console.log("I successfully connected to server "+machineIdentifier(ipToConnectTo, portToConnectTo));
		serversImConnectedTo.set(machineIdentifier(ipToConnectTo, portToConnectTo), {
			ip: ipToConnectTo,
			port: portToConnectTo,
			socket: socketToServer
		});
		printListOfServersImConnectedTo();
		console.log("Let "+machineIdentifier(ipToConnectTo, portToConnectTo)+" know I connected to it so it can connect to me...")
		socketToServer.emit("FromOtherServer_NewConnection", {
			ip: myIP,
			port: myPort,
			allServerConnections: compileArrayOfServersImConnectedTo()
		})
	});

	socketToServer.on('disconnect', function(){
		console.log("the server i was connected to disconnected");
	})
}

function fromOtherServer_NewConnection(obj){
	console.log("Received new connection message from other server. That server's IP is "+
		obj.ip+" and its port is "+obj.port);
	
	//now that it connected to me, I will connect to everything it is connected to
	//except myself
	connectAsClientToServer(obj.ip, obj.port); // first connect to server that just connected to me
												// it wont be in the list it sent me
	// connect to everything it is connected to (except myself)
	obj.allServerConnections.forEach( function(c) {
		if (!(c.ip === myIP && c.port === myPort))
			connectAsClientToServer(c.ip, c.port);
	});
}

function fromOtherServer_Message(msg){
	console.log("Message from another server:");
	console.log(msg)
}

function printListOfServersImConnectedTo(){
	console.log("my connections:");
	let it = serversImConnectedTo.keys();
	let result = it.next();
	while (!result.done) {
		console.log(result.value);
		result = it.next();
	}
}

function compileArrayOfServersImConnectedTo(){
	let array = [];
	let it = serversImConnectedTo.values();
	let result = it.next();
	while (!result.done) {
		array.push({ip: result.value.ip, port: result.value.port});
		result = it.next();
	}
	return array;
}

function machineIdentifier(ip, port){
	return ""+ip+":"+port;
}