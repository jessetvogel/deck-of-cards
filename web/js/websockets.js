var socket = new WebSocket('ws://' + window.location.hostname + ':45311');

// Show a connected message when the WebSocket is opened.
socket.onopen = function(event) {
	document.getElementById('status').innerHTML = 'connected';
	document.getElementById('status').className = 'connected';

	console.log('Connected to: ' + event.currentTarget.url);
};

// Show a disconnected message when the WebSocket is closed.
socket.onclose = function(event) {
  document.getElementById('status').innerHTML = 'disconnected';
  document.getElementById('status').className = 'disconnected';
};

// Handle any errors that occur.
socket.onerror = function(error) {
	console.log('WebSocket Error: ' + error);
};

// Handle messages sent by the server.
socket.onmessage = function(event) {
	console.log('Received: ' + event.data + '');
	receive_message(event.data);
};




function send_message(data) {
	socket.send(data);
}
