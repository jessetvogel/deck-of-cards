var canvas;
var ctx;
var canvas_should_render;

function init() {
	// Setup canvas
	setup_canvas();
	window.addEventListener('resize', setup_canvas);
	
	// Set event listeners
	canvas.addEventListener('touchstart', canvas_touch_start, false);
	canvas.addEventListener('touchmove', canvas_touch_move, false);
	canvas.addEventListener('touchend', canvas_touch_end, false);
	
	// For non-touch devices
	if(!('ontouchstart' in window)) {
		canvas.addEventListener('mousedown', canvas_mouse_down, false);
		canvas.addEventListener('mouseup', canvas_mouse_up, false);
		canvas.addEventListener('mousemove', canvas_mouse_move, false);
	}

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
		
		// Hide buttons & unselect cards
		actions_hide();
		cards_selected = [];
	});

	document.getElementById('action-pile').addEventListener('click', function () {
		// Compute center of mass
		let center_x = 0.0, center_y = 0.0;
		for(let i = 0;i < cards_selected.length; ++i) {
			center_x += cards[cards_selected[i]].position.x
			center_y += cards[cards_selected[i]].position.y
		}
		center_x /= cards_selected.length;
		center_y /= cards_selected.length;

		// Move all cards to center
		for(let i = 0;i < cards_selected.length; ++i)
			card_update_position(cards_selected[i], center_x, center_y);
	});

	document.getElementById('action-flip').addEventListener('click', function () {
		// If any card is face up, make all face down
		let are_cards_face_up = false;
		for(let i = 0;i < cards_selected.length; ++i) {
			if(cards[cards_selected[i]].face == FACE_UP) {
				are_cards_face_up = true;
				break;
			}
		}

		for(let i = 0;i < cards_selected.length; ++i)
			card_update_face(cards_selected[i], are_cards_face_up ? FACE_DOWN : FACE_UP);
	});

	// Splash buttons
	let input_address_click = function () {
		let hn = document.getElementById('input-address').value;
		websocket_connect(hn);
	}
	document.getElementById('button-address').addEventListener('click', input_address_click);
	document.getElementById('input-address').addEventListener('keyup', function (e) {
		if(e.key == 'Enter')
			input_address_click();	
	});

	document.getElementById('button-room-create').addEventListener('click', function () {
		send_message('create');
	});
	document.getElementById('button-room-join').addEventListener('click', function () {
		let room_id = document.getElementById('input-room-join').value;
		send_message('join ' + room_id);
	});

	// Input fields
	document.getElementById('input-address').value = cookie_get('hostname');

	// Card texture
	card_texture = document.getElementById('cards-texture');
}

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

	// Initially, should render
	canvas_should_render = true;
}

function render() {
	// Only render when something is updated
	if(!canvas_should_render)
		return;
	canvas_should_render = false;

	// Clear canvas
	ctx.clearRect(0, 0, view.w, view.h);

    // Update card animations
    cards_update_animation();

    // Draw cards on table (based on depth)
    for(let i = 0;i < cards_depth.length; ++i) {
    	if(cards[cards_depth[i]].place == TABLE_ID)
    		render_card(cards_depth[i]);
    }

    // Draw player hand
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, view.h - HAND_HEIGHT, view.w, HAND_HEIGHT);

    // Draw cards in player hand (based on depth)
    for(let i = 0;i < cards_depth.length; ++i) {
    	if(cards[cards_depth[i]].place == player_id)
    		render_card(cards_depth[i]);
    }
}

function render_card(id) {
	// Only render cards that are on the table or in your hand
	let card = cards[id];
	if(card.place != TABLE_ID && card.place != player_id)
		return;

  	let w = card_texture.width / 13;
  	let h = card_texture.height / 5;
  	
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

  	let card_box = game_card_box(card);
  	let x, y;
  	if(card.place == TABLE_ID) {
  		x = card_box.x - view.x;
  		y = card_box.y - view.y;
  	}
  	if(card.place == player_id) {
  		x = card_box.x + view.w / 2;
  		y = card_box.y + view.h - HAND_HEIGHT / 2;
  	}
  	// Draw outline (if selected)
  	if(cards_selected.includes(id)) {
  		ctx.strokeStyle = 'red';
 		ctx.strokeRect(x, y, card_box.w, card_box.h); 
  	}

  	// Draw image
	ctx.drawImage(card_texture, sx, sy, w, h, x, y, card_box.w, card_box.h);
}

// -------- INPUT FUNCTIONS --------

function canvas_touch_start(e) {
	for(let i = 0;i < e.changedTouches.length; ++i) {
		let t = e.changedTouches[i];
		touch_data[t.identifier] = {
			action: TouchAction.NONE,
			position: {
				x: t.clientX,
				y: t.clientY,
				dx: 0.0,
				dy: 0.0
			}
		};
		touch_start(t.identifier);
	}
}

