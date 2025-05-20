// server/index.js

require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // For making HTTP requests to external APIs

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const ALPHA_VANTAGE_API_KEY = process.env.STOCK_API_KEY; // Use the environment variable

// --- MongoDB Schema and Model (NEW) ---
const stockSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    // We'll store the raw data from Alpha Vantage, or just the symbol and fetch data on demand
    // For now, let's just store the symbol, and fetch data when needed.
    // This keeps the DB lean if we only need to store active stocks.
});

const Stock = mongoose.model('Stock', stockSchema);

// --- Helper function to fetch stock data from Alpha Vantage (NEW) ---
const fetchStockData = async (symbol) => {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data['Error Message']) {
            console.error(`Alpha Vantage Error for ${symbol}:`, data['Error Message']);
            return null;
        }
        if (data['Note'] && data['Note'].includes('thank you for using Alpha Vantage!')) {
            console.warn(`Alpha Vantage Rate Limit Hit for ${symbol}. Please wait.`, data['Note']);
            // This is a common message for rate limits on free tier
            return null; // Or handle as needed, e.g., retry after some time
        }
        if (!data['Time Series (Daily)']) {
            console.warn(`No daily time series data found for ${symbol}. API response:`, data);
            return null;
        }

        const timeSeries = data['Time Series (Daily)'];
        const formattedData = {
            symbol: symbol,
            data: Object.keys(timeSeries).map(date => ({
                date: date,
                open: parseFloat(timeSeries[date]['1. open']),
                high: parseFloat(timeSeries[date]['2. high']),
                low: parseFloat(timeSeries[date]['3. low']),
                close: parseFloat(timeSeries[date]['4. close']),
                volume: parseInt(timeSeries[date]['5. volume'])
            })).sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date ascending
        };
        return formattedData;

    } catch (error) {
        console.error(`Error fetching data for ${symbol} from Alpha Vantage:`, error.message);
        return null;
    }
};

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Basic Route
app.get('/', (req, res) => {
    res.send('Stock Chart API is running!');
});

// --- Socket.IO connection handling ---
io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    // --- Send initial stocks to the new client (NEW) ---
    try {
        const activeStocks = await Stock.find({});
        const stockDataPromises = activeStocks.map(stock => fetchStockData(stock.symbol));
        const initialStockData = (await Promise.all(stockDataPromises)).filter(Boolean); // Filter out nulls from API errors
        socket.emit('initialStocks', initialStockData); // Send initial data to this specific client
    } catch (error) {
        console.error('Error sending initial stocks:', error);
    }


    // --- Handle 'addStock' event (NEW) ---
    socket.on('addStock', async (symbol) => {
        console.log(`Add stock request: ${symbol} by ${socket.id}`);
        try {
            // Check if stock already exists in DB
            let stock = await Stock.findOne({ symbol });
            if (stock) {
                console.log(`${symbol} already exists.`);
                // Optionally send a message back to the client that it's already there
                const existingStockData = await fetchStockData(symbol);
                if (existingStockData) {
                    socket.emit('stockAlreadyExists', existingStockData); // Send data for existing stock
                }
                return;
            }

            // Fetch data before saving to confirm it's a valid symbol
            const data = await fetchStockData(symbol);
            if (!data) {
                console.log(`Failed to fetch data for ${symbol}. Not adding.`);
                socket.emit('stockError', { symbol, message: 'Invalid symbol or failed to fetch data.' });
                return;
            }

            // Save new stock to DB
            stock = new Stock({ symbol });
            await stock.save();
            console.log(`Stock added to DB: ${symbol}`);

            // Broadcast the new stock data to all connected clients
            io.emit('stockAdded', data);

        } catch (error) {
            if (error.code === 11000) { // MongoDB duplicate key error
                console.warn(`Attempted to add duplicate stock: ${symbol}`);
                // Still fetch and send data if it exists, as it might be a race condition
                const existingStockData = await fetchStockData(symbol);
                if (existingStockData) {
                    io.emit('stockAdded', existingStockData); // Treat as 'added' for other clients
                }
            } else {
                console.error(`Error adding stock ${symbol}:`, error);
                socket.emit('stockError', { symbol, message: 'Server error adding stock.' });
            }
        }
    });

    // --- Handle 'removeStock' event (NEW) ---
    socket.on('removeStock', async (symbol) => {
        console.log(`Remove stock request: ${symbol} by ${socket.id}`);
        try {
            const result = await Stock.deleteOne({ symbol });
            if (result.deletedCount > 0) {
                console.log(`Stock removed from DB: ${symbol}`);
                // Broadcast to all clients that this stock was removed
                io.emit('stockRemoved', symbol);
            } else {
                console.log(`${symbol} not found in DB to remove.`);
            }
        } catch (error) {
            console.error(`Error removing stock ${symbol}:`, error);
            socket.emit('stockError', { symbol, message: 'Server error removing stock.' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});