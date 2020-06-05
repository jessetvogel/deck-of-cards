##### Messages client to server

- `create`: create a new room
- `join <room id>`: join room with given id
- `name <name>`: set player name



- `place <id_i> <place_i> ... `: place card $i$ in place $\text{place}_i$ with $\text{place_i}​ either a player id or -1 for the table

- `move <id1> <x1> <y1> <id2> <x2> <y2> ...`: move each card $i$ to $(x_i, y_i)$
- `face (U|D) <id> <id> ...`: faces cards with given id up (U) or down (D)
- `top <id, id, ...>`: move cards with given id to the top (depth-wise)
- `shuffle <id, id, ...>`: shuffle cards with given id

##### Messages server to client

- `ok`: message received / handled
- `error <message>`: an error occured
- `welcome <id>`: you joined the server, and this is your id
- `room <room id>`: you joined room `room_id`
- `players <id, id, ...> `: these are currently the players in your room
- `name <id> <name>`: player with id has name



- `cards <number>`: specify the number of cards in the room
- `place <id1> <(player id|-1)> <id2> ... `: places cards with given id in hand of player (id) or on table (-1)
- `move <id1> <x1> <y1> <id2> <x2> <y2> ...`: move card $i$ to $(x_i, y_i)$
- `value <id1> <val1> <id2> <val2> ...`: card $i$ has value $\text{val}_i \in \{ \text{'?','S2','S3',}\ldots \}$, where '?' indicates face down or unknown (e.g. in other players hand)
- `top <id, id, ...>`: move cards with given id to the top (depth-wise)

##### Gestures

- Flip a card (or a pile?) [tap with 1 finger]
- Move a card (or a pile) [1 finger]
- ~~Select a pile [circle with 1 finger] https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon/17490923#17490923~~
- Select a pile [hold with 1 finger] https://stackoverflow.com/questions/6139225/how-to-detect-a-long-touch-pressure-with-javascript-for-android-and-iphone
- Shuffle or sort a pile [hold with 1 finger]
- Scroll [1 fingers]
- Zoom [2 fingers]
- 