function canvas_touch_move(e) {
	for(let i = 0;i < e.changedTouches.length; ++i) {
		let t = e.changedTouches[i];
		let old_position = touch_data[t.identifier].position;
		touch_data[t.identifier].position = {
			x: t.clientX,
			y: t.clientY,
			dx: t.clientX - old_position.x,
			dy: t.clientY - old_position.y
		};;
		touch_move(t.identifier);
	}
}

function canvas_touch_end(e) {
	for(let i = 0;i < e.changedTouches.length; ++i) {
		let t = e.changedTouches[i];
		touch_end(t.identifier);
		delete touch_data[t.identifier];
	}
}

function canvas_mouse_down(e) {
	touch_data[0] = {
		action: TouchAction.NONE,
		position: {
			x: e.clientX,
			y: e.clientY,
			dx: 0.0,
			dy: 0.0
		}
	}
	touch_start(0);
}

function canvas_mouse_move(e) {
	if(!(0 in touch_data))
		return;

	let old_position = touch_data[0].position;
	touch_data[0].position = {
		x: e.clientX,
		y: e.clientY,
		dx: e.clientX - old_position.x,
		dy: e.clientY - old_position.y
	};
	touch_move(0);
}

function canvas_mouse_up(e) {
	touch_end(0);
	delete touch_data[0];
}

// -------- GAME INPUT FUNCTIONS --------

function touch_start(touch_id) {
	let touch_position = touch_data[touch_id].position;
	let touch_hovers_hand = (touch_position.y >= view.h - HAND_HEIGHT);
	let game_position = touch_hovers_hand ? touch_to_hand_position(touch_position) : touch_to_game_position(touch_position);

	// Clicked on a card?
	actions_hide();
	cards_selected = [];
	cards_offset = {};
	for(let i = cards_depth.length - 1;i >= 0; --i) {
		let id = cards_depth[i];
		let card_box = game_card_box(cards[id]);
		if(((touch_hovers_hand && cards[id].place == player_id) || (!touch_hovers_hand && cards[id].place == TABLE_ID)) && point_in_box(game_position, card_box)) {
			cards_selected.push(id);
			cards_offset[id] = {
				x: cards[id].position.x - game_position.x,
				y: cards[id].position.y - game_position.y
			};
			break;
		}
	}

	// Clicked on a card
	if(cards_selected.length > 0) {
		touch_data[touch_id].action = TouchAction.CARD_SELECT;
		(function (place, p) {
			touch_long_hold_timer = setTimeout(function () {
				touch_long_hold_timer = null;
				cards_select_pile(place, p);
			}, TOUCH_LONG_HOLD_TIME);	
		})(touch_hovers_hand ? player_id : TABLE_ID, game_position);
		
	}

	// Clicked on background
	else {
		touch_data[touch_id].action = TouchAction.SCROLL;
		actions_hide();
	}
	
	canvas_should_render = true;
}

function touch_move(touch_id) {
	if(touch_data[touch_id].action == TouchAction.CARD_SELECT) {
		if(touch_long_hold_timer !== null) {
			clearTimeout(touch_long_hold_timer);
			touch_long_hold_timer = null;
		}

		touch_data[touch_id].action = TouchAction.CARD_MOVE;

		// Move selected cards to the top
		cards_selected.sort((a, b) => cards_depth.indexOf(a) - cards_depth.indexOf(b));
		cards_depth = cards_depth.filter(x => !cards_selected.includes(x)).concat(cards_selected);
		actions_hide();
	}

	if(touch_data[touch_id].action == TouchAction.CARD_MOVE) {
		let touch_position = touch_data[touch_id].position;
		let touch_hovers_hand = (touch_position.y >= view.h - HAND_HEIGHT);
		let game_position = touch_hovers_hand ? touch_to_hand_position(touch_position) : touch_to_game_position(touch_position);

		for(let i = 0;i < cards_selected.length; ++i) {
			let id = cards_selected[i];

			// Transition between table and player hand if necessary
			if(touch_hovers_hand && cards[id].place != player_id) {
				cards[id].position = game_to_hand_position(cards[id].position);
				card_update_place(id, player_id);
			}
			if(!touch_hovers_hand && cards[id].place != TABLE_ID) {
				cards[id].position = hand_to_game_position(cards[id].position);
				card_update_place(id, TABLE_ID);
			}
			
			// Now, actually move the card
			let p = {
				x: game_position.x + cards_offset[id].x,
				y: game_position.y + cards_offset[id].y
			};

			// (if card is in hand, its position is bounded)
			if(touch_hovers_hand) {
				p.x = Math.min(Math.max(p.x, CARD_WIDTH / 2 - view.w / 2), view.w / 2 - CARD_WIDTH / 2);
				p.y = Math.min(Math.max(p.y, CARD_HEIGHT / 2 - HAND_HEIGHT / 2), HAND_HEIGHT / 2 - CARD_HEIGHT / 2);
			}
			
			card_update_position(id, p.x, p.y);
		}
	}

	if(touch_data[touch_id].action == TouchAction.SCROLL) {
		let touch_position = touch_data[touch_id].position;
		view.x -= touch_position.dx;
		view.y -= touch_position.dy
	}
	
	canvas_should_render = true;
}

