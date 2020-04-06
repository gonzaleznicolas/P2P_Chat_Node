
// GLOBAL VARIABLES
let socket;
let $inputMessage = $('.inputMessage'); // this is the input message from the input html element
let myUserId;

// ON PAGE LOAD
$(function () {

	var $window = $(window); // define window for listening
	socket = io({reconnection: false});

	// set some event listeners
	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);
	socket.on('FromServer_AvailableRooms', fromServer_AvailableRooms);
	socket.on('FromServer_ThisIsMyUserDetails', fromServer_ThisIsMyUserDetails);
	$("#leaveRoomButton").click( onLeaveRoom );
	$("#addNewChatroomButton").click( onAddNewRoom );
	$("#submitUsernameButton").click( onSubmitUsername );
	// listening in on key-board events
	$window.keydown(event => {
		// when a client node hits the "ENTER" key on their keyboard (so no enter button)
		if (event.which === 13) { // if enter
			var message = $inputMessage.val(); // grab value
			$inputMessage.val(''); // clear the inputmessage element
			giveUpdate(message); // call tob func
		}
	});

	// let the local server know how to reach its browser, and have it send down
	// a list of available rooms and my currently set username
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
function fromServer_OrderedUpdate(msgObject){
	addMessageToScreen(msgObject.userId, msgObject.username, msgObject.message)
}

function fromServer_ChatLog(chatLog){
	console.log("The whole chat history:");
	console.log(chatLog);

	$("#message_history").empty();

	chatLog.forEach( function (msgObject) {
		addMessageToScreen(msgObject.userId, msgObject.username, msgObject.message)
	});
}

function addMessageToScreen(userId, username, message){
	if (userId == myUserId){
		addMessageOnRight(username, message);
	}
	else{
		addMessageOnLeft(username, message);
	}
}

function addMessageOnLeft(username, message){
	$("#message_history").append(`
		<div class="incoming_msg">
			<div class="received_withd_msg">
				<p><b>${username}</b>&nbsp ${message}</p>
			</div>
		</div>
	`);
	// this will keep the chat window auto scrolled to bottom
	$("#message_history").scrollTop($("#message_history")[0].scrollHeight);
}

function addMessageOnRight(username, message){
	$("#message_history").append(`
		<div class="outgoing_msg">
			<div class="sent_msg">
				<p><b>${username}</b>&nbsp ${message}</p>
			</div>
		</div>
	`);
	// this will keep the chat window auto scrolled to bottom
	$("#message_history").scrollTop($("#message_history")[0].scrollHeight);
}

function fromServer_AvailableRooms(chatRooms){
	$("#existingRooms").empty();
	chatRooms.forEach( function (room) {
		let roomElement = $('<div class="btn btn-dark btn-lg btn-block"></div>');
		roomElement.text(room.chatRoomName);
		roomElement.click(function(){
			console.log("connecting to room "+ room.chatRoomName);
			connectToRoom(room.chatRoomId);
			$("#chatTitle").text(room.chatRoomName);
			changeToChatScreen();
		});
		$("#existingRooms").append(roomElement);
	})
	console.log(chatRooms);
}

function fromServer_ThisIsMyUserDetails(obj){
	myUserId = obj.userId;
	$("#usernameInput").val(obj.username);
	console.log("this is my myUserId", myUserId);
}

function changeToChatScreen(){
	$("#selectRoom").empty();
	$("#selectRoom").hide();
	$("#leaveRoomButton").show();
	$("#chat").show();
}

function onLeaveRoom(){
	socket.emit("FromBrowser_LeaveRoom");
	setTimeout(() => location.reload(), 1000);
}

function onAddNewRoom(){
	let newRoomName = $("#newChatroomName").val();
	socket.emit('FromBrowser_CreateRoom', newRoomName);
	$("#newChatroomName").val('');
	setTimeout(() => location.reload(), 1000);
}

function onSubmitUsername(){
	let newUsername = $("#usernameInput").val();
	socket.emit('FromBrowser_UpdateUsername', newUsername);
	$("#usernameInput").val(newUsername);
	$("#usernameInput").css("background-color", "lightgreen");
}
