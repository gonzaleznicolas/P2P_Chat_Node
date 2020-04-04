'use strict';

const request = require('request');
const ifaces = require('os').networkInterfaces();
const lodash = require('lodash')
const PriorityQueue = require('./priorityQueue.js');
const short_uuid = require('short-uuid');
const supernodeEndPoint = "https://central-server-b819d.appspot.com" 

module.exports = {
	initialize: initialize
}

let ioServer;
let ioClient;
let socketToBrowser;

let myPort;
let myIP; // string
let myIdentifier;
let userName;

let chatLog = [];
let chatRooms = [];
let joinedRooms = [];
let chatMembers = {};
let chatLogs = {};
let serversImConnectedTo = new Map();
let myTS = {time: 0, serverIdentifier: "", userName: ''}
let Q = new PriorityQueue();

function initialize (IO_SERVER, IO_CLIENT, portImRunningOn){

	myIdentifier = short_uuid().new();
	userName = short_uuid().new();

	myIP = getIPAddressOfThisMachine();
	console.log(new Date().getTime(), "myIP: " + myIP);
	myPort = portImRunningOn;
	console.log(new Date().getTime(), "myPort: " + myPort);

	ioServer = IO_SERVER;
	ioServer.on('connection', ioServerOnConnection);
	ioClient = IO_CLIENT;

	// initialize TOB time stamp, and connect to self
	myTS.time = 0;
	myTS.serverIdentifier = myIdentifier;
	myTS.userName = userName;
	connectToSelf();

	// start checking for TOB updates regularly
	setInterval( tobApplyUpdates, 500);

	// start sending heartbeats to the server
	setInterval( sendHeartbeatToServer, 30000);

	// get chatrooms from the server
	let options = {
		url: supernodeEndPoint + "/chatrooms",
		method: 'GET',
	};

	request(options, function(err, res, body) {
		chatRooms = (JSON.parse(body)).rooms;
		console.log("Available Rooms:\n", chatRooms);
	});
}

function ioServerOnConnection(socketToClient){
	console.log(new Date().getTime(), 'Someone connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToRoom', fromBrowser_ConnectToRoom);
	socketToClient.on('FromBrowser_GiveTobUpdate', fromBrowser_GiveTobUpdate);
	socketToClient.on('FromBrowser_SendMessageToSpecificServer', fromBrowser_SendMessageToSpecificServer);

	socketToClient.on('FromOtherServer_iJustConnectedToYou', fromOtherServer_iJustConnectedToYou);
	socketToClient.on('FromOtherServer_TobMessageOrAck', fromOtherServer_TobMessageOrAck)
	socketToClient.on('FromOtherServer_MessageToSpecificServer', fromOtherServer_MessageToSpecificServer)
}

function fromEither_Disconnect(){
	console.log(new Date().getTime(), 'Someone who was connected to me disconnected.');
}

/********************************************************
FROM BROWSER EVENT HANDLERS
********************************************************/ 

function fromBrowser_ImYourBrowser(){
	socketToBrowser = this; // save the socket to the browser so I can send messages at any time
	console.log(new Date().getTime(), "Browser has connected.")
	socketToBrowser.emit('FromServer_AvailableRooms', chatRooms);
}

function fromBrowser_ConnectToRoom(obj){
	let chatID = obj.chatID;

	// contact the supernode to get info about the chatroom
	let data = {
		chatId: chatID,
		userId: myTS.serverIdentifier,
		ip: myIP,
		port: myPort
	};

	let options = {
		url: supernodeEndPoint + "/chatrooms",
		method: 'POST',
		json: data
	};

	request(options, function(err, res, obj) {
		chatMembers[chatID] = obj.members;
		chatLogs[chatID] = obj.log;
	});
	
	if (Array.isArray(chatMembers[chatID]) && chatMembers[chatID].length) {
		// connectAsClientToServer(chatMembers[chatID][0].ip, chatMembers[chatID][0].port, myTS.serverIdentifier);
		console.log(`Try connecting to ${chatMembers[chatID][0].ip}:${chatMembers[chatID][0].port}......`);
		// TO-DO 
		// fallback to other member of the room, if the first member is not responsive
		joinedRooms.push(chatID)
	} else {
		// No action if the chat room is empty
		joinedRooms.push(chatID)
		console.log(`Become the first member of room ${chatID}`)
	}
}

function fromBrowser_GiveTobUpdate(update){
	tobSendUpdate(update);
}

function fromBrowser_SendMessageToSpecificServer(obj /* {toIp, toPort, toIdentifier, msg} */){
	let serverToSendMessageTo = serversImConnectedTo.get(obj.toIdentifier);
	if(serverToSendMessageTo == undefined){
		console.log("Not connected to that server.");
		return;
	}

	console.log(new Date().getTime(), "I will send the following message to server ", obj.toIdentifier, ":");
	console.log(new Date().getTime(), obj.msg);
	serverToSendMessageTo.socket.emit('FromOtherServer_MessageToSpecificServer', {
		fromIp: myIP,
		fromPort: myPort,
		fromIdentifier: myIdentifier,
		fromUser: username,
		msg: obj.msg
	});
}

/********************************************************
FROM OTHER SERVER EVENT HANDLERS
********************************************************/ 