function touch_end(touch_id) {
	if(touch_data[touch_id].action == TouchAction.CARD_SELECT && touch_long_hold_timer !== null) {
		// Stop timer
		clearTimeout(touch_long_hold_timer);
		touch_long_hold_timer = null;
		
		// Flip face
		let id = cards_selected[0];
		let card = cards[id];
		card_update_face(id, card.face == FACE_DOWN ? FACE_UP : FACE_DOWN);
	}

	if(touch_data[touch_id].action == TouchAction.CARD_MOVE || (touch_data[touch_id].action == TouchAction.CARD_SELECT && cards_selected.length <= 1)) {
		touch_data[touch_id].action = TouchAction.NONE;
		cards_selected = [];
	}
	
	canvas_should_render = true;
}

function touch_to_game_position(p) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: p.x - rect.left + view.x,
		y: p.y - rect.top + view.y
	};
}

function touch_to_hand_position(p) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: p.x - rect.left - view.w / 2,
		y: p.y - rect.top - view.h + HAND_HEIGHT / 2
	};
}

function game_to_hand_position(p) {
	return {
		x: p.x - view.x - view.w / 2,
		y: p.y - view.y - view.h + HAND_HEIGHT / 2
	};
}

function hand_to_game_position(p) {
	return {
		x: p.x + view.x + view.w / 2,
		y: p.y + view.y + view.h - HAND_HEIGHT / 2
	};
}

function game_card_box(card) {
	return {
		x: card.position.x - CARD_WIDTH / 2,
		y: card.position.y - CARD_HEIGHT / 2,
		w: CARD_WIDTH,
		h: CARD_HEIGHT
	};
}

function cards_select_pile(place, p) {
	// Select all pressed cards
	cards_selected = [];
	for(let i = 0;i < cards.length; ++i) {
		if(cards[i].place != place)
			continue;
		let box_i = game_card_box(cards[i]);
		if(point_in_box(p, box_i)) {
			cards_selected.push(i);
			cards_offset[i] = {
				x: cards[i].position.x - p.x,
				y: cards[i].position.y - p.y
			}
		}
	}

	// If a card touches a card on the pile, add it to the pile as well
	let i = 0;
	while(i < cards_selected.length) {
		let box = game_card_box(cards[cards_selected[i]]);
		for(let j = 0;j < cards.length; ++j) {
			if(cards[j].place != place)
				continue;
			let box_j = game_card_box(cards[j]);
			if(!cards_selected.includes(j) && boxes_overlap(box, box_j)) {
				cards_selected.push(j);
				cards_offset[j] = {
					x: cards[j].position.x - p.x,
					y: cards[j].position.y - p.y
				}
			}
		}
		++i;
	}

	if(cards_selected.length > 1) {
		// Show actions for selecting multiple cards
		actions_show(['shuffle', 'pile', 'flip']);
	}

	canvas_should_render = true;
}

function actions_show(actions) {
	for(let i = 0;i < actions.length; ++i) {
		let el = document.getElementById('action-' + actions[i]);
		if(el != null)
			el.style.display = 'block';
	}
	document.getElementById('cards-selected-text').innerHTML = '(' + cards_selected.length + ' cards selected)';
}

function actions_hide() {
	for(let el of document.querySelectorAll('#action-buttons div'))
		el.style.display = 'none';
	document.getElementById('cards-selected-text').innerHTML = '';
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
const HAND_HEIGHT = 96;
const TouchAction = { NONE: 0, SCROLL: 1, ZOOM: 2, CARD_SELECT: 3, CARD_MOVE: 4 }; Object.freeze(TouchAction);
const TOUCH_LONG_HOLD_TIME = 500;

var view = {
	x: 0.0,
	y: 0.0,
	w: 1.0,
	h: 1.0
};

var cards_selected = [];
var cards_offset = {};
var cards_animation = {};
var touch_data = {};
var touch_long_hold_timer = null;
var card_texture;

// -------- SERVER MESSAGE FUNCTIONS --------

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
	document.getElementById('splash-room').style.display = 'none';
	document.getElementById('status-text').innerHTML = 'Room ' + room_id;
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

	canvas_should_render = true;
}

