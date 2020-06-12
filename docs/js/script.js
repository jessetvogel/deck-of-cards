var canvas;
var ctx;

window.requestAnimationFrame = window.requestAnimationFrame
    || window.mozRequestAnimationFrame
    || window.webkitRequestAnimationFrame
    || window.msRequestAnimationFrame
    || function(f) { return setTimeout(f, 20); }
 
window.cancelAnimationFrame = window.cancelAnimationFrame
    || window.mozCancelAnimationFrame
    || function(requestID) { clearTimeout(requestID); }

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
	window.requestAnimationFrame(render);
	setInterval(send_cards_moved, 100);

	// Action buttons
	document.getElementById('action-shuffle').addEventListener('click', function () {
		// Send shuffle signal
		update_cards_shuffle(cards_selected);
		
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
		let n = cards_selected.length;
		update_cards_move(cards_selected, Array(n).fill(center_x), Array(n).fill(center_y));
	});

	document.getElementById('action-flip').addEventListener('click', function () {
		// If any card is face up, make all face down
		let are_cards_face_up = false;
		for(let i = 0;i < cards_selected.length; ++i) {
			if(cards[cards_selected[i]].value != CARD_VALUE_UNKNOWN) {
				are_cards_face_up = true;
				break;
			}
		}

		update_cards_face(are_cards_face_up ? FACE_DOWN : FACE_UP, cards_selected);
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
	if(window.devicePixelRatio == 2)
		card_texture.src = 'img/cards_texture_2x.png';
	else if(window.devicePixelRatio == 3)
		card_texture.src = 'img/cards_texture_3x.png';
	else if(window.devicePixelRatio >= 4)
		card_texture.src = 'img/cards_texture_4x.png';
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
}

function render() {
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

    // Request next frame
    window.requestAnimationFrame(render);
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
  	if(value === CARD_VALUE_UNKNOWN) { // back of a card
  		sx = 0;
  		sy = 4 * h;
  	} else if(value === CARD_VALUE_JOKER) { // Joker
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

	e.preventDefault();
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
		};
		touch_move(t.identifier);
	}

	e.preventDefault();
}

function canvas_touch_end(e) {
	for(let i = 0;i < e.changedTouches.length; ++i) {
		let t = e.changedTouches[i];
		touch_end(t.identifier);
		delete touch_data[t.identifier];
	}

	e.preventDefault();
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
	let hover_card = -1;
	let hover_card_offset;
	for(let i = cards_depth.length - 1;i >= 0; --i) {
		let id = cards_depth[i];
		let card_box = game_card_box(cards[id]);
		if(((touch_hovers_hand && cards[id].place == player_id) || (!touch_hovers_hand && cards[id].place == TABLE_ID)) && point_in_box(game_position, card_box)) {
			hover_card = id;
			hover_card_offset = {
				x: cards[id].position.x - game_position.x,
				y: cards[id].position.y - game_position.y
			};
			break;
		}
	}

	// Clicked on a card
	if(hover_card != -1 && cards_selected.length == 0) {
		cards_selected = [ hover_card ];
		cards_offset[hover_card] = hover_card_offset;
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
		// Should all cards be unselected?
		let other_touch_is_selecting_cards = false;
		let touch_ids = Object.keys(touch_data);
		for(let i = 0;i < touch_ids.length; ++i) {
			if(touch_data[touch_ids[i]].action == TouchAction.CARD_SELECT || touch_data[touch_ids[i]].action == TouchAction.CARD_MOVE) {
				other_touch_is_selecting_cards = true;
				break;
			}
		}

		if(!other_touch_is_selecting_cards)
			cards_selected = [];

		if(!touch_hovers_hand) {
			touch_data[touch_id].action = TouchAction.SCROLL;
		}

		actions_hide();
	}
}

