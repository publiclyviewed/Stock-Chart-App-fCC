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
// NEW: Import specific Chart.js utilities for tooltips
import { Tooltip as ChartTooltip } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip, // Ensure Tooltip is registered
  Legend
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const socket = io(BACKEND_URL);

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
  const [stocks, setStocks] = useState([]);
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const colorIndexRef = useRef(0);

  const getNextColor = () => {
    const color = chartColors[colorIndexRef.current % chartColors.length];
    colorIndexRef.current += 1;
    return color;
  };

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server via Socket.IO');
      setMessage('Connected to real-time updates.');
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setMessage('Disconnected from real-time updates. Trying to reconnect...');
    });

    socket.on('initialStocks', (initialStockData) => {
      console.log('Received initial stocks:', initialStockData);
      setStocks(initialStockData.map(stock => ({
        ...stock,
        color: getNextColor()
      })));
      setLoading(false);
    });

    socket.on('stockAdded', (stockData) => {
      console.log('Stock added:', stockData);
      setStocks(prevStocks => {
        if (!prevStocks.some(s => s.symbol === stockData.symbol)) {
          return [...prevStocks, { ...stockData, color: getNextColor() }];
        }
        return prevStocks;
      });
      setMessage(`${stockData.symbol} added successfully!`);
      setTimeout(() => setMessage(''), 3000);
      setLoading(false);
    });

    socket.on('stockRemoved', (symbol) => {
      console.log('Stock removed:', symbol);
      setStocks(prevStocks => prevStocks.filter(s => s.symbol !== symbol));
      setMessage(`${symbol} removed successfully.`);
      setTimeout(() => setMessage(''), 3000);
      setLoading(false);
    });

    socket.on('stockAlreadyExists', (stockData) => {
      console.log('Stock already exists feedback:', stockData.symbol);
      setMessage(`${stockData.symbol} is already on the chart.`);
      setStocks(prevStocks => {
        if (!prevStocks.some(s => s.symbol === stockData.symbol)) {
            return [...prevStocks, { ...stockData, color: getNextColor() }];
        }
        return prevStocks;
      });
      setLoading(false);
    });

    socket.on('stockError', ({ symbol, message: errorMessage }) => {
      console.error(`Error with stock ${symbol}:`, errorMessage);
      setMessage(`Error: ${errorMessage}`);
      setLoading(false);
    });

    socket.on('rateLimitExceeded', ({ symbol, message: errorMessage }) => {
        setMessage(`Rate Limit Exceeded for ${symbol}. Please wait a minute before trying again.`);
        setLoading(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('initialStocks');
      socket.off('stockAdded');
      socket.off('stockRemoved');
      socket.off('stockAlreadyExists');
      socket.off('stockError');
      socket.off('rateLimitExceeded');
    };
  }, []);

  const chartData = {
    labels: stocks.length > 0 ? stocks[0].data.map(d => d.date) : [],
    datasets: stocks.map((stock, index) => ({
      label: stock.symbol,
      data: stock.data.map(d => d.close),
      borderColor: stock.color || getNextColor(),
      backgroundColor: stock.color ? `${stock.color}50` : `${getNextColor()}50`,
      tension: 0.1,
      pointRadius: 0,
      borderWidth: 2,
      // Store full data for tooltip access
      fullData: stock.data,
    })),
  };

  const handleAddStock = (e) => {
    e.preventDefault();
    if (newStockSymbol.trim()) {
      setLoading(true);
      setMessage(`Adding ${newStockSymbol}...`);
      socket.emit('addStock', newStockSymbol.trim().toUpperCase());
      setNewStockSymbol('');
    } else {
      setMessage('Please enter a stock symbol.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveStock = (symbolToRemove) => {
    setLoading(true);
    setMessage(`Removing ${symbolToRemove}...`);
    socket.emit('removeStock', symbolToRemove);
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
            font: {
                size: 14 // Make legend labels a bit bigger
            }
        }
      },
      title: {
        display: true,
        text: 'Stock Market Trends (Daily Close Price)',
        font: {
            size: 18 // Make title a bit bigger
        },
        color: '#333'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        // NEW: Custom tooltip callbacks
        callbacks: {
            title: function(context) {
                // Return the date
                return context[0].label;
            },
            label: function(context) {
                const dataset = context.dataset;
                const index = context.dataIndex;
                const symbol = dataset.label;
                const fullDailyData = dataset.fullData[index]; // Access the full data for the specific day

                if (fullDailyData) {
                    return [
                        `Symbol: ${symbol}`,
                        `Open: ${fullDailyData.open.toFixed(2)}`,
                        `High: ${fullDailyData.high.toFixed(2)}`,
                        `Low: ${fullDailyData.low.toFixed(2)}`,
                        `Close: ${fullDailyData.close.toFixed(2)}`,
                        `Volume: ${fullDailyData.volume.toLocaleString()}`
                    ];
                }
                return `Close: ${context.formattedValue}`;
            }
        },
        titleFont: {
            size: 14,
            weight: 'bold'
        },
        bodyFont: {
            size: 12
        },
        padding: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(0,0,0,0.8)' // Darker tooltip background
      }
    },
    scales: {
        x: {
            title: {
                display: true,
                text: 'Date',
                font: {
                    size: 14
                },
                color: '#555'
            },
            ticks: {
                // Instead of maxTicksLimit, let Chart.js decide better for autoSkip
                autoSkip: true,
                maxRotation: 45, // Rotate labels if needed
                minRotation: 0,
                font: {
                    size: 12
                }
            },
            grid: {
                display: false // Optional: Hide vertical grid lines
            }
        },
        y: {
            title: {
                display: true,
                text: 'Price (USD)',
                font: {
                    size: 14
                },
                color: '#555'
            },
            beginAtZero: false,
            ticks: {
                font: {
                    size: 12
                },
                callback: function(value, index, values) {
                    return '$' + value.toFixed(2); // Format y-axis labels as currency
                }
            },
            grid: {
                color: 'rgba(0,0,0,0.05)' // Lighter horizontal grid lines
            }
        }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto', fontFamily: 'Arial, sans-serif', backgroundColor: '#f9f9f9', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>Stock Market Dashboard</h1>

      {message && (
        <p style={{
          color: message.startsWith('Error:') || message.startsWith('Rate Limit') ? 'red' : 'green',
          textAlign: 'center',
          fontWeight: 'bold',
          backgroundColor: message.startsWith('Error:') || message.startsWith('Rate Limit') ? '#ffe0e0' : '#e0ffe0',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          {message}
        </p>
      )}

      <form onSubmit={handleAddStock} style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
        <input
          type="text"
          value={newStockSymbol}
          onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
          placeholder="Enter stock symbol (e.g., AAPL)"
          disabled={loading}
          style={{ padding: '10px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px', flexGrow: 1, maxWidth: '300px', backgroundColor: loading ? '#e9e9e9' : 'white' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: loading ? '#6c757d' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {loading ? 'Processing...' : 'Add Stock'}
        </button>
      </form>

      {stocks.length === 0 && !loading && <p style={{ textAlign: 'center', color: '#666' }}>No stocks added yet. Add some symbols above!</p>}
      {stocks.length === 0 && loading && <p style={{ textAlign: 'center', color: '#666' }}>Loading initial stocks...</p>}


      {stocks.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#555', borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>Current Stocks</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {stocks.map(stock => (
              <li key={stock.symbol} style={{ display: 'flex', alignItems: 'center', background: '#e0e0e0', borderRadius: '5px', padding: '8px 12px' }}>
                <span style={{ fontWeight: 'bold', marginRight: '10px', color: '#333' }}>{stock.symbol}</span>
                <button
                  onClick={() => handleRemoveStock(stock.symbol)}
                  disabled={loading}
                  style={{
                    background: loading ? '#bbbbbb' : '#dc3545',
                    color: 'white', border: 'none', padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {loading ? 'Removing...' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '5px', background: 'white', height: '400px' }}>
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