import logging
from websocket_server import WebsocketServer

def new_client(client, server):
    player_enters(client, server)

def client_left(client, server):
    player_leaves(client, server)

def message_received(client, server, message):
    # Split message, and omit empty messages
    s = message.split()
    if not s:
        return
    
    # Find command
    c, args = s[0], s[1:]
    if c == 'create':
        return client_create(client, server, args)    
    if c == 'join':
        return client_join(client, server, args)
    if c == 'name':
        return client_name(client, server, args)
    if c == 'place':
        return client_place(client, server, args)
    if c == 'move':
        return client_move(client, server, args)
    if c == 'face':
        return client_face(client, server, args)
    if c == 'top':
        return client_top(client, server, args)
    if c == 'shuffle':
        return client_shuffle(client, server, args)
    
    # Invalid command
    server.send_message(client, 'error invalid command {}'.format(c))
    
    # Imports
import random
import string

# Constants
SUITS = ['S', 'C', 'H', 'D']
NUMBERS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
CARD_VALUE_UNKNOWN = '?'
CARD_VALUE_JOKER = 'J'
FACE_UP = 'U'
FACE_DOWN = 'D'
TABLE_ID = -1

# Util functions
def create_random_id():
    chars = string.ascii_uppercase + string.digits
    chars = chars.replace('0', '').replace('O', '') # This can cause confusion
    return ''.join(random.choices(chars, k = 6))

def str_is_float(s):
    try:
        float(s)
        return True
    except ValueError:
        return False
    
# Commands
def client_create(client, server, args):
    if len(args) != 0:
        server.send_message(client, 'error create requires 0 arguments')
        return

    room_id = house.create_room()
    client_join(client, server, [ room_id ])
    
def client_join(client, server, args):
    if len(args) != 1:
        server.send_message(client, 'error join requires 1 argument')
        return
    
    room_id = args[0].upper()
    if room_id not in house.rooms:
        server.send_message(client, 'error room {} does not exist'.format(room_id))
        return

    player_id = client['id']
    if player_id in house.player_to_room:
        house.player_to_room[player_id].remove_player(server, player_id)
    server.send_message(client, 'room {}'.format(room_id))
    house.rooms[room_id].add_player(server, player_id)
    house.player_to_room[player_id] = house.rooms[room_id]
    
def client_name(client, server, args):
    if len(args) != 1:
        server.send_message(client, 'error name requires 1 argument')
        return
        
    player_id = client['id']
    house.player_to_name[player_id] = args[0]
    server.send_message(client, 'ok')
    
    if player_id in house.player_to_room:
        house.player_to_room[player_id].update_name(server, player_id)
        
