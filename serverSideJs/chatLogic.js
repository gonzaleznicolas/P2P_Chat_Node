'use strict';

const ifaces = require('os').networkInterfaces();
const PriorityQueue = require('./priorityQueue.js');

module.exports = {
	initialize: initialize
}

let ioServer;
let ioClient;
let socketToBrowser;

let myPort;
let myIP; // string
let myUsername;

let serversImConnectedTo = new Map();
let myTS = {time: 0, machineIdentifier: ""}
let Q = new PriorityQueue();


function initialize (IO_SERVER, IO_CLIENT, portImRunningOn){

	myIP = getIPAddressOfThisMachine();
	console.log("myIP: " + myIP);
	myPort = portImRunningOn;
	console.log("myPort: " + myPort);

	ioServer = IO_SERVER;
	ioServer.on('connection', ioServerOnConnection);
	ioClient = IO_CLIENT;

	// initialize TOB time stamp, and connect to self
	myTS.time = 0;
	myTS.machineIdentifier = machineIdentifier(myIP, myPort);
	connectToSelf();

	// start checking for TOB updates regularly
	setInterval( tobApplyUpdates, 6000);
}

function ioServerOnConnection(socketToClient){
	console.log('someone connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToServer', fromBrowser_ConnectToServer);
	socketToClient.on('FromBrowser_GiveTobUpdate', fromBrowser_GiveTobUpdate);

	socketToClient.on('FromOtherServer_iJustConnectedToYou', fromOtherServer_iJustConnectedToYou);
	socketToClient.on('FromOtherServer_TobMessageOrAck', fromOtherServer_TobMessageOrAck)
}

function fromEither_Disconnect(){
	console.log('someone disconnected');
}

/********************************************************
FROM BROWSER EVENT HANDLERS
********************************************************/ 

function fromBrowser_ImYourBrowser(username){
	myUsername = username;
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
	console.log("Browser has connected. Username selected is ", myUsername)
}

function fromBrowser_ConnectToServer(obj){
	connectAsClientToServer(obj.ip, obj.port);
}

function fromBrowser_GiveTobUpdate(update){
	tobSendUpdate(update);
}

/********************************************************
FROM OTHER SERVER EVENT HANDLERS
********************************************************/ 

function fromOtherServer_iJustConnectedToYou(obj){
	console.log("Server ", machineIdentifier(obj.ip, obj.port), " just connected to me.");
	
	// connect to everything it is connected to (including myself - TOB algorithm calls for broadcasts that include self)
	obj.allServerConnections.forEach( function(c) {
		connectAsClientToServer(c.ip, c.port);
	});
}

function fromOtherServer_TobMessageOrAck(obj){
	tobReceiveMessageOrAck(obj);
}

/********************************************************
CONNECTION FUNCTIONS
********************************************************/ 

function connectAsClientToServer(ipToConnectTo, portToConnectTo){
	if (serversImConnectedTo.has(machineIdentifier(ipToConnectTo, portToConnectTo)))
		return;

	console.log("Going to try to connect to server ", machineIdentifier(ipToConnectTo, portToConnectTo));

	let socketToServer = ioClient.connect(
		"http://" + ipToConnectTo + ":" + portToConnectTo +"/",
		{reconnection: true}
	);

	socketToServer.on('connect', function(){
		console.log("I successfully connected to server "+machineIdentifier(ipToConnectTo, portToConnectTo));
		serversImConnectedTo.set(machineIdentifier(ipToConnectTo, portToConnectTo), {
			ip: ipToConnectTo,
			port: portToConnectTo,
			socket: socketToServer,
			TS: {time: 0, machineIdentifier: machineIdentifier(ipToConnectTo, portToConnectTo)}
		});
		printListOfServersImConnectedTo();
		socketToServer.emit("FromOtherServer_iJustConnectedToYou", {
			ip: myIP,
			port: myPort,
			allServerConnections: compileArrayOfServersImConnectedTo()
		})
	});

	socketToServer.on('disconnect', function(){
		console.log("the server i was connected to disconnected");
	})
}

function connectToSelf(){
	if (serversImConnectedTo.has(machineIdentifier(myIP, myPort)))
		return;

	let socketToSelf = ioClient.connect(
		"http://" + myIP + ":" + myPort +"/",
		{reconnection: true}
	);

	socketToSelf.on('connect', function(){
		console.log("I successfully connected to myself.");
		serversImConnectedTo.set(machineIdentifier(myIP, myPort), {
			ip: myIP,
			port: myPort,
			socket: socketToSelf,
			TS: myTS
		});
		printListOfServersImConnectedTo();
	});
}

/********************************************************
TOB ALGORITHM LOGIC
********************************************************/ 

function tobSendUpdate(u){
	console.log("received this update from my browser:");
	console.log(u);

	myTS.time = myTS.time+1;
	
	serversImConnectedTo.forEach(function (server){
		server.socket.emit('FromOtherServer_TobMessageOrAck', {
			fromIp: myIP,
			fromPort: myPort,
			messageOrAck: "message", // "message or ack"
			message: u,
			TS: myTS
		});
	});
}

function tobReceiveMessageOrAck(obj){
	let from = serversImConnectedTo.get(machineIdentifier(obj.fromIp, obj.fromPort));
	from.TS.time = obj.TS.time;

	let isMessage = (obj.messageOrAck == "message");

	if (isMessage)
		Q.enqueue(obj);
	
	if (obj.TS.time > myTS.time){
		myTS.time = obj.TS.time;

		serversImConnectedTo.forEach(function (server){
			if( !(server.ip == myIP && server.port == myPort) ){
				server.socket.emit('FromOtherServer_TobMessageOrAck', {
					fromIp: myIP,
					fromPort: myPort,
					messageOrAck: "ack", // "message or ack"
					TS: myTS
				});
			}
		});
	}
}

// executes every second
function tobApplyUpdates(){
	//Q.print();

	let update = Q.head();
	if (update == -1){
		//console.log("nothing");
		return; // queue is empty
	}

	let uts = update.TS

	console.log("myTS time: "+ myTS.time+" myTS mi: "+ myTS.machineIdentifier);

	// see if uts <= the TS of all servers im connected to
	let utsIsSmallest = true;
	let itr = serversImConnectedTo.values();
	let result = itr.next();
	while (!result.done) {
		console.log("process "+result.value.port+" has time "+result.value.TS.time);
		if ( uts.time > result.value.TS.time )
			utsIsSmallest = false;
		result = itr.next();
	}

	if(utsIsSmallest){
		Q.dequeue();
		console.log("APPLYING UPDATE:");
		console.log(update);
	}

}

/********************************************************
 HELPER FUNCTIONS
********************************************************/ 

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

function compareTimeStamps(a, b){
	if(a.time != b.time)
		return a.time - b.time;
	else{
		if (a.machineIdentifier < b.machineIdentifier)
			return -1;
		else if (a.machineIdentifier > b.machineIdentifier)
			return 1;
		else
			return 0;
	}
}

function tsCopy(ts){
	return {time: ts.time, machineIdentifier: ts.machineIdentifier};
}

function getIPAddressOfThisMachine(){
	let ip;
	Object.keys(ifaces).forEach(function (ifname) {
		ifaces[ifname].forEach(function (iface) {
		  if ('IPv4' !== iface.family || iface.internal !== false) {
			// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
			return;
		  }
		  ip = iface.address;
		});
	});
	return ip;
}