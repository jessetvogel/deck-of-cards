var socket = new WebSocket('ws://localhost:13254');

// Show a connected message when the WebSocket is opened.
socket.onopen = function(event) {
	console.log('Connected to: ' + event.currentTarget.url);
	// socketStatus.className = 'open';
};

// Show a disconnected message when the WebSocket is closed.
socket.onclose = function(event) {
  socketStatus.innerHTML = 'Disconnected from WebSocket.';
  socketStatus.className = 'closed';
};

// Handle any errors that occur.
socket.onerror = function(error) {
	console.log('WebSocket Error: ' + error);
};

// Handle messages sent by the server.
socket.onmessage = function(event) {
	console.log('Received: ' + event.data + '');
};

