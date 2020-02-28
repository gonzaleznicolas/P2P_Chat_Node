let socket;

$(function () {
	socket = io();

	socket.emit('FromBrowser_ImYourBrowser', "some username");

});