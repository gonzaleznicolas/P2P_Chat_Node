let socket;
let username;

// on load adjust header to window height
$(document).ready(function(){
    $('.header').height($(window).height());
});


// to convert a ts obj to a nice casual time zone
function tsconvert(ts) {
    formatted_ts = ts.
    replace(/T/, ' ').  // nuke the T
        replace(/\..+/, ''); // nuke Time Zone info

    return formatted_ts
}



$(function () {
    socket = io({reconnection: false});

    socket.on('FromServer_OrderedUpdate', fromServer_OrderedUpdate);
    socket.on('FromServer_ChatLog', fromServer_ChatLog);

    socket.emit('FromBrowser_ImYourBrowser');

});

// the first thing the user should see when they "open the application"
// (run node index.js <port> and connect to localhost:<port> on their browser)
// is a prompt to enter:
// 1. username
// 2. name of room you want to enter (if room does not already exist, you are creating a new room)
// 3. ip and port of a node in that room (call the function with ip and port undefined if there are no nodes in the room)
// NOTE: The user would know the room name, and the ip:port of a node in that room by visiting the directory website
// once that information has been entered and the user clicks "connect", call this function
function connectToRoom(username, roomName, ip, port){
    socket.emit('FromBrowser_ConnectToRoom', {username: username, roomName: roomName, ip: ip, port: port});
}

// when the user sends a message, call this function
function giveUpdate(msg){
    socket.emit("FromBrowser_GiveTobUpdate", msg);
}

// this function gets called when there is a new message. Modify this function so the message is displayed on the screen
function fromServer_OrderedUpdate(update){
    console.log(update.fromUser, ":", update.message);

    console.log('The update message is: ' + update.message);
    // $('#messages').append($('<li>').text(update.message));  // plain text

    $('#messages').append($('<li>').html(
        '<p>'
        +" " + update.fromUser+ " : " + update.message
        +
        '</p>'
    ));
    // like so;
    // this will keep the chat window auto scrolled to bottom
    $(".msg_history").scrollTop($("#messages")[0].scrollHeight);
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





// start doc and listen
$(document).ready(onLoad());

function onLoad() {
    console.log("initiating client.js");

    /*
    any client side necessary emissions here

    */

    //init variables
    let socket = io();

    // catch user connections
    socket.on('user-connection-detected', function(username){
        console.log('User has connected and now inside onload() ');
        // add user to front end list
        username = 'ASSIGNME';
        // add emits here to add a user
        //console.log('name assigned')

    });

}