def client_place(client, server, args):
    player_id = client['id']
    if player_id not in house.player_to_room:
        server.send_message(client, 'error place requires to be in a room')
        return
    
    room = house.player_to_room[player_id]
    message_place = 'place'
    message_value = 'value'
    for i in range(len(args) // 2):
        id_, place = args[2*i:2*i + 2]
        if not id_.isnumeric() or not (place.isnumeric() or place == str(TABLE_ID)):
            continue
        
        id_, place = int(id_), int(place)
        if id_ not in room.cards or (place not in room.players and place != TABLE_ID):
            continue
        
        card = room.cards[id_]
        if card.place != TABLE_ID and card.place != player_id:
            continue

        card.place = place
        message_place += ' {} {}'.format(id_, place)
        if place == TABLE_ID and card.face == FACE_UP:
            message_value += ' {} {}'.format(id_, card.value)
    
    if message_place != 'place':
        for p in room.players:
            if p != player_id:
                server.send_message(house.player_to_client[p], message_place)
    if message_value != 'value':
        for p in room.players:
            if p != player_id:
                    server.send_message(house.player_to_client[p], message_value)
        
def client_move(client, server, args):
    player_id = client['id']
    if player_id not in house.player_to_room:
        server.send_message(client, 'error move requires to be in a room')
        return
    
    room = house.player_to_room[player_id]
    message = 'move'
    for i in range(len(args) // 3):
        id_, x, y = args[3*i:3*i + 3]
        if not id_.isnumeric() or not str_is_float(x) or not str_is_float(y):
            continue

        id_, x, y = int(id_), float(x), float(y)
        if id_ not in room.cards:
            continue
        
        card = room.cards[id_]
        if card.place != TABLE_ID and card.place != player_id:
            continue
            
        card.position = (x, y)
        message += ' {} {} {}'.format(id_, x, y)
        
    if message != 'move':
        for p in room.players:
            if p != player_id:
                server.send_message(house.player_to_client[p], message)

def client_face(client, server, args):
    if len(args) < 1:
        server.send_message(client, 'error face requires at least 1 argument')
        return
    
    player_id = client['id']
    if player_id not in house.player_to_room:
        server.send_message(client, 'error face requires to be in a room')
        return

    room = house.player_to_room[player_id]    
    face = args[0]
    if face not in [ FACE_UP, FACE_DOWN ]:
        server.send_message(client, 'error first argument of face should be {} or {}'.format(FACE_UP, FACE_DOWN))
        return
    
    message_to_player = 'value'
    message_to_others = 'value'
    for i in range(len(args) - 1):
        id_ = args[i + 1]
        if not id_.isnumeric():
            continue
        
        id_ = int(id_)
        if id_ not in room.cards:
            continue
        
        card = room.cards[id_]
        if card.place != TABLE_ID and card.place != player_id:
            continue

        card.face = face
        message_to_player += ' {} {}'.format(id_, CARD_VALUE_UNKNOWN if face == FACE_DOWN else card.value)
        message_to_others += ' {} {}'.format(id_, CARD_VALUE_UNKNOWN if face == FACE_DOWN or card.place == player_id else card.value)
    
    if message_to_player != 'value':
        for p in room.players:
            server.send_message(house.player_to_client[p], message_to_player if p == player_id else message_to_others)                

def client_top(client, server, args):
    player_id = client['id']
    if player_id not in house.player_to_room:
        server.send_message(client, 'error shuffle requires to be in a room')
        return
    
    room = house.player_to_room[player_id]
    ids = [ int(s) for s in args if s.isnumeric() ]
    ids = [ i for i in ids if i in room.cards and room.cards[i].place in [ player_id, TABLE_ID] ] # Only allow to touch cards that are on the table or in players hand
    if len(ids) == 0:
        return
    
    room.cards_depth = [ i for i in room.cards_depth if i not in ids ] + ids
    
    message = 'top ' + ' '.join([ str(i) for i in ids])
    for p in room.players:
        if p != player_id:
            server.send_message(house.player_to_client[p], message)
        
def client_shuffle(client, server, args):
    player_id = client['id']
    if player_id not in house.player_to_room:
        server.send_message(client, 'error shuffle requires to be in a room')
        return
    
    room = house.player_to_room[player_id]
    ids = [ int(s) for s in args if s.isnumeric() ]
    ids = [ i for i in ids if i in room.cards and room.cards[i].place in [ player_id, TABLE_ID] ] # Only shuffle cards that are on the table or in players hand
    if len(ids) <= 1: # Only makes sense to shuffle >= 1 cards
        return
    
    cards = [ room.cards[i] for i in ids ]
    values = [ card.value for card in cards ]
    random.shuffle(values)
    for i in range(len(ids)):
        cards[i].value = values[i]
        
    message_to_player = 'value'
    message_to_others = 'value'
    for id_ in ids:
        card = room.cards[id_]
        message_to_player += ' {} {}'.format(id_, CARD_VALUE_UNKNOWN if card.face == FACE_DOWN else card.value)
        message_to_others += ' {} {}'.format(id_, CARD_VALUE_UNKNOWN if card.face == FACE_DOWN or card.place == player_id else card.value)
    for p in room.players:
        server.send_message(house.player_to_client[p], message_to_player if p == player_id else message_to_others)

# Other functions
def player_enters(client, server):
    player_id = client['id']
    house.player_to_client[player_id] = client
    house.player_to_name[player_id] = 'Player ' + str(player_id)
    server.send_message(client, 'welcome {}'.format(player_id))

def player_leaves(client, server):
    if 'id' not in client:
        return
    player_id = client['id']
    if player_id in house.player_to_room:
        room = house.player_to_room[player_id]
        room.remove_player(server, player_id)
        del house.player_to_room[player_id]
        if not room.players:
            del house.rooms[room.id]

class House:
    
    def __init__(self):
        self.rooms = {} # Dictionary { room id: Room }
        self.player_to_client = {} # Dictionary { player id: client }
        self.player_to_name = {} # Dictionary { player id: name }
        self.player_to_room = {} # Dictionary { player id: room }

    def create_room(self):
        room = Room(create_random_id())
        room.reset()
        self.rooms[room.id] = room
        return room.id

class Card:

    def __init__(self, value):
        self.value = value
        self.place = TABLE_ID
        self.position = (0.0, 0.0)
        self.face = FACE_DOWN
        
class Room:
    
    def __init__(self, id_):
        self.id = id_
        self.players = set() # Set of player ids in the room
        self.cards = {} # Dictionary { card id: Card }
        self.cards_depth = [] # Order of depth of cards
        
    def reset(self):
        # Place deck of cards in center of table
        self.cards = {}
        self.cards_depth = []
        i = 0
        for suit in SUITS:
            for number in NUMBERS:
                self.cards[i] = Card(suit + number)
                self.cards_depth.append(i)
                i += 1
    
    def add_player(self, server, player_id):
        self.players.add(player_id)
        
        # Send players / names messages
        players_message = 'players {}'.format(' '.join([ str(i) for i in self.players ]))
        for p in self.players:
            server.send_message(house.player_to_client[p], players_message)
            server.send_message(house.player_to_client[p], 'name {} {}'.format(player_id, house.player_to_name[player_id]))
            server.send_message(house.player_to_client[player_id], 'name {} {}'.format(p, house.player_to_name[p]))
        
        # Send card data to new player
        client = house.player_to_client[player_id]
        server.send_message(client, 'cards {}'.format(len(self.cards)))
        server.send_message(client, 'top {}'.format(' '.join([ str(i) for i in self.cards_depth ])))
        server.send_message(client, 'place {}'.format(' '.join([ str(i) + ' ' + str(self.cards[i].place) for i in self.cards ])))
        server.send_message(client, 'move {}'.format(' '.join([ str(i) + ' ' + str(self.cards[i].position[0]) + ' ' + str(self.cards[i].position[1]) for i in self.cards ])))
        server.send_message(client, 'value {}'.format(' '.join([ str(i) + ' ' + str(self.cards[i].value if self.cards[i].face == FACE_UP and self.cards[i].place in [ player_id, TABLE_ID ] else CARD_VALUE_UNKNOWN) for i in self.cards ])))        
    
    def remove_player(self, server, player_id):
        if player_id in self.players:
            self.players.remove(player_id)
                        
        # Cards in player's hand go onto table
        player_cards = [ i for i in self.cards if self.cards[i].place == player_id ]
        for i in player_cards:
            self.cards[i].place = TABLE_ID
        for p in self.players:
            server.send_message(house.player_to_client[p], 'place {}'.format(' '.join([ str(i) + ' ' + str(TABLE_ID) for i in player_cards ])))
        
        # Inform others that player left
        message = 'players {}'.format(' '.join([ str(i) for i in self.players ]))
        for p in self.players:
            server.send_message(house.player_to_client[p], message)
    
    def update_name(self, server, player_id):
        if player_id not in self.players:
            return
        
        for p in self.players:
            server.send_message(house.player_to_client[p], 'name {} {}'.format(player_id, house.player_to_name[player_id]))

# Create House
house = House()

# Start server
server = WebsocketServer(45311, host = '0.0.0.0', loglevel = logging.INFO)
server.set_fn_new_client(new_client)
server.set_fn_client_left(client_left)
server.set_fn_message_received(message_received)
server.run_forever()
