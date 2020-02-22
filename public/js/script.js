let socket;

$(function () {
	socket = io();

	socket.emit('FromBrowser_ImYourBrowser');

	socket.on('FromServer_Message', function(msg){
		console.log("server sent message:");
		console.log(msg);
	});

	$('form').submit(function(e){
	  e.preventDefault(); // prevents page reloading
	  socket.emit('FromBrowser_Message', $('#m').val());
	  $('#m').val('');
	  return false;
	});
});