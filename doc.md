##### Messages client to server

- `create`: create a new room
- `join <room id>`: join room with given id
- `name <name>`: set player name



- `move <x> <y> <id, id, ...>`: moves cards with given id to position (x, y)
- `face (U|D) <id, id, ...>`: faces cards with given id up (U) or down (D)
- `place (player id|-1) <id, id, ...> `: places cards with given id in hand of player (id) or on table (-1)

- `shuffle <id, id, ...>`: shuffle cards with given id

##### Messages server to client

- `ok`: message received / handled
- `error <message>`: an error occured
- `welcome <id>`: you joined the server, and this is your id
- `joined <room id>`: you joined room `room_id`

- `players <id, id, ...> `: these are currently the players in your room

- `cards <number>`: specify the number of cards in the room
- `card <id> <place> <x> <y> <face> <card value|?>`: update info on card with given id

- `name <id> <name>`: player with id has name

##### Gestures

- Flip a card (or a pile?) [tap with 1 finger]
- Move a card (or a pile) [1 finger]
- Select a pile [circle with 1 finger] https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon/17490923#17490923
- Shuffle or sort a pile [hold with 1 finger]
- Scroll & zoom [2 fingers]