function server_card(args) {

	console.log('value = "' + args[1] + '", place = "' + args[2] + '", (x,y) = ("' + args[3] + '","' + args[4] + '"), face = "' + args[5] + '"')

	// Update card
	let id = parseInt(args[0]);
	if(args[1] != '')
		cards[id].value = args[1];
	if(args[2] != '')
		cards[id].place = parseInt(args[2]);
	if(args[3] != '' && args[4] != '') {
		let t = 0.1;
		card_animate(id, parseFloat(args[3]), parseFloat(args[4]), t);
	}
	if(args[5] != '')
		cards[id].face = args[5];

	// Put card on top
	let index = cards_depth.indexOf(id);
	if(index > -1) {
  		cards_depth.splice(index, 1);
		cards_depth.push(id);
	}

	canvas_should_render = true;
}

function server_name(args) {
	player_names[parseInt(args[0])] = args.slice(1).join(' ');
}

// -------- CARD UPDATE FUNCTIONS --------

function card_update_position(id, x, y) {
	cards[id].position.x = x;
	cards[id].position.y = y;
	if(!cards_updated.position.includes(id))
		cards_updated.position.push(id);

	canvas_should_render = true;
}

function card_update_face(id, face) {
	cards[id].face = face;
	if(!cards_updated.face.includes(id))
		cards_updated.face.push(id);

	canvas_should_render = true;
}

function card_update_place(id, place) {
	cards[id].place = place;
	if(!cards_updated.place.includes(id))
		cards_updated.place.push(id);

	canvas_should_render = true;
}

function send_cards_updated() {
	// Place
	if(cards_updated.place.length > 0) {
		let by_place = {};
		for(let i = 0;i < cards_updated.place.length; ++i) {
			let id = cards_updated.place[i];
			let place = cards[id].place;
			if(by_place[place] === undefined)
				by_place[place] = [];
			by_place[place].push(id);
		}

		let places = Object.keys(by_place);
		for(let i = 0;i < places.length; ++i) {
			let place = places[i];
			send_message('place ' + place + ' ' + by_place[place].join(' '));
		}

		cards_updated.place = [];	
	}

	// Position
	if(cards_updated.position.length > 0) {
		for(let i = 0;i < cards_depth.length; ++i) {
			let id = cards_depth[i];
			if(cards_updated.position.includes(id)) {
				let position = cards[id].position;
				send_message('move ' + float_to_2_decimals(position.x) + ' ' + float_to_2_decimals(position.y) + ' ' + id);
			}
		}
		cards_updated.position = [];
	}

	// Face
	if(cards_updated.face.length > 0) {
		let face_ups = [];
		let face_downs = [];
		for(let i = 0;i < cards_depth.length; ++i) {
			let id = cards_depth[i];
			if(cards_updated.face.includes(id))
				(cards[id].face == FACE_UP ? face_ups : face_downs).push(id);
		}
			
		if(face_ups.length > 0)
			send_message('face ' + FACE_UP + ' ' + face_ups.join(' '));
		if(face_downs.length > 0)
			send_message('face ' + FACE_DOWN + ' ' + face_downs.join(' '));
		cards_updated.face = [];
	}
}

function card_animate(id, x, y, t) {
	if(!cards_animation.hasOwnProperty(id))
		cards_animation[id] = {};

	cards_animation[id].start_x = cards[id].position.x;
	cards_animation[id].start_y = cards[id].position.y;
	cards_animation[id].end_x = x;
	cards_animation[id].end_y = y;
	cards_animation[id].start_t = (new Date()).getTime();
	cards_animation[id].end_t = cards_animation[id].start_t + t * 1000;
}

function cards_update_animation() {
	let current_t = (new Date()).getTime();
	let ids = Object.keys(cards_animation);
	for(let i = 0;i < ids.length; ++i) {
		let id = ids[i];
		let a = cards_animation[id];
		if(current_t > a.end_t) {
			cards[id].position.x = a.end_x;
			cards[id].position.y = a.end_y;
			delete cards_animation[id];
		}
		else {
			let z = (current_t - a.start_t) / (a.end_t - a.start_t);
			cards[id].position.x = a.start_x + (a.end_x - a.start_x) * z;
			cards[id].position.y = a.start_y + (a.end_y - a.start_y) * z;

			// If animation is not finished, should continue rendering
			canvas_should_render = true;
		}
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

// -------- COOKIE FUNCTIONS --------

function cookie_set(cname, cvalue, exdays) {
	let d = new Date();
	d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
	let expires = 'expires='+ d.toUTCString();
	document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
}

function cookie_get(cname) {
	let name = cname + "=";
	let decodedCookie = decodeURIComponent(document.cookie);
	let ca = decodedCookie.split(';');
	for(let i = 0;i < ca.length; ++i) {
		let c = ca[i];
		while(c.charAt(0) == ' ')
			c = c.substring(1);
		if(c.indexOf(name) == 0)
			return c.substring(name.length, c.length);
	}
	return '';
}
