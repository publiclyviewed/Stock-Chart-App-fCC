# Stock Chart App

A full-stack JavaScript application that displays real-time stock market trends, allowing users to add and remove stocks dynamically. Built for coding interview practice, this project utilizes Web Sockets for real-time updates across multiple users.

## Features

* View a graph displaying recent trend lines for added stocks.
* Add new stocks by their symbol name (e.g., AAPL, GOOG).
* Remove stocks from the watchlist.
* See real-time changes in stock additions/removals by other users, thanks to Web Sockets.

## Technologies Used

### Frontend (Client)
* **React.js**: A JavaScript library for building user interfaces.
* **Chart.js / React-Chartjs-2**: For rendering interactive stock trend graphs.
* **Socket.IO Client**: Enables real-time, bidirectional communication with the backend.
* **HTML/CSS**: For structure and styling.

### Backend (Server)
* **Node.js / Express.js**: A powerful JavaScript runtime and web application framework.
* **Socket.IO**: Facilitates real-time communication (Web Sockets).
* **MongoDB / Mongoose**: A NoSQL database for persisting stock data.
* **Axios**: Promise-based HTTP client for making API requests.
* **dotenv**: For managing environment variables securely.

### Stock Data API
* [To be determined/Chosen]

## Getting Started

### Prerequisites

* Node.js (LTS version recommended)
* npm (Node Package Manager) or yarn
* A MongoDB Atlas (or local) database connection string.
* An API Key from a chosen stock data provider (e.g., Alpha Vantage, Finnhub).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/publiclyviewed/Stock-Chart-App-fCC.git](https://github.com/publiclyviewed/Stock-Chart-App-fCC.git)
    cd Stock-Chart-App-fCC
    ```

2.  **Backend Setup:**
    ```bash
    cd server
    npm install
    ```
    Create a `.env` file in the `server` directory with your environment variables:
    ```
    PORT=5000
    MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING_HERE
    STOCK_API_KEY=YOUR_STOCK_API_KEY_HERE
    ```
    Replace placeholders with your actual MongoDB connection string and stock API key.

3.  **Frontend Setup:**
    ```bash
    cd ../client # Go back to the root, then into the client directory
    npm install
    ```

### Running the Application

1.  **Start the Backend Server:**
    Open a terminal, navigate to the `server` directory, and run:
    ```bash
    npm start # or node index.js
    ```
    You should see "MongoDB connected successfully" and "Server running on port 5000".

2.  **Start the Frontend Development Server:**
    Open a **new** terminal, navigate to the `client` directory, and run:
    ```bash
    npm start
    ```
    This will open the React app in your browser (usually `http://localhost:3000`).

## Usage

* Enter a valid stock symbol (e.g., `AAPL`, `GOOG`, `MSFT`) into the input field and click "Add Stock".
* The stock's trend line will appear on the chart.
* Click the "Remove" button next to a stock to take it off the chart.
* Open the application in multiple browser tabs to observe real-time synchronization.

## Contributing

Feel free to fork the repository, make improvements, and submit pull requests.

## License

This project is open source and available under the [MIT License](LICENSE).