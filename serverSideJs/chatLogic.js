/* Mesh Chat - Developed by Michael Han, Nicolas Gonzalez, Sadat Islam, Chevy O’Dell, and Kent Wong
CPSC 559 Winter 2020 - chatLogic.js

This script houses the back end chat logic in which the local back-end node will use to process chat messages.
There are also logic and functionality in here to communicate with the supernode and other nodes.

The point of entry is the initialize() function, this is called externally from index.js
It will then proceed to initialize a uuid for the node, connect to itself, and proceed to issue tob updates every
1 second.

*/

'use strict';

const request = require('request');
const ifaces = require('os').networkInterfaces();
const lodash = require('lodash');
const PriorityQueue = require('./priorityQueue.js');
const short_uuid = require('short-uuid');
const supernodeEndPoint = "https://central-server-b819d.appspot.com/";

module.exports = {
	initialize: initialize
};

let ioServer;
let ioClient;
let socketToBrowser;

let myPort;
let myIP; // string
let myIdentifier;
let myUserName;

let chatLog = [];
let chatRooms = [];
let joinedRooms = [];
let chatMembers = {};
let serversImConnectedTo = new Map();
let myTS = {time: 0, serverIdentifier: ""};
let Q = new PriorityQueue();

let heartbeatSetIntervalObj;
let sendBrowserListOfRoomsIntervalObj;

/**
 * Initialization function and entry point.
 * this method will register a uuid with itself, get necessary information such as IP and port.
 * It will then listen for socket.io events and connect to itself.
 * @param IO_SERVER
 * @param IO_CLIENT
 * @param portImRunningOn
 */
function initialize (IO_SERVER, IO_CLIENT, portImRunningOn){

	myIdentifier = short_uuid().new();
	myUserName = "Anonymous";

	myIP = getIPAddressOfThisMachine();
	console.log(new Date().getTime(), "myIP: " + myIP);
	myPort = portImRunningOn;
	console.log(new Date().getTime(), "myPort: " + myPort);
	console.log(new Date().getTime(), "myID: " + myIdentifier);

	ioServer = IO_SERVER;
	ioServer.on('connection', ioServerOnConnection);
	ioClient = IO_CLIENT;

	// initialize TOB time stamp, and connect to self
	myTS.time = 0;
	myTS.serverIdentifier = myIdentifier;
	connectToSelf();

	// start checking for TOB updates regularly
	setInterval( tobApplyUpdates, 500);

	// regularly update my list of available rooms
	setInterval( getChatRooms, 1000);
}

/**
 * io Server on Connection
 * this method houses all the listener events that the node should catch and respond to.
 * @param socketToClient
 */
function ioServerOnConnection(socketToClient){
	console.log(new Date().getTime(), 'Someone connected');

	socketToClient.on('disconnect', fromEither_Disconnect);

	socketToClient.on('FromBrowser_ImYourBrowser', fromBrowser_ImYourBrowser);
	socketToClient.on('FromBrowser_ConnectToRoom', fromBrowser_ConnectToRoom);
	socketToClient.on('FromBrowser_GiveTobUpdate', fromBrowser_GiveTobUpdate);
	socketToClient.on('FromBrowser_SendMessageToSpecificServer', fromBrowser_SendMessageToSpecificServer);
	socketToClient.on('FromBrowser_LeaveRoom', fromBrowser_LeaveRoom);
	socketToClient.on('FromBrowser_CreateRoom', fromBrowser_CreateRoom);
	socketToClient.on('FromBrowser_UpdateUsername', fromBrowser_UpdateUsername);

	socketToClient.on('FromOtherServer_iJustConnectedToYou', fromOtherServer_iJustConnectedToYou);
	socketToClient.on('FromOtherServer_TobMessageOrAck', fromOtherServer_TobMessageOrAck);
	socketToClient.on('FromOtherServer_MessageToSpecificServer', fromOtherServer_MessageToSpecificServer);
}

/**
 * from Either disconnect
 *  this is a helper method to log to console the time stamp and notifying someone has disconnected.
 */
function fromEither_Disconnect(){
	console.log(new Date().getTime(), 'Someone who was connected to me disconnected.');
}

/********************************************************
FROM BROWSER EVENT HANDLERS
********************************************************/

