let socket;

$(function () {
	socket = io();
	$('form').submit(function(e){
	  e.preventDefault(); // prevents page reloading
	  socket.emit('message from browser', $('#m').val());
	  $('#m').val('');
	  return false;
	});
  });