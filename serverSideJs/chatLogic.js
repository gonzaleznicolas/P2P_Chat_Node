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
let myTS = {time: 0, serverIdentifier: ""}
let Q = new PriorityQueue();


function initialize (IO_SERVER, IO_CLIENT, portImRunningOn){

	myIP = getIPAddressOfThisMachine();
	console.log(new Date().getTime(), "myIP: " + myIP);
	myPort = portImRunningOn;
	console.log(new Date().getTime(), "myPort: " + myPort);

	ioServer = IO_SERVER;
	ioServer.on('connection', ioServerOnConnection);
	ioClient = IO_CLIENT;

	// initialize TOB time stamp, and connect to self
	myTS.time = 0;
	myTS.serverIdentifier = serverIdentifier(myIP, myPort);
	connectToSelf();

	// start checking for TOB updates regularly
	setInterval( tobApplyUpdates, 6000);
}

function ioServerOnConnection(socketToClient){
	console.log(new Date().getTime(), 'Someone connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToServer', fromBrowser_ConnectToServer);
	socketToClient.on('FromBrowser_GiveTobUpdate', fromBrowser_GiveTobUpdate);
	socketToClient.on('FromBrowser_SendMessageToSpecificServer', fromBrowser_SendMessageToSpecificServer);

	socketToClient.on('FromOtherServer_iJustConnectedToYou', fromOtherServer_iJustConnectedToYou);
	socketToClient.on('FromOtherServer_TobMessageOrAck', fromOtherServer_TobMessageOrAck)
	socketToClient.on('FromOtherServer_MessageToSpecificServer', fromOtherServer_MessageToSpecificServer)
}

function fromEither_Disconnect(){
	console.log(new Date().getTime(), 'Someone disconnected');
}

/********************************************************
FROM BROWSER EVENT HANDLERS
********************************************************/ 

function fromBrowser_ImYourBrowser(username){
	myUsername = username;
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
	console.log(new Date().getTime(), "Browser has connected. Username selected is ", myUsername)
}

function fromBrowser_ConnectToServer(obj){
	console.log(new Date().getTime(), "My browser has asked me to connect to ", serverIdentifier(obj.ip, obj.port));
	connectAsClientToServer(obj.ip, obj.port);
}

function fromBrowser_GiveTobUpdate(update){
	tobSendUpdate(update);
}

function fromBrowser_SendMessageToSpecificServer(obj /* {toIp, toPort, msg} */){
	let serverToSendMessageTo = serversImConnectedTo.get(serverIdentifier(obj.toIp, obj.toPort));
	if(serverToSendMessageTo == undefined){
		console.log("Not connected to that server.");
		return;
	}

	console.log(new Date().getTime(), "I will send the following message to server ", serverIdentifier(obj.toIp, obj.toPort), ":");
	console.log(new Date().getTime(), obj.msg);
	serverToSendMessageTo.socket.emit('FromOtherServer_MessageToSpecificServer', {
		fromIp: myIP,
		fromPort: myPort,
		msg: obj.msg
	});
}

/********************************************************
FROM OTHER SERVER EVENT HANDLERS
********************************************************/ 

function fromOtherServer_iJustConnectedToYou(obj){
	console.log(new Date().getTime(), "Server ", serverIdentifier(obj.ip, obj.port), " just connected to me.");
	
	// if im already connected to the server that just connected to me
	let serverThatJustConnectedToMe = serversImConnectedTo.get(serverIdentifier(obj.ip, obj.port))
	if (serverThatJustConnectedToMe != undefined){
		// update my record of its time stamp
		console.log(new Date().getTime(), "Updating TS=", obj.TS.time, " for ", serverIdentifier(obj.ip, obj.port));
		serverThatJustConnectedToMe.TS.time = obj.TS.time;
		serverThatJustConnectedToMe.TS.serverIdentifier = obj.TS.serverIdentifier;
	}

	// connect to everything it is connected to (including myself - TOB algorithm calls for broadcasts that include self)
	obj.allServerConnections.forEach( function(c) {
		connectAsClientToServer(c.ip, c.port);
	});
}

