let socket;

$(function () {
	socket = io({reconnection: false});

	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);
	socket.on('FromServer_AvailableRooms', fromServer_AvailableRooms);
	$("#leaveRoomButton").click( onLeaveRoom );

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

	$("#message_history").empty();

	chatLog.forEach( function (msgObject) {
		$("#message_history").append(`
			<div class="incoming_msg">
				<div class="received_withd_msg">
					<p><b>Nico</b>&nbsp ${msgObject.message}</p>
				</div> 
			</div>
		`);
	})
}

function fromServer_AvailableRooms(chatRooms){
	$("#existingRooms").empty();
	chatRooms.forEach( function (room) {
		let roomElement = $("<div></div>");
		roomElement.text(room.chatRoomName);
		roomElement.click(function(){
			console.log("connecting to room "+ room.chatRoomName);
			connectToRoom(room.chatRoomId);
			changeToChatScreen();
		});
		$("#existingRooms").append(roomElement);
	})
	console.log(chatRooms);
}

function changeToChatScreen(){
	$("#selectRoom").empty();
	$("#selectRoom").hide();
	$("#chat").show();
}

function onLeaveRoom(){
	socket.emit("FromBrowser_LeaveRoom");
}