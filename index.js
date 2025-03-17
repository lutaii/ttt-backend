const express = require('express')
const app = express()
const port = process.env.PORT || 3000;

app.use(express.json())

const lobbies = {}

function generateLobbyCode(length = 4) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() + chars.length))
    }
    return result
}

app.get('/', (req, res) => {
    res.send('Hello from Tic Tac Toe Backend!')
})

app.post('/lobby', (req, res) => {
    let code = generateLobbyCode()

    while (lobbies[code]) {
        code = generateLobbyCode()
    }

    const uid = req.body.uid
    if (!uid) {
        return res.status(400).json({ error: 'Firebase UID is required' })
    }

    const lobby = {
        code,
        owner: uid,
        players: [uid],
        gameMode: 'classic',
        status: 'waiting'
    }

    lobbies[code] = lobby
    res.status(201).json({ code, lobby })
})

app.post('/lobby/:code/join', (req, res) => {
    const code = req.params.code
    const lobby = lobbies[code]

    if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' })
    }

    const uid = req.body.uid
    if (!uid) {
        return res.status(400).json({ error: 'Firebase UID is required' })
    }

    if (!lobby.players.includes(uid)) {
        lobby.players.push(uid)
    }

    res.status(200).json({ message: `Joined lobby ${code}`, lobby })
})

app.get('/lobby/:code', (req, res) => {
    const code = req.params.code
    const lobby = lobbies[code]
    if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found '})
    }
    res.json(lobby)
})


app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})