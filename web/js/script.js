var canvas;
var ctx;

function setup_canvas() {
	canvas = document.getElementById('canvas');

	// Set canvas size (note the DPR!)
	let DPR = window.devicePixelRatio || 1;
	// let DPR = 1;
	canvas.width = window.innerWidth * DPR;
	canvas.height = window.innerHeight * DPR;

	// Set view
	view.w = window.innerWidth;
	view.h = window.innerHeight;
	view.x = -view.w / 2.0;
	view.y = -view.h / 2.0;

	// Get canvas context
	ctx = canvas.getContext('2d');
	ctx.scale(DPR, DPR); // Scale all drawing operations by the dpr, so we don't have to worry about the difference.
	ctx.imageSmoothingEnabled = true;
}

function init() {
	// Setup canvas
	setup_canvas();
	window.addEventListener('resize', setup_canvas);
	
	// Set event listeners
	canvas.addEventListener('mousedown', canvas_mouse_down, false);
	canvas.addEventListener('mouseup', canvas_mouse_up, false);
	canvas.addEventListener('mousemove', canvas_mouse_move, false);
	canvas.addEventListener('touchstart', canvas_touch_start, false);
	canvas.addEventListener('touchmove', canvas_touch_move, false);
	canvas.addEventListener('touchend', canvas_touch_end, false);

	// Set render loop & update loop
	setInterval(render, 20);
	setInterval(send_cards_updated, 100);


	// Action buttons
	document.getElementById('action-shuffle').addEventListener('click', function () {
		// Send shuffle signal
		let ids = [];
		for(let i = 0;i < cards_selected.length; ++i)
			ids.push(cards_selected[i]);
		send_message('shuffle ' + ids.join(' '));
		cards_selected = [];

		// Hide buttons & unselect cards
		hide_actions();
		cards_selected = []
	});
}

function render() {
	// Clear canvas
	ctx.clearRect(0, 0, view.w, view.h);

    // Draw cards (based on depth)
    for(let i = 0;i < cards_depth.length; ++i)
    	render_card(cards_depth[i]);
}

function render_card(id) {
	let card = cards[id];
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

  	let card_box = canvas_card_box(card);
  	let x = card_box.x - view.x;
  	let y = card_box.y - view.y;
  	// Draw outline (if selected)
  	if(cards_selected.includes(id)) {
  		ctx.strokeStyle = 'red';
 		ctx.strokeRect(x, y, card_box.w, card_box.h); 
  	}

  	// Draw image
	ctx.drawImage(tex, sx, sy, w, h, x, y, card_box.w, card_box.h);
}

// FOR DEBUGGING
// var touchObj = null;

function canvas_mouse_down(e) {
	
	// if(touchObj == null) {
	// 	touchObj = new Touch({
	// 		identifier: Date.now(),
	// 		target: canvas,
	// 		clientX: e.clientX,
	// 		clientY: e.clientY,
	// 	    radiusX: 2.5,
	// 	    radiusY: 2.5,
	// 	    rotationAngle: 10,
	// 	    force: 0.5,
	// 	});
	// }

	// const touchEvent = new TouchEvent('touchstart', {
	// 	cancelable: true,
	// 	bubbles: true,
	// 	touches: [touchObj],
	// 	targetTouches: [touchObj],
	// 	changedTouches: [touchObj],
	// 	shiftKey: true,
	// });

 //  	// canvas.dispatchEvent(touchEvent);
}

function canvas_mouse_move(e) {
	
	// if(touchObj != null) {
	// 	touchObj = new Touch({
	// 		identifier: Date.now(),
	// 		target: canvas,
	// 		clientX: e.clientX,
	// 		clientY: e.clientY,
	// 	    radiusX: 2.5,
	// 	    radiusY: 2.5,
	// 	    rotationAngle: 10,
	// 	    force: 0.5,
	// 	});
		
	// 	const touchEvent = new TouchEvent('touchmove', {
	// 		cancelable: true,
	// 		bubbles: true,
	// 		touches: [touchObj],
	// 		targetTouches: [touchObj],
	// 		changedTouches: [touchObj],
	// 		shiftKey: true,
	// 	});

 //  		// canvas.dispatchEvent(touchEvent);
 //  	}
}

function canvas_mouse_up(e) {

	// const touchEvent = new TouchEvent('touchend', {
	// 	cancelable: true,
	// 	bubbles: true,
	// 	touches: [touchObj],
	// 	targetTouches: [],
	// 	changedTouches: [touchObj],
	// 	shiftKey: true,
	// });

 //  	// canvas.dispatchEvent(touchEvent);

 //  	touchObj = null;
}

