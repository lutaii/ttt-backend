const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3000;
app.use(express.json());

// Set up WebSocket server on the '/ws' path.
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  ws.on('message', (message) => {
    console.log('Received message:', message);
    try {
      const data = JSON.parse(message);
      if (data.action === 'joinLobbyRoom' && data.lobbyCode) {
        // Save the lobby code and uid on this websocket connection
        ws.lobbyCode = data.lobbyCode;
        if (data.uid) {
          ws.uid = data.uid;
        }
        console.log(`Socket joined room: ${data.lobbyCode}, uid: ${ws.uid || 'not provided'}`);
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (ws.lobbyCode && ws.uid) {
      const lobby = lobbies[ws.lobbyCode];
      if (lobby) {
        // Immediately mark the lobby as closed.
        lobby.status = 'closed';
        console.log(`Lobby ${ws.lobbyCode} is now closed due to disconnect of uid ${ws.uid}.`);
        // Broadcast a lobbyClosed event to all clients in that lobby.
        wss.clients.forEach(client => {
          if (
            client.readyState === WebSocket.OPEN &&
            client.lobbyCode === ws.lobbyCode
          ) {
            client.send(JSON.stringify({
              event: 'lobbyClosed',
              message: 'Lobby closed due to a disconnect. Game over.'
            }));
          }
        });
        // Delete the lobby from memory.
        delete lobbies[ws.lobbyCode];
        console.log(`Lobby ${ws.lobbyCode} deleted.`);
      }
    }
  });
});

// Start the HTTP + WebSocket server.
server.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
});

// In-memory store for lobbies.
const lobbies = {};

// Helper function to generate a random lobby code.
function generateLobbyCode(length = 4) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  console.log('Generated code:', result);
  return result;
}

// Basic GET route.
app.get('/', (req, res) => {
  res.send('Hello from Tic Tac Toe Backend!');
});

// Endpoint to create a new lobby.
app.post('/lobby', (req, res) => {
  let code = generateLobbyCode();

  while (lobbies[code]) {
    code = generateLobbyCode();
  }

  const uid = req.body.uid;
  if (!uid) {
    return res.status(400).json({ error: 'Firebase UID is required' });
  }

  // Set status to "waiting" initially.
  const lobby = {
    code,
    owner: uid,
    players: [uid],
    gameMode: 'classic',
    status: 'waiting'
  };

  console.log('Lobby created:', lobby);
  lobbies[code] = lobby;
  res.status(201).json({ code, lobby });
});

const MAX_PLAYERS = 2;

// Endpoint to join an existing lobby.
app.post('/lobby/:code/join', (req, res) => {
  const code = req.params.code;
  const lobby = lobbies[code];

  if (!lobby) {
    return res.status(404).json({ error: 'Lobby not found' });
  }

  // Check if the lobby is still open.
  if (lobby.status !== 'waiting') {
    return res.status(400).json({ error: 'Lobby is closed' });
  }
  if (lobby.players.length >= MAX_PLAYERS) {
    return res.status(400).json({ error: 'Lobby is full' });
  }

  const uid = req.body.uid;
  if (!uid) {
    return res.status(400).json({ error: 'Firebase UID is required' });
  }

  if (!lobby.players.includes(uid)) {
    lobby.players.push(uid);
  }

  console.log(`User with uid ${uid} joined lobby ${JSON.stringify(lobby)}`);

  // Broadcast the updated lobby to all clients in the lobby.
  wss.clients.forEach(client => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.lobbyCode === code
    ) {
      client.send(JSON.stringify({ event: 'lobbyUpdated', lobby }));
    }
  });

  res.status(200).json({ message: `Joined lobby ${code}`, lobby });
});

// Endpoint to get lobby details.
app.get('/lobby/:code', (req, res) => {
  const code = req.params.code;
  const lobby = lobbies[code];
  if (!lobby) {
    return res.status(404).json({ error: 'Lobby not found' });
  }
  res.json(lobby);
});