function fromOtherServer_iJustConnectedToYou(obj){
	console.log(new Date().getTime(), "Server ", obj.identifier, " just connected to me.");
	
	// if im already connected to the server that just connected to me
	let serverThatJustConnectedToMe = serversImConnectedTo.get(obj.identifier);
	if (serverThatJustConnectedToMe != undefined){
		// update my record of its time stamp
		console.log(new Date().getTime(), "Updating TS=", obj.TS.time, " for ", obj.identifier);
		serverThatJustConnectedToMe.TS.time = obj.TS.time;
		serverThatJustConnectedToMe.TS.serverIdentifier = obj.TS.serverIdentifier;
		chatLog = lodash.cloneDeep(obj.chatLog);
		socketToBrowser.emit('FromServer_ChatLog', chatLog);
	}

	// connect to everything it is connected to
	obj.allServerConnections.forEach( function(c) {
		connectAsClientToServer(c.ip, c.port, c.identifier);
	});
}

function fromOtherServer_TobMessageOrAck(obj){
	tobReceiveMessageOrAck(obj);
}

function fromOtherServer_MessageToSpecificServer(obj){
	console.log(new Date().getTime(), "Server ", obj.fromIdentifier, " sent me the message:");
	console.log(new Date().getTime(), obj.msg);
}

/********************************************************
CONNECTION FUNCTIONS
********************************************************/ 

function connectAsClientToServer(ipToConnectTo, portToConnectTo, identifierToConnectTo){
	if (serversImConnectedTo.has(identifierToConnectTo))
		return;

	console.log(new Date().getTime(), "Going to try to connect to server ", identifierToConnectTo);

	let socketToServer = ioClient.connect(
		"http://" + ipToConnectTo + ":" + portToConnectTo +"/",
		{reconnection: false}
	);

	// need this so that when it disconnects, I know how to remove from my map
	socketToServer.meshChatIdentifier = identifierToConnectTo;

	socketToServer.on('connect', function(){
		console.log(new Date().getTime(), "I successfully connected to server "+identifierToConnectTo);
		serversImConnectedTo.set(identifierToConnectTo, {
			ip: ipToConnectTo,
			port: portToConnectTo,
			identifier: identifierToConnectTo,
			socket: socketToServer,
			TS: {time: 0, serverIdentifier: identifierToConnectTo}
		});
		printListOfServersImConnectedTo();
		socketToServer.emit("FromOtherServer_iJustConnectedToYou", {
			ip: myIP,
			port: myPort,
			identifier: myIdentifier,
			TS: myTS,
			allServerConnections: compileArrayOfServersImConnectedTo(),
			chatLog: chatLog
		})
	});

	socketToServer.on('disconnect', function(){
		console.log(new Date().getTime(), "Server ", this.meshChatIdentifier, " disconnected. Remove it from my map.");
		let deleted = serversImConnectedTo.delete(this.meshChatIdentifier);
		console.log(new Date().getTime(), "Successfully deleted? ", deleted);
		printListOfServersImConnectedTo();
	})
}

function connectToSelf(){
	if (serversImConnectedTo.has(myIdentifier))
		return;

	let socketToSelf = ioClient.connect(
		"http://" + myIP + ":" + myPort +"/",
		{reconnection: false}
	);

	socketToSelf.on('connect', function(){
		console.log(new Date().getTime(), "I successfully connected to myself.");
		serversImConnectedTo.set(myIdentifier, {
			ip: myIP,
			port: myPort,
			identifier: myIdentifier,
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
			fromIdentifier: myIdentifier,
			fromUser: username,
			messageOrAck: "message", // "message or ack"
			message: u,
			TS: myTS
		});
	});
}

function tobReceiveMessageOrAck(obj){
	let from = serversImConnectedTo.get(obj.fromIdentifier);
	from.TS.time = obj.TS.time;

	let isMessage = (obj.messageOrAck == "message");

	if (isMessage)
		Q.enqueue(obj);
	
	if (obj.TS.time > myTS.time){
		myTS.time = obj.TS.time;

		serversImConnectedTo.forEach(function (server){
			if( server.identifier != myIdentifier ){
				server.socket.emit('FromOtherServer_TobMessageOrAck', {
					fromIp: myIP,
					fromPort: myPort,
					fromIdentifier: myIdentifier,
					// fromUser: username,
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

	console.log(new Date().getTime(), "myTS time: "+ myTS.time+" myTS serverIdentifier: "+ myTS.serverIdentifier);

	// see if uts <= the TS of all servers im connected to
	let utsIsSmallest = true;
	let itr = serversImConnectedTo.values();
	let result = itr.next();
	while (!result.done) {
		console.log(new Date().getTime(), "Process " + result.value.identifier + " has time "+result.value.TS.time);
		if ( uts.time > result.value.TS.time )
			utsIsSmallest = false;
		result = itr.next();
	}

	if(utsIsSmallest){
		Q.dequeue();
		console.log(new Date().getTime(), "APPLYING UPDATE:");
		console.log(new Date().getTime(), update);
		chatLog.push(update);
		socketToBrowser.emit('FromServer_OrderedUpdate', update);
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
		array.push({ip: result.value.ip, port: result.value.port, identifier: result.value.identifier});
		result = it.next();
	}
	return array;
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

function sendHeartbeatToServer(){
	joinedRooms.forEach((room) => {
		let data = {
			userId: myTS.serverIdentifier,
			chatId: room,
			ip: myIP,
			port: myPort
		};
	
		let options = {
			url: supernodeEndPoint + "/heartbeat",
			method: 'POST',
			json: data
		};
	
		request(options, function(err, res, obj) {
			console.log(obj);
		});
	});
}