function canvas_touch_start(e) {
	if(e.targetTouches.length == 1) {
		let touch_position = canvas_touch_position(e, 0);

		// Clicked on a card?
		cards_selected = [];
		for(let i = cards_depth.length - 1;i >= 0; --i) {
			let id = cards_depth[i];
			let card_box = canvas_card_box(cards[id]);
			if(point_in_box(touch_position, card_box)) {
				cards_selected = [ id ];
				cards_touch_offset[id] = {
					dx: card_box.x + CARD_WIDTH / 2 - touch_position.x,
					dy: card_box.y + CARD_HEIGHT / 2 - touch_position.y
				};
				break;
			}
		}

		// Clicked on a card
		if(cards_selected.length > 0) {
			touch_action = TouchAction.CARD_SELECT;
			(function (e) {
				touch_long_hold_timer = setTimeout(function () {
					touch_long_hold_timer = null;
					cards_select_pile(canvas_touch_position(e, 0));
				}, TOUCH_LONG_HOLD_TIME);	
			})(e);
			
		}

		// Click on background
		else {
			touch_action = TouchAction.SCROLL;
			touch_identifiers = [{
				id: e.targetTouches[0].identifier,
				x: e.targetTouches[0].clientX,
				y: e.targetTouches[0].clientY
			}];
			hide_actions();
		}
	}
}

function canvas_touch_move(e) {
	if(e.targetTouches.length == 1) {
		if(touch_action == TouchAction.CARD_SELECT) {
			if(touch_long_hold_timer !== null) {
				clearTimeout(touch_long_hold_timer);
				touch_long_hold_timer = null;
			}

			touch_action = TouchAction.CARD_MOVE;
			hide_actions();
		}

		if(touch_action == TouchAction.CARD_MOVE) {
			let touch_position = canvas_touch_position(e, 0);
			for(let i = 0;i < cards_selected.length; ++i) {
				let id = cards_selected[i];
				let card = cards[id];
				card.position.x = touch_position.x + cards_touch_offset[id].dx;
				card.position.y = touch_position.y + cards_touch_offset[id].dy;
				if(!cards_updated.position.includes(id))
					cards_updated.position.push(id);
			}
		}

		if(touch_action == TouchAction.SCROLL && touch_identifiers[0].id == e.targetTouches[0].identifier) {
			let touch_position = canvas_touch_position(e, 0);
			let dx = e.targetTouches[0].clientX - touch_identifiers[0].x;
			let dy = e.targetTouches[0].clientY - touch_identifiers[0].y;

			view.x -= dx;
			view.y -= dy;

			touch_identifiers[0].x = e.targetTouches[0].clientX;
			touch_identifiers[0].y = e.targetTouches[0].clientY;
		}
	}
}

function canvas_touch_end(e) {
	if(e.targetTouches.length == 0) {

		if(touch_action == TouchAction.CARD_SELECT && touch_long_hold_timer !== null) {
			clearTimeout(touch_long_hold_timer);
			touch_long_hold_timer = null;
			// document.getElementById('status').innerHTML = 'STOPPED TIMER!';
			let id = cards_selected[0];
			let card = cards[id];
			card.face = (card.face == FACE_DOWN ? FACE_UP : FACE_DOWN);
			if(!cards_updated.face.includes(id))
				cards_updated.face.push(id);
			touch_action = TouchAction.NONE;
		}

		if(touch_action == TouchAction.CARD_MOVE || (touch_action == TouchAction.CARD_SELECT && cards_selected.length <= 1)) {
			touch_action = TouchAction.NONE;
			cards_selected = [];
		}
	}
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
		x: e.touches[i].clientX - rect.left + view.x,
		y: e.touches[i].clientY - rect.top + view.y
	};
}

function canvas_card_box(card) {
	return {
		x: card.position.x - CARD_WIDTH / 2,
		y: card.position.y - CARD_HEIGHT / 2,
		w: CARD_WIDTH,
		h: CARD_HEIGHT
	};
}