/**
 * fromBrowser_imYourBrowser
 * this is a helper method that emits the chat rooms and this node's details.
 */
function fromBrowser_ImYourBrowser(){
	console.log(new Date().getTime(), "Browser has connected. Start sending it list of room updates.");

	socketToBrowser = this; // save the socket to the browser so I can send messages at any time

	socketToBrowser.on("disconnect", function(){
		console.log(new Date().getTime(), "Browser disconnected. Stop sending it available rooms.");
		disconnect();
	});

	socketToBrowser.emit('FromServer_AvailableRooms', chatRooms);
	socketToBrowser.emit('FromServer_ThisIsMyUserDetails', {userId: myIdentifier, username: myUserName});
}

/**
 * fromBrowser_Createroom
 * this is a helper method to create a new room, sends a post request to the supernode end point.
 * @param newRoomName
 */
function fromBrowser_CreateRoom(newRoomName){
	console.log("Creating a room with name", newRoomName);
	let options = {
		url: supernodeEndPoint + "/chatrooms/create",
		method: 'POST',
		json: {name: newRoomName}
	};

	request(options, (err, res, body) => {
		if (res && res.statusCode === 200) {
			socketToBrowser.emit('FromServer_Alert', body);
		}
		else {
			socketToBrowser.emit('FromServer_Alert', 'Unable to create chatroom');
		}
	});
}

/**
 * fromBrowser_UpdateUsername
 * this is a helper method to update the user alias (username).
 * @param newUsername
 */
function fromBrowser_UpdateUsername(newUsername){
	myUserName = newUsername;
}

/**
 * fromBrowser_ConnectToRoom
 * this is a helper method used to connect to rooms by contacting the supernode.
 * Once the node is in the chat room, it will iteratively connect to all other peers.
 * @param obj
 */
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
	// start building the request
	request(options, (err, res, obj) => {
		try {
			chatMembers[chatID] = obj.members;
			if (Array.isArray(chatMembers[chatID]) && chatMembers[chatID].length) {
				// iterate through all chat members and connect to
				for (const member of chatMembers[chatID]) {
					if (member.userId !== myIdentifier && (member.ip !== myIP || member.port !== myPort)) {
						connectAsClientToServer(member.ip, member.port, member.userId);
						joinedRooms.push(chatID);
						// start sending heartbeats to the server
						heartbeatSetIntervalObj = setInterval( sendHeartbeatToServer, 2000);
						// Notify client to show chatroom page
						socketToBrowser.emit('FromServer_EnterChatroom');
						return;
					}
				}
				// Error handling here. All endpoints are invalid.
				socketToBrowser.emit('FromServer_Alert', 'Unable to connect to chatroom, please try again later.');
			} else {
				// No action if the chat room is empty
				console.log(`Become the first member of room ${chatID}`);
				chatLog = obj.log;
				console.log("chat history sent to me by server:", chatLog);
				socketToBrowser.emit('FromServer_ChatLog', chatLog);
				joinedRooms.push(chatID);
				// start sending heartbeats to the server
				heartbeatSetIntervalObj = setInterval( sendHeartbeatToServer, 2000);
				// Notify client to show chatroom page
				socketToBrowser.emit('FromServer_EnterChatroom');
			}
		} catch (e) {
			console.error('Error occurred connecting to a chatroom.')
		}
	});
}

/**
 * fromBrowser_giveTobUpdate
 * this is a helper method to send tob updates, which in laymans are the chat messages. update should be an object
 * containing string data in it's properties.
 * @param update
 */
function fromBrowser_GiveTobUpdate(update){
	tobSendUpdate(update);
}

/**
 * fromBrowser_SendMessagetoSpecificServer
 * this is a helper method to send messages to a specific server.
 * obj
 * @param obj - object with string data (destination IP, destination port, Identifer, and the string payload
 */
function fromBrowser_SendMessageToSpecificServer(obj /* {toIp, toPort, toIdentifier, msg} */){
	let serverToSendMessageTo = serversImConnectedTo.get(obj.toIdentifier);
	if(serverToSendMessageTo === undefined){
		console.log("Not connected to that server.");
		return;
	}

	console.log(new Date().getTime(), "I will send the following message to server ", obj.toIdentifier, ":");
	console.log(new Date().getTime(), obj.msg);
	serverToSendMessageTo.socket.emit('FromOtherServer_MessageToSpecificServer', {
		fromIp: myIP,
		fromPort: myPort,
		fromIdentifier: myIdentifier,
		fromUser: myUserName,
		msg: obj.msg
	});
}