function touch_move(touch_id) {
	if(touch_data[touch_id].action == TouchAction.CARD_SELECT) {
		if(touch_long_hold_timer !== null) {
			clearTimeout(touch_long_hold_timer);
			touch_long_hold_timer = null;
		}

		touch_data[touch_id].action = TouchAction.CARD_MOVE;

		// Move selected cards to the top (based on the depth that we already have)
		cards_selected.sort((a, b) => cards_depth.indexOf(a) - cards_depth.indexOf(b));
		update_cards_top(cards_selected);
		actions_hide();
	}

	if(touch_data[touch_id].action == TouchAction.CARD_MOVE) {
		let touch_position = touch_data[touch_id].position;
		let touch_hovers_hand = (touch_position.y >= view.h - HAND_HEIGHT);
		let game_position = touch_hovers_hand ? touch_to_hand_position(touch_position) : touch_to_game_position(touch_position);

		let xs = [];
		let ys = [];
		for(let i = 0;i < cards_selected.length; ++i) {
			let id = cards_selected[i];

			// Transition between table and player hand if necessary
			if(touch_hovers_hand && cards[id].place != player_id) {
				cards[id].position = game_to_hand_position(cards[id].position);
				update_cards_place([ id ], [ player_id ]);
			}
			if(!touch_hovers_hand && cards[id].place != TABLE_ID) {
				cards[id].position = hand_to_game_position(cards[id].position);
				update_cards_place([ id ], [ TABLE_ID ]);
			}
			
			// Determine new position of cards
			let x = game_position.x + cards_offset[id].x;
			let y = game_position.y + cards_offset[id].y;
			
			// (if card is in hand, its position is bounded)
			if(touch_hovers_hand) {
				x = Math.min(Math.max(x, CARD_WIDTH / 2 - view.w / 2), view.w / 2 - CARD_WIDTH / 2);
				y = Math.min(Math.max(y, CARD_HEIGHT / 2 - HAND_HEIGHT / 2), HAND_HEIGHT / 2 - CARD_HEIGHT / 2);
			}

			xs.push(x);
			ys.push(y);
		}

		update_cards_move(cards_selected, xs, ys);
	}

	if(touch_data[touch_id].action == TouchAction.SCROLL) {
		let touch_position = touch_data[touch_id].position;
		view.x -= touch_position.dx;
		view.y -= touch_position.dy;

		// Apply bounds
		let xmin, ymin, xmax, ymax;
		for(let i = 0;i < cards.length; ++i) {
			if(cards[i].place != TABLE_ID)
				continue;

			let x = cards[i].position.x, y = cards[i].position.y;
			if(xmin === undefined || x < xmin) xmin = x;
			if(xmax === undefined || x > xmax) xmax = x;
			if(ymin === undefined || y < ymin) ymin = y;
			if(ymax === undefined || y > ymax) ymax = y;
		}
		
		let w = view.w / 2, h = view.h / 2 - HAND_HEIGHT / 2;

		view.x = Math.min(Math.max(view.x + w, xmin - w), xmax + w) - w;
		view.y = Math.min(Math.max(view.y + h, ymin - h), ymax + h) - h;
	}
}

function touch_end(touch_id) {
	if(touch_data[touch_id].action == TouchAction.CARD_SELECT && touch_long_hold_timer !== null) {
		// Stop timer
		clearTimeout(touch_long_hold_timer);
		touch_long_hold_timer = null;
		
		// Flip face
		let id = cards_selected[0];
		let card = cards[id];
		update_cards_face(card.value == CARD_VALUE_UNKNOWN ? FACE_UP : FACE_DOWN, cards_selected);
	}

	if(touch_data[touch_id].action == TouchAction.CARD_MOVE || (touch_data[touch_id].action == TouchAction.CARD_SELECT && cards_selected.length <= 1)) {
		touch_data[touch_id].action = TouchAction.NONE;
		cards_selected = [];
	}
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
const CARD_VALUE_UNKNOWN = '?';
const CARD_VALUE_JOKER = 'J';

const SUITS_INDEX = { 'S': 0, 'C': 1, 'H': 2, 'D': 3 }; // Spades, Clubs, Hearts, Diamonds
const NUMBERS_INDEX = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12 }; // 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King, Ace

