/* Mesh Chat - Developed by Michael Han, Nicolas Gonzalez, Sadat Islam, Chevy O’Dell, and Kent Wong
CPSC 559 Winter 2020

This script will contain the front end node logic. All logic the front end would need to send and receive chat messages
is handled within this script.

Once the program is started and serves the HTML Index, it will load this script to handle events.
There is a function onload that will listen for socket IO events such as "FromServer_OrderedUpdate" which then calls
a corresponding helper function.


*/

// GLOBAL VARIABLES
let socket;
let $inputMessage = $('.inputMessage'); // this is the input message from the input html element
let myUserId;

// ON PAGE LOAD to listen for Socket.IO emits

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

// HELPER METHODS

/**
 * Connect To A Room.
 * @param {string} chatID - The unique identifier of a chat room
 */
function connectToRoom(chatID){
	socket.emit('FromBrowser_ConnectToRoom', {chatID: chatID});
}

/**
 * Send a chat update (TOB).
 * When the user sends a message, call this function
 * @param {string} msg - The unique identifier of a chat room
 */
function giveUpdate(msg){
	socket.emit("FromBrowser_GiveTobUpdate", msg);
}

/**
 * Receive an Ordered Update from the supernode (server)
 * This is a receiver function from the server, which then calls a local function to append the data properties
 * to the screen
 * @param {object} msgObject - An object containing string data that
 * should contain 3 properties: userID, username, and message
 */
function fromServer_OrderedUpdate(msgObject){
	addMessageToScreen(msgObject.userId, msgObject.username, msgObject.message)
}

/**
 * Receive the chatlog from the supernode (server)
 * This is a receiver function from the server, which then clears history and iterates over the chat history object
 * and appends the chat to screen
 * @param {object} chatLog - An object that contains string data pertaining to chat
 */
function fromServer_ChatLog(chatLog){
	console.log("The whole chat history:");
	console.log(chatLog);

	$("#message_history").empty();

	chatLog.forEach( function (msgObject) {
		addMessageToScreen(msgObject.userId, msgObject.username, msgObject.message)
	});
}

/**
 * Helper method to add string data to the screen
 * @param {string} userId - The User ID which should be a UUID (unique string)
 * @param {string} username - A non unique name which is the user's selected alias
 * @param {string} message - Desired chat string
 */
function addMessageToScreen(userId, username, message){
	// as a potential debug note, we are using non strict equality operator here
	// assumption is to compare value of str and number
	if (userId === myUserId){
		addMessageOnRight(username, message);
	}
	else{
		addMessageOnLeft(username, message);
	}
}

/**
* Helper method to add a message on the left side
* @param {string} username
* @param {string} message
*/
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

/**
 * Helper method to add a message on the right side
 * @param {string} username
 * @param {string} message
 */
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

/**
 * Receiving function from supernode to query available rooms
 * Will receive a list of available chat rooms the user can enter
 * @param {object} chatRooms
 */
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
	});
	console.log(chatRooms);
}

/**
 * Receiving function from supernode to get user details
 *
 * @param obj {object} contains string data such as user uuid and alias
 */
function fromServer_ThisIsMyUserDetails(obj){
	myUserId = obj.userId;
	$("#usernameInput").val(obj.username);
	console.log("this is my myUserId", myUserId);
}

/**
 * Helper method to change display of room.
 */
function changeToChatScreen(){
	$("#selectRoom").empty();
	$("#selectRoom").hide();
	$("#leaveRoomButton").show();
	$("#chat").show();
}

/**
 * Helper method to emit to server node that this browser has left/disconnected
 * calls a time out with 1000ms
 */
function onLeaveRoom(){
	socket.emit("FromBrowser_LeaveRoom");
	setTimeout(() => location.reload(), 1000);
}

/**
 * Helper method to emit to server node that there is a new chat room
 * emits the new chatroom name to the server node
 */
function onAddNewRoom(){
	let newRoomName = $("#newChatroomName").val();
	socket.emit('FromBrowser_CreateRoom', newRoomName);
	$("#newChatroomName").val('');
	setTimeout(() => location.reload(), 1000);
}

/**
 * Helper method to emit that a user has selected a desired alias (username)
 * emits the new username to server node
 */
function onSubmitUsername(){
	let newUsername = $("#usernameInput").val();
	socket.emit('FromBrowser_UpdateUsername', newUsername);
	$("#usernameInput").val(newUsername);
	$("#usernameInput").css("background-color", "lightgreen");
}
