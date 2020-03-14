let socket;

$(function () {
	socket = io({reconnection: false});

	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);

	socket.emit('FromBrowser_ImYourBrowser');

});

// the first thing the user should see when they "open the application"
// (run node index.js 3000 and connect to localhost:3000 on their browser)
// is a prompt to enter:
// 1. username
// 2. name of room you want to enter (if room does not already exist, you are creating a new room)
// 3. ip and port of a node in that room (call the function with ip and port undefined if there are no nodes in the room)
// NOTE: The user would know the room name, and the ip:port of a node in that room by visiting the directory website
function connectToRoom(username, roomName, ip, port){
	socket.emit('FromBrowser_ConnectToRoom', {username: username, roomName: roomName, ip: ip, port: port});
}

// when the user sends a message, call this function
function giveUpdate(msg){
	socket.emit("FromBrowser_GiveTobUpdate", msg);
}

// make it so this function adds a message to the chat
function fromServer_OrderedUpdate(update){
	console.log(update.fromUser, ":", update.message);
}

// make  it so this function removes all the messages in the chat, and replaces
// them with the chat log coming in
function fromServer_ChatLog(chatLog){
	console.log("The whole chat history:");
	console.log(chatLog);
}