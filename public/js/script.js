let socket;

$(function () {
	socket = io({reconnection: false});

	socket.emit('FromBrowser_ImYourBrowser', "some username");

});