var player_id = -1;
var room_id = -1;

var cards = [];
var cards_depth = [];
var players = [];
var player_names = {};

var cards_moved = {};

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
	// console.log(data);

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
	if(c === 'name')
		return server_name(args);

	if(c === 'cards')
		return server_cards(args);
	if(c === 'place')
		return server_place(args);
	if(c === 'move')
		return server_move(args);
	if(c === 'value')
		return server_value(args);
	if(c === 'top')
		return server_top(args);
	
	// Unknown message from server
	console.log('Unknown message from server: ' + data);
}

function server_ok(args) {
	// Well, ok.
}

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

function server_name(args) {
	player_names[parseInt(args[0])] = args.slice(1).join(' ');
}

function server_cards(args) {
	let n = parseInt(args[0]);

	// Add cards if necessary
	for(let i = cards.length; i < n; ++i) {
		cards.push({
			place: TABLE_ID,
			position: { x: 0.0, y: 0.0 },
			value: CARD_VALUE_UNKNOWN
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

function server_place(args) {
	for(let i = 0;i + 1 < args.length;i += 2) {
		let id = parseInt(args[i]);
		let place = parseInt(args[i + 1]);
		cards[id].place = place;
	}
}

function server_move(args) {
	for(let i = 0;i + 2 < args.length;i += 3) {
		let id = parseInt(args[i]);
		let x = parseFloat(args[i + 1]);
		let y = parseFloat(args[i + 2]);
		card_animate(id, x, y, 0.15);
	}
}

function server_value(args) {
	for(let i = 0;i + 1 < args.length;i += 2) {
		let id = parseInt(args[i]);
		let value = args[i + 1];
		cards[id].value = value;
	}
}

function server_top(args) {
	let ids = args.map(s => parseInt(s));
	cards_depth = cards_depth.filter(x => !ids.includes(x)).concat(ids);
}

// -------- CARD UPDATE FUNCTIONS --------

function update_cards_place(ids, places) {
	let message = 'place';
	for(let i = 0;i < ids.length; ++i) {
		let id = ids[i];
		let place = places[i];
		cards[id].place = place;
		message += ' ' + id + ' ' + place;
	}

	send_message(message);
}

function update_cards_move(ids, xs, ys) {
	for(let i = 0;i < ids.length; ++i) {
		let id = ids[i], x = xs[i], y = ys[i];
		cards[id].position.x = x;
		cards[id].position.y = y;
		cards_moved[id] = { x: x, y: y }; // Store new position rather than immediately send it: position changes so often so only send new positions every so many times
	}
}

function update_cards_face(face, ids) {
	send_message('face ' + face + ' ' + ids.join(' '));
}

function update_cards_top(ids) {
	cards_depth = cards_depth.filter(x => !ids.includes(x)).concat(ids);
	send_message('top ' + ids.join(' '));
}

function update_cards_shuffle(ids) {
	send_message('shuffle ' + ids.join(' '));
}

function send_cards_moved() {
	let ids = Object.keys(cards_moved);
	if(ids.length == 0)
		return;

	let message = 'move';
	for(let i = 0;i < ids.length; ++i) {
		let id = ids[i];
		message += ' ' + id + ' ' + float_to_2_decimals(cards_moved[id].x) + ' ' + float_to_2_decimals(cards_moved[id].y);
	}

	send_message(message);
	cards_moved = [];
}

// -------- CARD ANIMATION FUNCTIONS --------

function card_animate(id, x, y, t) {
	if(!cards_animation.hasOwnProperty(id))
		cards_animation[id] = {};

	let start_t = (new Date()).getTime();
	Object.assign(cards_animation[id], {
		start_x: cards[id].position.x,
		start_y: cards[id].position.y,
		end_x: x,
		end_y: y,
		start_t: start_t,
		end_t: start_t + t * 1000
	});
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