/**
 * fromBrowser_LeaveRoom
 * this is a helper method to leave a room.
 */
function fromBrowser_LeaveRoom(){
	console.log(new Date().getTime(), "Leaving room. Disconnecting from everyone.");

	disconnect();
}

function disconnect() {
	clearInterval(heartbeatSetIntervalObj); // stop sending heartbeats

	// disconnect anyone connected to my server socket
	getSocketsConnectedToServerSocket().forEach(function(s) {
		s.disconnect(true);
	});

	// disconnect from all the servers I am connected to as a client
	serversImConnectedTo.forEach( function (server) {
		server.socket.close();
	});
	serversImConnectedTo.clear();

	// send chat log to super node
	sendLogToServer(joinedRooms[0]);

	// reset some data structures
	chatLog = [];
	chatRooms = [];
	joinedRooms = [];
	chatMembers = {};

	// initialize TOB time stamp, and re-connect to self
	myTS.time = 0;
	myTS.serverIdentifier = myIdentifier;
	connectToSelf();

	// get list of chat rooms because browser is going back to
	// landing page with list of chat rooms and will need them
	getChatRooms();
}

/********************************************************
FROM OTHER SERVER EVENT HANDLERS
********************************************************/

/**
 * fromOtherServer_iJustConnectedToYou
 * Catches a socket.io emit event; a helper receiver method used to finalize a connection.
 * does upkeep such as ts updates and bidirection connections. Will iterate through connector nodes to connect to them.
 * @param obj
 */
function fromOtherServer_iJustConnectedToYou(obj){
	console.log(new Date().getTime(), "Server ", obj.identifier, " just connected to me.");

	// if im already connected to the server that just connected to me
	let serverThatJustConnectedToMe = serversImConnectedTo.get(obj.identifier);
	if (serverThatJustConnectedToMe !== undefined){
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

/**
 * fromOtherServer_TobMessageOrAck
 * Catches a socket.io event; fire tob message for ack purpose.
 * @param obj - contains a time stamp (logical)
 */
function fromOtherServer_TobMessageOrAck(obj){
	tobReceiveMessageOrAck(obj);
}

/**
 * fromOtherServer_MessageToSpecificServer
 * Catches a socket.io event; for console logging object str payloads and identifying a sender
 * @param obj
 */
function fromOtherServer_MessageToSpecificServer(obj){
	console.log(new Date().getTime(), "Server ", obj.fromIdentifier, " sent me the message:");
	console.log(new Date().getTime(), obj.msg);
}

/********************************************************
CONNECTION FUNCTIONS
********************************************************/

/**
 * connectAsClientToServer.
 * delivers connection credentials and connects to other nodes. Emits necessary information to broadcast
 * this connection or disconnect
 * @param ipToConnectTo - ip destination
 * @param portToConnectTo - port destination
 * @param identifierToConnectTo - identifer to connect to
 */
function connectAsClientToServer(ipToConnectTo, portToConnectTo, identifierToConnectTo){
	if (serversImConnectedTo.has(identifierToConnectTo)) {
		return;
	}

	console.log(new Date().getTime(), "Going to try to connect to server ", identifierToConnectTo);

	let socketToServer = ioClient.connect(
		"http://" + ipToConnectTo + ":" + portToConnectTo +"/",
		{reconnection: false}
	);

	// need this so that when it disconnects, I know how to remove from my map
	socketToServer.meshChatIdentifier = identifierToConnectTo;

	socketToServer.on('connect', function(){
		console.log(new Date().getTime(), "I successfully connected to server " + identifierToConnectTo);
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

/**
 * connectToSelf
 * a helper method to connect to self after node boots up.
 */
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
			fromUser: myUserName,
			messageOrAck: "message", // "message or ack"
			message: u,
			TS: myTS
		});
	});
}

