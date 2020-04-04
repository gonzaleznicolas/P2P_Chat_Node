let socket;

$(function () {
	socket = io({reconnection: false});

	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);
	socket.on('FromServer_AvailableRooms', fromServer_AvailableRooms);

	socket.emit('FromBrowser_ImYourBrowser');

});


// function connectToRoom(username, roomName, ip, port, identifier){
// 	socket.emit('FromBrowser_ConnectToRoom', {username: username, roomName: roomName, ip: ip, port: port, identifier: identifier});
// }

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

// When a new user joins, everyone else currently in the chat
// will send its chat log to the newcomer so that the new user has the chat history.
// this function is called when the current user receives a chat log. Unfortunately,
// EVERYONE in the chat will send the chat log, so if there are currently 3 users in a chat room,
// and I join, all three of them will send me their chat log. This function will be called each of those times.
// so UI team, please modify this function so that when it is called, the browser removes all the messages
// on the screen, and replaces them with the ones passed into this function. This will only happen when the
// newcomer first joins, so its not a big issue. Of course it would be nice if just one of the chat participants
// sent it. But trust me on this one, it gets really complicated to make sure only one of them sends it.
// so its easier to just do this, and it will happen so quickly that it will not be noticeable.D
function fromServer_ChatLog(chatLog){
	console.log("The whole chat history:");
	console.log(chatLog);
}

function fromServer_AvailableRooms(chatRooms){
	console.log("Available chat rooms:");
	console.log(chatRooms);
}