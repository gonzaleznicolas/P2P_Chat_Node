let socket;

$(function () {
	socket = io({reconnection: false});

	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);

	socket.emit('FromBrowser_ImYourBrowser');

});

// make a UI component so that the user can enter the ip and port of the server they want to connect to
// when they click "connect", call this function
function connectToServer(ip, port){
	socket.emit('FromBrowser_ConnectToServer', {ip: ip, port: port});
}

// when the user sends a message, call this function
function giveUpdate(msg){
	socket.emit("FromBrowser_GiveTobUpdate", msg);
}

// make it so this function adds a message to the chat
function fromServer_OrderedUpdate(update){
	console.log("Update from another chat member");
	console.log(update);
}

// make  it so this function removes all the messages in the chat, and replaces
// them with the chat log coming in
function fromServer_ChatLog(chatLog){
	console.log("The whole chat history:");
	console.log(chatLog);
}