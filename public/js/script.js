let socket;

$(function () {
	socket = io();
	$('form').submit(function(e){
	  e.preventDefault(); // prevents page reloading
	  socket.emit('FromBrowser_Message', $('#m').val());
	  $('#m').val('');
	  return false;
	});
  });