function fromOtherServer_TobMessageOrAck(obj){
	tobReceiveMessageOrAck(obj);
}

function fromOtherServer_MessageToSpecificServer(obj){
	console.log(new Date().getTime(), "Server ", serverIdentifier(obj.fromIp, obj.fromPort), " sent me the message:");
	console.log(new Date().getTime(), obj.msg);
}

/********************************************************
CONNECTION FUNCTIONS
********************************************************/ 

function connectAsClientToServer(ipToConnectTo, portToConnectTo){
	if (serversImConnectedTo.has(serverIdentifier(ipToConnectTo, portToConnectTo)))
		return;

	console.log(new Date().getTime(), "Going to try to connect to server ", serverIdentifier(ipToConnectTo, portToConnectTo));

	let socketToServer = ioClient.connect(
		"http://" + ipToConnectTo + ":" + portToConnectTo +"/",
		{reconnection: true}
	);

	socketToServer.on('connect', function(){
		console.log(new Date().getTime(), "I successfully connected to server "+serverIdentifier(ipToConnectTo, portToConnectTo));
		serversImConnectedTo.set(serverIdentifier(ipToConnectTo, portToConnectTo), {
			ip: ipToConnectTo,
			port: portToConnectTo,
			socket: socketToServer,
			TS: {time: 0, serverIdentifier: serverIdentifier(ipToConnectTo, portToConnectTo)}
		});
		printListOfServersImConnectedTo();
		socketToServer.emit("FromOtherServer_iJustConnectedToYou", {
			ip: myIP,
			port: myPort,
			TS: myTS,
			allServerConnections: compileArrayOfServersImConnectedTo()
		})
	});

	socketToServer.on('disconnect', function(){
		console.log(new Date().getTime(), "The server I was connected to disconnected");
	})
}

function connectToSelf(){
	if (serversImConnectedTo.has(serverIdentifier(myIP, myPort)))
		return;

	let socketToSelf = ioClient.connect(
		"http://" + myIP + ":" + myPort +"/",
		{reconnection: false}
	);

	socketToSelf.on('connect', function(){
		console.log(new Date().getTime(), "I successfully connected to myself.");
		serversImConnectedTo.set(serverIdentifier(myIP, myPort), {
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
	console.log(new Date().getTime(), "Received this update from my browser:");
	console.log(new Date().getTime(), u);

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
	let from = serversImConnectedTo.get(serverIdentifier(obj.fromIp, obj.fromPort));
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
		//console.log(new Date().getTime(), "nothing");
		return; // queue is empty
	}

	let uts = update.TS

	console.log(new Date().getTime(), "myTS time: "+ myTS.time+" myTS mi: "+ myTS.serverIdentifier);

	// see if uts <= the TS of all servers im connected to
	let utsIsSmallest = true;
	let itr = serversImConnectedTo.values();
	let result = itr.next();
	while (!result.done) {
		console.log(new Date().getTime(), "Process "+ serverIdentifier(result.value.ip, result.value.port)+" has time "+result.value.TS.time);
		if ( uts.time > result.value.TS.time )
			utsIsSmallest = false;
		result = itr.next();
	}

	if(utsIsSmallest){
		Q.dequeue();
		console.log(new Date().getTime(), "APPLYING UPDATE:");
		console.log(new Date().getTime(), update);
	}

}

/********************************************************
 HELPER FUNCTIONS
********************************************************/ 

function printListOfServersImConnectedTo(){
	console.log(new Date().getTime(), "My connections:");
	let it = serversImConnectedTo.keys();
	let result = it.next();
	while (!result.done) {
		console.log(new Date().getTime(), result.value);
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

function serverIdentifier(ip, port){
	return ""+ip+":"+port;
}

function compareTimeStamps(a, b){
	if(a.time != b.time)
		return a.time - b.time;
	else{
		if (a.serverIdentifier < b.serverIdentifier)
			return -1;
		else if (a.serverIdentifier > b.serverIdentifier)
			return 1;
		else
			return 0;
	}
}

function tsCopy(ts){
	return {time: ts.time, serverIdentifier: ts.serverIdentifier};
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