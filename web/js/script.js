var canvas;
var ctx;

function init() {
	// Set canvas size
	canvas = document.getElementById('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	window.addEventListener('resize', function () {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
	});

	// Get canvas context
	ctx = canvas.getContext('2d');

	// Set event listeners
	canvas.addEventListener('mousedown', canvas_mouse_down, false);
	canvas.addEventListener('mouseup', canvas_mouse_up, false);
	canvas.addEventListener('mousemove', canvas_mouse_move, false);
	canvas.addEventListener('touchstart', canvas_touch_start, false);
	canvas.addEventListener('touchmove', canvas_touch_move, false);
	canvas.addEventListener('touchend', canvas_touch_end, false);

	// Prevent touch to cause to body scroll
	document.body.addEventListener('touchstart', function (e) { e.preventDefault(); }, false);
	document.body.addEventListener('touchmove', function (e) { e.preventDefault(); }, false);
	document.body.addEventListener('touchend', function (e) { e.preventDefault(); }, false);

	// Set render loop
	setInterval(render, 100);
}

function render() {
	// Clear canvas
    ctx.fillStyle = '#efebe9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cards
    for(let i = 0;i < cards.length; ++i)
    	render_card(cards[i]);
}

function render_card(card) {
  	let tex = document.getElementById('cards-texture');
  	let w = tex.width / 13;
  	let h = tex.height / 5;
  	
  	let sx, sy;
  	let value = card['value'];
  	if(value === '?') { // back of a card
  		sx = 0;
  		sy = 4 * h;
  	} else if(value === 'J') { // Joker
  		sx = w;
  		sy = 4 * h;
  	} else { // normal card
  		sx = NUMBERS_INDEX[value[1]] * w;
  		sy = SUITS_INDEX[value[0]] * h;
  	}

  	let pos = canvas_card_position(card);

	ctx.drawImage(tex, sx, sy, w, h, pos.x, pos.y, w, h);
}

// FOR DEBUGGING
var touchObj = null;

function canvas_mouse_down(e) {
	// let pos = canvas_mouse_position(e);
	// console.log('mouse down ' + pos.x + ',' + pos.y);
	if(touchObj == null) {
		touchObj = new Touch({
			identifier: Date.now(),
			target: canvas,
			clientX: e.clientX,
			clientY: e.clientY,
		    radiusX: 2.5,
		    radiusY: 2.5,
		    rotationAngle: 10,
		    force: 0.5,
		});
	}

	const touchEvent = new TouchEvent('touchstart', {
		cancelable: true,
		bubbles: true,
		touches: [touchObj],
		targetTouches: [touchObj],
		changedTouches: [touchObj],
		shiftKey: true,
	});

  	canvas.dispatchEvent(touchEvent);
}

function canvas_mouse_move(e) {
	// let pos = canvas_mouse_position(e);
	// console.log('mouse move ' + pos.x + ',' + pos.y);

	if(touchObj != null) {
		touchObj = new Touch({
			identifier: Date.now(),
			target: canvas,
			clientX: e.clientX,
			clientY: e.clientY,
		    radiusX: 2.5,
		    radiusY: 2.5,
		    rotationAngle: 10,
		    force: 0.5,
		});
		
		const touchEvent = new TouchEvent('touchmove', {
			cancelable: true,
			bubbles: true,
			touches: [touchObj],
			targetTouches: [touchObj],
			changedTouches: [touchObj],
			shiftKey: true,
		});

  		canvas.dispatchEvent(touchEvent);
  	}
}

function canvas_mouse_up(e) {
	// let pos = canvas_mouse_position(e);
	// console.log('mouse up ' + pos.x + ',' + pos.y);

	const touchEvent = new TouchEvent('touchend', {
		cancelable: true,
		bubbles: true,
		touches: [touchObj],
		targetTouches: [],
		changedTouches: [touchObj],
		shiftKey: true,
	});

  	canvas.dispatchEvent(touchEvent);

  	touchObj = null;
}

