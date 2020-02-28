'use strict';

const networkInterfaces = require('os').networkInterfaces();
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
	console.log(networkInterfaces);

	// if all computers on same private network
	let q = networkInterfaces.find( e => e.family == 'IPv4');
	if(q !== undefined)
		myIP = q.address;
	console.log("myIP: " + myIP);

	myPort = portImRunningOn;
	ioServer = IO_SERVER;

	ioServer.on('connection', ioServerOnConnection);

	ioClient = IO_CLIENT;

	myTS.time = 0;
	myTS.machineIdentifier = machineIdentifier(myIP, myPort);
	connectToSelf();

	setInterval( tobApplyUpdates, 6000);
}

function ioServerOnConnection(socketToClient){
	console.log('someone connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToUser', fromBrowser_ConnectToUser);
	socketToClient.on('FromBrowser_SendMessageTo', fromBrowser_SendMessageTo);
	socketToClient.on('FromBrowser_BroadcastMessage', fromBrowser_BroadcastMessage);
	socketToClient.on('FromBrowser_Message', fromBrowser_Message);
	socketToClient.on('FromBrowser_GiveUpdate', fromBrowser_GiveUpdate);

	socketToClient.on('FromOtherServer_NewConnection', fromOtherServer_NewConnection);
	socketToClient.on('FromOtherServer_Message', fromOtherServer_Message);
	socketToClient.on('FromOtherServer_TOB_Message', fromOtherServer_TOB_Message)
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
}

function fromBrowser_ConnectToUser(obj){
	connectAsClientToServer(obj.ip, obj.port);
}

function fromBrowser_Message(msg){
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
	console.log('MessageFromBrowser: ' + msg);
	socketToBrowser.emit("FromServerToBrowser_Message", "this is me the server responding. Hey!");
}

function fromBrowser_SendMessageTo(obj /* {toIp, toPort, msg} */){
	let serverToSendMessageTo = serversImConnectedTo.get(machineIdentifier(obj.toIp, obj.toPort));
	if(serverToSendMessageTo == undefined){
		console.log("Not connected to that server.");
		return;
	}
	serverToSendMessageTo.socket.emit('FromOtherServer_Message', {
		fromIp: myIP,
		fromPort: myPort,
		msg: obj.msg
	});
}

function fromBrowser_BroadcastMessage(message){
	serversImConnectedTo.forEach(function (server){
		server.socket.emit('FromOtherServer_Message', {
			fromIp: myIP,
			fromPort: myPort,
			msg: message
		});
	});
}

function fromBrowser_GiveUpdate(update){
	tobSendUpdate(update);
}

/********************************************************
FROM OTHER SERVER EVENT HANDLERS
********************************************************/ 

function fromOtherServer_NewConnection(obj){
	console.log("Received new connection message from other server. That server's IP is "+
		obj.ip+" and its port is "+obj.port);
	
	//now that it connected to me, I will connect to everything it is connected to
	//except myself
	connectAsClientToServer(obj.ip, obj.port); // first connect to server that just connected to me
												// it wont be in the list it sent me
	// connect to everything it is connected to (including myself - TOB algorithm calls for broadcasts that include self)
	obj.allServerConnections.forEach( function(c) {
		connectAsClientToServer(c.ip, c.port);
	});
}

function fromOtherServer_Message(obj){
	console.log("Message from server "+ machineIdentifier(obj.fromIp, obj.fromPort));
	console.log(obj.msg)
}

function fromOtherServer_TOB_Message(obj){
	tobReceiveMessage(obj);
}

/********************************************************
CONNECTION FUNCTIONS
********************************************************/ 

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
			socket: socketToServer,
			TS: {time: 0, machineIdentifier: machineIdentifier(ipToConnectTo, portToConnectTo)}
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
		server.socket.emit('FromOtherServer_TOB_Message', {
			fromIp: myIP,
			fromPort: myPort,
			type: "message", // "message or ack"
			message: u,
			TS: myTS
		});
	});
}

function tobReceiveMessage(obj){
	let from = serversImConnectedTo.get(machineIdentifier(obj.fromIp, obj.fromPort));
	from.TS.time = obj.TS.time;

	let isMessage = (obj.type == "message");

	if (isMessage)
		Q.enqueue(obj);
	
	if (obj.TS.time > myTS.time){
		myTS.time = obj.TS.time;

		serversImConnectedTo.forEach(function (server){
			if( !(server.ip == myIP && server.port == myPort) ){
				server.socket.emit('FromOtherServer_TOB_Message', {
					fromIp: myIP,
					fromPort: myPort,
					type: "ack", // "message or ack"
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
