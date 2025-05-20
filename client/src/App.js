// client/src/App.js

import React, { useEffect, useState } from 'react';
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

function App() {
  const [stocks, setStocks] = useState([]); // This will hold our stock data for the chart
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [chartData, setChartData] = useState({
    labels: [], // Dates/Time
    datasets: [], // Each stock will be a dataset
  });

  useEffect(() => {
    // Listen for initial data or updates from the server
    // For now, let's just listen for a generic 'message' to confirm connection
    socket.on('connect', () => {
      console.log('Connected to server via Socket.IO');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // We'll add more specific stock update listeners here later

    // Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      // socket.off('stocksUpdated'); // Add this later
    };
  }, []);

  const handleAddStock = (e) => {
    e.preventDefault();
    if (newStockSymbol.trim()) {
      console.log(`Attempting to add stock: ${newStockSymbol}`);
      // In the next step, we'll emit a 'addStock' event to the server
      setNewStockSymbol(''); // Clear input
    }
  };

  const handleRemoveStock = (symbolToRemove) => {
    console.log(`Attempting to remove stock: ${symbolToRemove}`);
    // In the next step, we'll emit a 'removeStock' event to the server
  };

  // Chart.js options (basic for now)
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Stock Market Trends',
      },
    },
    scales: {
        x: {
            title: {
                display: true,
                text: 'Date'
            }
        },
        y: {
            title: {
                display: true,
                text: 'Price'
            }
        }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Stock Market Dashboard</h1>

      <form onSubmit={handleAddStock} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newStockSymbol}
          onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
          placeholder="Enter stock symbol (e.g., AAPL)"
          style={{ padding: '8px', marginRight: '10px' }}
        />
        <button type="submit" style={{ padding: '8px 15px' }}>Add Stock</button>
      </form>

      {stocks.length === 0 && <p>No stocks added yet. Add some symbols above!</p>}

      {stocks.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Current Stocks</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {stocks.map(stock => (
              <li key={stock.symbol} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', marginRight: '10px' }}>{stock.symbol}</span>
                <button
                  onClick={() => handleRemoveStock(stock.symbol)}
                  style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The Chart */}
      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
        <Line data={chartData} options={options} />
        {chartData.datasets.length === 0 && <p style={{ textAlign: 'center', marginTop: '20px' }}>Chart will appear here when stocks are added.</p>}
      </div>
    </div>
  );
}

export default App;