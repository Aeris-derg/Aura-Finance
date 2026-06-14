const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 8080;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Default initial state
let state = {
    budget: 0,
    payday: 1,
    customMonthLength: 0,
    customCategories: [],
    purchases: [],
    quickAdds: [],
    groceries: [],
    themeColor: '#b5eadd',
    isDarkMode: false
};

// Ensure data file exists and load it
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
} else {
    try {
        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        state = { ...state, ...JSON.parse(rawData) };
    } catch (e) {
        console.error('Failed to parse existing data.json, using default state.');
    }
}

// REST API for initial load (optional, but good fallback)
app.get('/api/state', (req, res) => {
    res.json(state);
});

// WebSockets for real-time multiplayer updates
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    
    // Send the current state immediately upon connection
    socket.emit('stateUpdate', state);

    // Listen for state updates from any client
    socket.on('pushState', (newState) => {
        state = { ...state, ...newState };
        
        // Save to disk
        fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), (err) => {
            if (err) console.error('Failed to save to disk:', err);
        });

        // Broadcast the new state to ALL OTHER clients
        socket.broadcast.emit('stateUpdate', state);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Aura Finance server running at http://localhost:${PORT}`);
});
