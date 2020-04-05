let socket;
let state = "browsingRooms"; // "browsingRooms" or "inRoom"

$(function () {
	socket = io({reconnection: false});

	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);
	socket.on('FromServer_AvailableRooms', fromServer_AvailableRooms);

	socket.emit('FromBrowser_ImYourBrowser');

});

function connectToRoom(chatID){
	socket.emit('FromBrowser_ConnectToRoom', {chatID: chatID});
}

// when the user sends a message, call this function
function giveUpdate(msg){
	socket.emit("FromBrowser_GiveTobUpdate", msg);
}

// this function gets called when there is a new message. Modify this function so the message is displayed on the screen
function fromServer_OrderedUpdate(update){
	console.log(update.fromUser, ":", update.message);
}

function fromServer_ChatLog(chatLog){
	console.log("The whole chat history:");
	console.log(chatLog);
}

function fromServer_AvailableRooms(chatRooms){
	console.log("Available chat rooms:");
	console.log(chatRooms);
}