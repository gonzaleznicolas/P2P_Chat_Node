var userName;
let nodeId;
let socket;
let $loginPage = $("#login");
let $usernameInput =  $('#usernameInput'); 
// var $inputMessage = $('.inputMessage');

$(function () {

	var $window = $(window); // define window for listening

	socket = io({reconnection: false});

	socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
	socket.on('FromServer_ChatLog', fromServer_ChatLog);
	socket.on('FromServer_ImYourServer', fromServer_ImYourServer);
	$("#leaveRoomButton").click( onLeaveRoom );

	// listening in on key-board events
	$window.keydown(event => {
		// when a client node hits the "ENTER" key on their keyboard (so no enter button)
		if (event.which === 13) { // if enter
			if (userName) {
				var message = $inputMessage.val(); // grab value
				$inputMessage.val(''); // clear the inputmessage element
				giveUpdate(message); // call tob func
			} else {
				setUserName();
			}
		}
	});

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
	//debug
	console.log('The update object is: ' + update);

	// $('#messages').append($('<li>').text(update.message));  // plain text
	// for incoming
	$("#message_history").append(`
			<div class="outgoing_msg">
				<div class="sent_msg">
					<p><b>&nbsp ${update.fromUser}</b>&nbsp ${update.message}</p>
				</div>
			</div>
		`);
	// like so;
	// this will keep the chat window auto scrolled to bottom
	$(".msg_history").scrollTop($("#message_history")[0].scrollHeight);

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

function setUserName() {
	console.log("Setting User Name");
	userName = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (userName) {
	  // Tell the server your username
	  $loginPage.empty();
	  $loginPage.hide();
	  socket.emit('FromBrowser_ImYourBrowser', {userName: userName});
    }
}

function cleanInput (input) {
    return $('<div/>').text(input).html();
}

function fromServer_ImYourServer(obj){
	let chatRooms = obj.chatRooms;
	nodeId = obj.nodeId;
	console.log(nodeId);
	$("#existingRooms").empty();
	chatRooms.forEach( function (room) {
		let roomElement = $('<div class="btn btn-dark btn-lg btn-block"></div>');
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
	$("#leaveRoomButton").show();
	$("#chat").show();
}

function onLeaveRoom(){
	socket.emit("FromBrowser_LeaveRoom");
	setTimeout(() => location.reload(), 1000);
}
