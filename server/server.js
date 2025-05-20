// server/index.js

require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const http = require('http'); // Node.js built-in HTTP module
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app); // Create an HTTP server from the Express app
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // Allow requests from your React app
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Basic Route
app.get('/', (req, res) => {
    res.send('Stock Chart API is running!');
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // You'll add more socket event handlers here later
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});