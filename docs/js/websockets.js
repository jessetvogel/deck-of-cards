var hostname = '';
var socket = null;

function websocket_connect(host) {
	// Connect to hostname port DECK
	socket = new WebSocket('ws://' + host + ':45311');

	// Show a connected message when the WebSocket is opened.
	socket.onopen = function(event) {
		document.getElementById('splash-address').style.display = 'none';
		document.getElementById('status').className = 'connected';
		document.getElementById('status-text').innerHTML = 'connected';
		
		console.log('Connected to: ' + event.currentTarget.url);
	};

	// Show a disconnected message when the WebSocket is closed.
	socket.onclose = function(event) {
		document.getElementById('splash-address').style.display = 'flex';
		document.getElementById('splash-room').style.display = 'flex';
		document.getElementById('status').className = 'disconnected';
		document.getElementById('status-text').innerHTML = 'disconnected';
	};

	// Handle any errors that occur.c
	socket.onerror = function(error) {
		document.getElementById('errorbox-address').innerHTML = 'could not connect to ' + hostname;
	};

	// Handle messages sent by the server.
	socket.onmessage = function(event) {
		if(typeof(debug) !== 'undefined')
			console.log('[RECEIVED] ' + event.data + '');
		receive_message(event.data);
	};

	// Funtion to send messages over websocket
	window.send_message = function (data) {
		if(typeof(debug) !== 'undefined')
			console.log('[SENT] ' + data + '');
		socket.send(data);
	}

	// Store hostname in cookie
	hostname = host;
	cookie_set('hostname', hostname, 365);
}
