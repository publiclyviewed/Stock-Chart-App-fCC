// client/src/App.js

import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const socket = io('http://localhost:5000'); // Connect to your backend Socket.IO server

// Define some random colors for charts
const chartColors = [
    'rgb(255, 99, 132)', // Red
    'rgb(54, 162, 235)', // Blue
    'rgb(255, 206, 86)', // Yellow
    'rgb(75, 192, 192)', // Green
    'rgb(153, 102, 255)', // Purple
    'rgb(255, 159, 64)', // Orange
    'rgb(199, 199, 199)', // Grey
    'rgb(83, 109, 254)', // Indigo
    'rgb(255, 99, 255)', // Pink
    'rgb(0, 200, 83)'   // Teal
];

function App() {
  const [stocks, setStocks] = useState([]); // Stores { symbol, data: [{date, close}, ...] }
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [message, setMessage] = useState(''); // For user feedback

  // useRef to keep track of available colors for new stocks
  const colorIndexRef = useRef(0);

  // Helper function to assign a color to a new stock
  const getNextColor = () => {
    const color = chartColors[colorIndexRef.current % chartColors.length];
    colorIndexRef.current += 1;
    return color;
  };

  useEffect(() => {
    // Event listener for initial stocks from the server
    socket.on('initialStocks', (initialStockData) => {
      console.log('Received initial stocks:', initialStockData);
      setStocks(initialStockData.map(stock => ({
        ...stock,
        color: getNextColor() // Assign a color to each initial stock
      })));
    });

    // Event listener for when a stock is added by anyone
    socket.on('stockAdded', (stockData) => {
      console.log('Stock added:', stockData);
      setStocks(prevStocks => {
        // Prevent adding duplicate if it's somehow already there
        if (!prevStocks.some(s => s.symbol === stockData.symbol)) {
          return [...prevStocks, { ...stockData, color: getNextColor() }];
        }
        return prevStocks; // Stock already exists, do nothing
      });
      setMessage(''); // Clear any previous messages
    });

    // Event listener for when a stock is removed by anyone
    socket.on('stockRemoved', (symbol) => {
      console.log('Stock removed:', symbol);
      setStocks(prevStocks => prevStocks.filter(s => s.symbol !== symbol));
      setMessage(''); // Clear any previous messages
    });

    // Event listener for when the added stock already exists (feedback to sender)
    socket.on('stockAlreadyExists', (stockData) => {
      console.log('Stock already exists feedback:', stockData.symbol);
      setMessage(`${stockData.symbol} is already on the chart.`);
      setStocks(prevStocks => {
        // Ensure it's on the chart, assign color if missing
        if (!prevStocks.some(s => s.symbol === stockData.symbol)) {
            return [...prevStocks, { ...stockData, color: getNextColor() }];
        }
        return prevStocks;
      });
    });

    // Event listener for server errors during stock adding
    socket.on('stockError', ({ symbol, message }) => {
      console.error(`Error with stock ${symbol}:`, message);
      setMessage(`Error adding ${symbol}: ${message}`);
    });


    // Cleanup on unmount
    return () => {
      socket.off('initialStocks');
      socket.off('stockAdded');
      socket.off('stockRemoved');
      socket.off('stockAlreadyExists');
      socket.off('stockError');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []); // Empty dependency array means this runs once on mount

  // Prepare chart data whenever `stocks` state changes
  const chartData = {
    labels: stocks.length > 0 ? stocks[0].data.map(d => d.date) : [], // Dates from the first stock
    datasets: stocks.map((stock, index) => ({
      label: stock.symbol,
      data: stock.data.map(d => d.close),
      borderColor: stock.color || getNextColor(), // Use assigned color or get new
      backgroundColor: stock.color ? `${stock.color}50` : `${getNextColor()}50`, // Add transparency to fill
      tension: 0.1, // Smooth the lines
      pointRadius: 0, // No points on the line
      borderWidth: 2,
    })),
  };

  const handleAddStock = (e) => {
    e.preventDefault();
    if (newStockSymbol.trim()) {
      socket.emit('addStock', newStockSymbol.trim().toUpperCase()); // Send 'addStock' event
      setNewStockSymbol(''); // Clear input
    }
  };

  const handleRemoveStock = (symbolToRemove) => {
    socket.emit('removeStock', symbolToRemove); // Send 'removeStock' event
  };

  // Chart.js options
  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allow div to control aspect ratio
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Stock Market Trends (Daily Close Price)',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      }
    },
    scales: {
        x: {
            title: {
                display: true,
                text: 'Date'
            },
            ticks: {
                autoSkip: true, // Automatically skip labels to prevent overlap
                maxTicksLimit: 10 // Limit the number of ticks on X-axis
            }
        },
        y: {
            title: {
                display: true,
                text: 'Price (USD)'
            },
            beginAtZero: false // Prices usually don't start at zero
        }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto', fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>Stock Market Dashboard</h1>

      {message && <p style={{ color: 'red', textAlign: 'center', fontWeight: 'bold' }}>{message}</p>}

      <form onSubmit={handleAddStock} style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
        <input
          type="text"
          value={newStockSymbol}
          onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
          placeholder="Enter stock symbol (e.g., AAPL)"
          style={{ padding: '10px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, maxWidth: '300px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>Add Stock</button>
      </form>

      {stocks.length === 0 && <p style={{ textAlign: 'center', color: '#666' }}>No stocks added yet. Add some symbols above!</p>}

      {stocks.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#555', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Current Stocks</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {stocks.map(stock => (
              <li key={stock.symbol} style={{ display: 'flex', alignItems: 'center', background: '#e0e0e0', borderRadius: '5px', padding: '8px 12px' }}>
                <span style={{ fontWeight: 'bold', marginRight: '10px', color: '#333' }}>{stock.symbol}</span>
                <button
                  onClick={() => handleRemoveStock(stock.symbol)}
                  style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The Chart */}
      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px', background: 'white', height: '400px' }}> {/* Fixed height for chart */}
        {chartData.datasets.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <p style={{ textAlign: 'center', marginTop: '20px', color: '#666' }}>Chart will appear here when stocks are added.</p>
        )}
      </div>
    </div>
  );
}

export default App;