function canvas_touch_start(e) {
	console.log('Hey?' + e.targetTouches.length);

	if(e.targetTouches.length == 1) {
		let touch_position = canvas_touch_position(e, 0);

		cards_selected = [];
		for(let i = cards.length - 1;i >= 0; --i) {
			let card_position = canvas_card_position(cards[i]);
			let distance = Math.abs(card_position.x - touch_position.x) + Math.abs(card_position.y - touch_position.y);
			if(distance < 32) {
				cards_selected = [ i ];
				break;
			}
		}

		if(cards_selected.length > 0) {
			touch_action = TouchAction.CARD_MOVE;
			document.getElementById('status').innerHTML = 'selected card = ' + cards_selected[0];
		}
	}

	// document.getElementById('status').innerHTML = 'touches = ' + (e.targetTouches.length);
}

function canvas_touch_move(e) {
	if(e.targetTouches.length == 1) {
		if(touch_action == TouchAction.CARD_MOVE) {
			let touch_position = canvas_touch_position(e, 0);
			for(let i = 0;i < cards_selected.length; ++i) {
				cards[cards_selected[i]].position.x = touch_position.x - canvas.width / 2.0;
				cards[cards_selected[i]].position.y = touch_position.y - canvas.height / 2.0;
				document.getElementById('status').innerHTML = 'moved card ' + cards_selected[0] + ' to (' + touch_position.x + ', ' + touch_position.y + ')';
			}
		}
	}

	// document.getElementById('status').innerHTML = 'touches = ' + (e.targetTouches.length);
}

function canvas_touch_end(e) {
	if(e.targetTouches.length == 0) {
		touch_action = TouchAction.NONE;
	}

	document.getElementById('status').innerHTML = 'touches = ' + (e.targetTouches.length);
}

function canvas_mouse_position(e) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: e.clientX - rect.left,
		y: e.clientY - rect.top
	};
}

function canvas_touch_position(e, i) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: e.touches[i].clientX - rect.left,
		y: e.touches[i].clientY - rect.top
	};
}

function canvas_card_position(card) {
	return {
		x: canvas.width / 2.0 + card.position.x,
		y: canvas.height / 2.0 + card.position.y
	};
}


// -------- TOUCH INFORMATION --------

const TouchAction = { NONE: 0, SCROLL: 1, CARD_MOVE: 2, ZOOM: 3 };
Object.freeze(TouchAction);

var touch_identifiers = [];
var touch_action = TouchAction.NONE;

// -------- GAME INFORMATION --------

const TABLE_ID = -1;
const FACE_DOWN = 'D';
const FACE_UP = 'U';

const SUITS_INDEX = { 'S': 0, 'C': 1, 'H': 2, 'D': 3 }; // Spades, Clubs, Hearts, Diamonds
const NUMBERS_INDEX = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 }; // 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace

var player_id = -1;
var room_id = -1;

var cards = [];
// var cards_depth = []; // TODO
var players = [];
var player_names = {};

var cards_selected = [];

function receive_message(data) {
	// Split message, and omit empty messages
	s = data.split(' ');
	if(s.length == 0)
		return;

	// Find command
	c = s[0];
	args = s.slice(1);

	if(c === 'ok')
		return server_ok(args);
	if(c === 'error')
		return server_error(args);
	if(c === 'welcome')
		return server_welcome(args);
	if(c === 'room')
		return server_room(args);
	if(c === 'players')
		return server_players(args);
	if(c === 'cards')
		return server_cards(args);
	if(c === 'card')
		return server_card(args);
	if(c === 'name')
		return server_name(args);

	// Unknown message from server
	console.log('Unknown message from server: ' + data);
}

function server_ok(args) {}

function server_error(args) {
	alert('Error! ' + args.join(' '));
}

function server_welcome(args) {
	player_id = parseInt(args[0]);
}

function server_room(args) {
	room_id = args[0];
}

function server_players(args) {
	players = args.map(s => parseInt(s));
}

function server_cards(args) {
	let n = parseInt(args[0]);

	// Add cards if necessary
	for(let i = cards.length; i < n; ++i) {
		cards.push({
			value: '?',
			place: TABLE_ID,
			position: { x: 0.0, y: 0.0 },
			face: FACE_DOWN
		});
	}

	// Remove cards if necessary
	for(let i = cards.length; i > n; --i)
		cards.pop();
}

function server_card(args) {
	let id = parseInt(args[0]);
	Object.assign(cards[id], {
		value: args[1],
		place: parseInt(args[2]),
		position: { x: parseFloat(args[3]), y: parseFloat(args[4]) },
		face: args[5]
	});
}

function server_name(args) {
	player_names[parseInt(args[0])] = args.slice(1).join(' ');
}