function tobReceiveMessageOrAck(obj){
	let from = serversImConnectedTo.get(obj.fromIdentifier);
	from.TS.time = obj.TS.time;

	let isMessage = (obj.messageOrAck === "message");

	if (isMessage)
		Q.enqueue(obj);

	if (obj.TS.time > myTS.time){
		myTS.time = obj.TS.time;

		serversImConnectedTo.forEach(function (server){
			if( server.identifier !== myIdentifier ){
				server.socket.emit('FromOtherServer_TobMessageOrAck', {
					fromIp: myIP,
					fromPort: myPort,
					fromIdentifier: myIdentifier,
					fromUser: myUserName,
					messageOrAck: "ack", // "message or ack"
					TS: myTS
				});
			}
		});
	}
}

// executes every second
function tobApplyUpdates(){
	let update = Q.head();
	if (update === -1){
		//console.log(new Date().getTime(), "nothing");
		return; // queue is empty
	}

	let uts = update.TS;

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
		let chatLogMsg = {userId: update.fromIdentifier, username: update.fromUser, message: update.message};
		chatLog.push(chatLogMsg);
		socketToBrowser.emit('FromServer_OrderedUpdate', chatLogMsg);
	}

}

/********************************************************
 HELPER FUNCTIONS
********************************************************/

/**
 * getSocketsConnectedToServerSocket
 * helper method to get socket information back in an array
 * @returns {Object[]}
 */
function getSocketsConnectedToServerSocket() {
    return Object.values(ioServer.of("/").connected);
}

/**
 * printListOfServersImConnectedTo
 * helper method to display peers
 */
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


/**
 * Compares if oldChatrooms is same as current chatrooms
 * @return boolean True if they are the same, false otherwise
 */
function isChatroomSame(oldChatrooms){
	if (chatRooms.length !== oldChatrooms.length) {
		return false;
	}

	// Now that they are the same size, all elements must exist in both rooms to be equal
	const chatroomIds = chatRooms.map((chatroom) => {
		return chatroom.chatRoomId;
	});

	for (let index = 0; index < oldChatrooms.length; index++) {
		const roomId = oldChatrooms[index].chatRoomId;
		if (!chatroomIds.includes(roomId)) {
			return false;
		}
	}

	return true;
}

function getChatRooms(){
	// Only send requests if user is not connected to a room, or if the browser connection exists
	if (socketToBrowser && socketToBrowser.connected && joinedRooms.length === 0) {
		let options = {
			url: supernodeEndPoint + "/chatrooms",
			method: 'GET',
		};

		const oldChatrooms = chatRooms;

		request(options, (err, res, body) => {
			try {
				chatRooms = body ? (JSON.parse(body)).rooms : [];

				// if chatrooms is different, send update to browser
				if (socketToBrowser) {
					if (!isChatroomSame(oldChatrooms)) {
						console.log("Chatrooms changed, updating the client");
						socketToBrowser.emit('FromServer_AvailableRooms', chatRooms);
					}
				}
			}
			catch (e) {
				console.error('Error getting all chatrooms.')
				chatRooms = []
			}
		});
	}
}

/**
 * sendHeartBeatToServer
 * helper method to send heart beat to supernode. Used to keep contact with the supernode.
 * Constructs a POST request to sustain upkeep data and alive status to supernode.
 */
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

		request(options, (err, res, obj) => {
			try {
				if (!Object.keys(obj).length) {
					console.log("Heartbeat not received");
				} else if (res.body === 'Heartbeat received - Send message history') {
					console.log('Got a polling request');
					sendLogToServer(room);
				}
				else if (res.body === 'Heartbeat received') {
					// Ignore
				}
				else {
					// Log error coming from server
					console.error(res.body)
				}
			}
			catch (e) {
				console.error('Error occurred sending heartbeat.');
			}
		});
	});
}

function sendLogToServer(room){
	console.log("sending log to server for room "+room);

	const logToSend = chatLog.map((value) => {
		return {
			userId: value.userId,
			username: value.username,
			message: value.message
		}
	});

	let data = {
		chatId: room,
		log: logToSend
	};

	let options = {
		url: supernodeEndPoint + "/message",
		method: 'POST',
		json: data
	};

	request(options, (err, res, obj) => {
		try {
			if (!Object.keys(obj).length) {
				console.log("Heartbeat not received");
			}
			else if (res.body === 'Message log received') {
				// Ignore
			}
			else {
				// Log error coming from server
				console.error(res.body)
			}
		} catch (e) {
			console.error('Error occurred sending message log to supernode.');
		}
	});
}