function cards_select_pile(cursor) {
	// Select all pressed cards
	cards_selected = [];
	for(let i = 0;i < cards.length; ++i) {
		let box_i = canvas_card_box(cards[i]);
		if(point_in_box(cursor, box_i)) {
			cards_selected.push(i);
			cards_touch_offset[i] = {
				dx: box_i.x + CARD_WIDTH / 2 - cursor.x,
				dy: box_i.y + CARD_HEIGHT / 2 - cursor.y
			}
		}
	}

	// If a card touches a card on the pile, add it to the pile as well
	let i = 0;
	while(i < cards_selected.length) {
		let box = canvas_card_box(cards[cards_selected[i]]);
		for(let j = 0;j < cards.length; ++j) {
			let box_j = canvas_card_box(cards[j]);
			if(!cards_selected.includes(j) && boxes_overlap(box, box_j)) {
				cards_selected.push(j);
				cards_touch_offset[j] = {
					dx: box_j.x + CARD_WIDTH / 2 - cursor.x,
					dy: box_j.y + CARD_HEIGHT / 2 - cursor.y
				}
			}
		}
		++i;
	}

	// Show actions
	show_actions(['shuffle']);
}

function show_actions(actions) {
	for(let i = 0;i < actions.length; ++i) {
		let el = document.getElementById('action-' + actions[i]);
		if(el != null)
			el.style.display = 'block';
	}
}

function hide_actions() {
	for(let el of document.querySelectorAll('#actions div'))
		el.style.display = 'none';
}


// -------- GAME DATA INFORMATION --------

const TABLE_ID = -1;
const FACE_DOWN = 'D';
const FACE_UP = 'U';

const SUITS_INDEX = { 'S': 0, 'C': 1, 'H': 2, 'D': 3 }; // Spades, Clubs, Hearts, Diamonds
const NUMBERS_INDEX = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 }; // 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace

var player_id = -1;
var room_id = -1;

var cards = [];
var cards_depth = [];
var players = [];
var player_names = {};

var cards_updated = {
	place: [],
	position: [],
	face: []
};

// -------- GAME VISUAL INFORMATION --------

const CARD_WIDTH = 48;
const CARD_HEIGHT = 64;
const TouchAction = { NONE: 0, SCROLL: 1, ZOOM: 2, CARD_SELECT: 3, CARD_MOVE: 4 }; Object.freeze(TouchAction);
const TOUCH_LONG_HOLD_TIME = 500;

var view = {
	x: 0.0,
	y: 0.0,
	w: 1.0,
	h: 1.0
};

var cards_selected = [];
var cards_touch_offset = [];
var touch_identifiers = [];
var touch_action = TouchAction.NONE;
var touch_long_hold_timer = null;


// -------- GAME DATA FUNCTIONS --------

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

	// Set cards depth (initially based on id)
	cards_depth = [];
	for(let i = 0;i < n; ++i)
		cards_depth.push(i);
}

function server_card(args) {
	// Update card
	let id = parseInt(args[0]);
	Object.assign(cards[id], {
		value: args[1],
		place: parseInt(args[2]),
		position: { x: parseFloat(args[3]), y: parseFloat(args[4]) },
		face: args[5]
	});

	// Put card on top
	let index = cards_depth.indexOf(id);
	if(index > -1) {
  		cards_depth.splice(index, 1);
		cards_depth.push(id);
	}
}

function server_name(args) {
	player_names[parseInt(args[0])] = args.slice(1).join(' ');
}

function send_cards_updated() {
	// Place

	// Position
	if(cards_updated.position.length > 0) {
		for(let i = 0;i < cards_updated.position.length; ++i) {
			let card = cards[cards_updated.position[i]];
			send_message('move ' + float_to_2_decimals(card.position.x) + ' ' + float_to_2_decimals(card.position.y) + ' ' + cards_updated.position[i]);
		}
		cards_updated.position = [];
	}

	// Face
	if(cards_updated.face.length > 0) {
		let face_ups = [];
		let face_downs = [];
		for(let i = 0;i < cards_updated.face.length; ++i)
			(cards[cards_updated.face[i]].face == FACE_UP ? face_ups : face_downs).push(cards_updated.face[i]);
		if(face_ups.length > 0)
			send_message('face ' + FACE_UP + ' ' + face_ups.join(' '));
		if(face_downs.length > 0)
			send_message('face ' + FACE_DOWN + ' ' + face_downs.join(' '));
		cards_updated.face = [];
	}
}


// -------- UTIL FUNCTIONS --------

function point_in_box(point, box) {
	return point.x > box.x && point.x < box.x + box.w && point.y > box.y && point.y < box.y + box.h;
}

function boxes_overlap(A, B) {
	return !(A.x + A.w < B.x || A.x > B.x + B.w || A.y > B.y + B.h || A.y + A.h < B.y);
}

function float_to_2_decimals(f) {
	return f.toFixed(2);
}

