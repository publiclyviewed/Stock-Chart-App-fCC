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

const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const io = socketIo(server, {
    cors: {
        origin: allowedOrigin,
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
    
});

const Stock = mongoose.model('Stock', stockSchema);

// --- Helper function to fetch stock data from Alpha Vantage 
const fetchStockData = async (symbol) => {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
    try {
        const response = await axios.get(url);
        const data = response.data;

        if (data['Error Message']) {
            console.error(`Alpha Vantage Error for ${symbol}:`, data['Error Message']);
            // Check for specific rate limit message
            if (data['Error Message'].includes('Thank you for using Alpha Vantage! Our standard API call frequency is 5 calls per minute and 500 calls per day.')) {
                return { error: 'RATE_LIMIT', message: 'Alpha Vantage API rate limit exceeded. Please wait a minute.' };
            }
            return { error: 'API_ERROR', message: data['Error Message'] };
        }
        if (data['Note'] && data['Note'].includes('thank you for using Alpha Vantage!')) {
            console.warn(`Alpha Vantage Rate Limit Hit for ${symbol}. Please wait.`, data['Note']);
            // This is a common message for rate limits on free tier
            return { error: 'RATE_LIMIT', message: 'Alpha Vantage API rate limit exceeded. Please wait a minute.' };
        }
        if (Object.keys(data).length === 0) { // Sometimes an empty object is returned for invalid symbols
            return { error: 'INVALID_SYMBOL', message: 'Invalid stock symbol.' };
        }
        if (!data['Time Series (Daily)']) {
            console.warn(`No daily time series data found for ${symbol}. API response:`, data);
            return { error: 'NO_DATA', message: 'No historical data found for this symbol. It might be invalid or not traded.' };
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
            })).sort((a, b) => new Date(a.date) - new Date(b.date))
        };
        return { success: true, data: formattedData }; // Return an object with success/error status

    } catch (error) {
        console.error(`Error fetching data for ${symbol} from Alpha Vantage:`, error.message);
        return { error: 'FETCH_FAILED', message: 'Failed to connect to stock data API.' };
    }
};

// Middleware
app.use(cors({
    origin: allowedOrigin
}));
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

    try {
        const activeStocks = await Stock.find({});
        const stockDataPromises = activeStocks.map(async (stock) => {
            const result = await fetchStockData(stock.symbol);
            return result.success ? result.data : null; // Only return data if successful
        });
        const initialStockData = (await Promise.all(stockDataPromises)).filter(Boolean);
        socket.emit('initialStocks', initialStockData);
    } catch (error) {
        console.error('Error sending initial stocks:', error);
        socket.emit('stockError', { symbol: '', message: 'Failed to load initial stocks.' });
    }

    socket.on('addStock', async (symbol) => {
        console.log(`Add stock request: ${symbol} by ${socket.id}`);
        try {
            let stock = await Stock.findOne({ symbol });
            if (stock) {
                console.log(`${symbol} already exists.`);
                const existingStockDataResult = await fetchStockData(symbol);
                if (existingStockDataResult.success) {
                    socket.emit('stockAlreadyExists', existingStockDataResult.data);
                } else {
                    // Handle case where it exists but we couldn't fetch current data (e.g., rate limit)
                    socket.emit('stockError', { symbol, message: existingStockDataResult.message });
                }
                return;
            }

            const dataResult = await fetchStockData(symbol); // Call the updated fetch function

            if (dataResult.error) {
                // Emit specific error types to the client
                if (dataResult.error === 'RATE_LIMIT') {
                    socket.emit('rateLimitExceeded', { symbol, message: dataResult.message });
                } else if (dataResult.error === 'INVALID_SYMBOL' || dataResult.error === 'NO_DATA') {
                    socket.emit('stockError', { symbol, message: `Could not find data for ${symbol}. Please check the symbol.` });
                } else {
                    socket.emit('stockError', { symbol, message: `Failed to fetch data for ${symbol}: ${dataResult.message}` });
                }
                return;
            }

            stock = new Stock({ symbol });
            await stock.save();
            console.log(`Stock added to DB: ${symbol}`);

            io.emit('stockAdded', dataResult.data); // Emit the successful data

        } catch (error) {
            if (error.code === 11000) {
                console.warn(`Attempted to add duplicate stock: ${symbol}`);
                const existingStockDataResult = await fetchStockData(symbol);
                if (existingStockDataResult.success) {
                    io.emit('stockAdded', existingStockDataResult.data);
                } else {
                    // If duplicate but couldn't fetch data, inform the sender
                    socket.emit('stockAlreadyExists', { symbol, message: existingStockDataResult.message });
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