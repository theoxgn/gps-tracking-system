const express = require("express");
const http = require("http");
const https = require("https");
const socketIo = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const config = require("./config");

// Create Express application
const app = express();

// Enable CORS with configuration
app.use(cors({
  origin: config.server.corsOrigins
}));

// Create HTTP or HTTPS server based on configuration
let server;
if (config.security.useSecureWebSockets && config.security.sslCert && config.security.sslKey) {
  // Create HTTPS server with SSL certificates
  const sslOptions = {
    key: fs.readFileSync(config.security.sslKey),
    cert: fs.readFileSync(config.security.sslCert)
  };
  server = https.createServer(sslOptions, app);
  console.log("Created HTTPS server with SSL certificates");
} else {
  // Create regular HTTP server
  server = http.createServer(app);
  console.log("Created HTTP server");
}

// Initialize Socket.IO with CORS configuration
const io = socketIo(server, {
  cors: {
    origin: config.server.corsOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Create log directory if it doesn't exist
if (!fs.existsSync(config.storage.logDirectory)) {
  fs.mkdirSync(config.storage.logDirectory, { recursive: true });
  console.log(`Created log directory: ${config.storage.logDirectory}`);
}

// Initialize driver data storage
let activeDrivers = {};
let driverHistory = {};

// Basic API authentication middleware
const authenticateAPI = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== config.security.apiKey) {
    return res.status(401).json({ error: "Unauthorized. Invalid API key." });
  }
  
  next();
};

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Base route
app.get("/", (req, res) => {
  res.send({ 
    status: "Server is running", 
    time: new Date().toISOString(),
    activeDrivers: Object.keys(activeDrivers).length
  }).status(200);
});

// API to get all active drivers
app.get("/api/drivers", authenticateAPI, (req, res) => {
  res.json({ drivers: activeDrivers });
});

// API to get specific driver data
app.get("/api/drivers/:driverId", authenticateAPI, (req, res) => {
  const driverId = req.params.driverId;
  
  if (!activeDrivers[driverId]) {
    return res.status(404).json({ error: "Driver not found" });
  }
  
  res.json({ driver: activeDrivers[driverId] });
});

// API to get driver history for a specific time period
app.get("/api/history/:driverId", authenticateAPI, (req, res) => {
  const driverId = req.params.driverId;
  const { start, end } = req.query;
  
  if (!driverHistory[driverId]) {
    return res.status(404).json({ error: "No history found for this driver" });
  }
  
  let history = driverHistory[driverId];
  
  // Filter by time if provided
  if (start && end) {
    const startTime = new Date(start).getTime() / 1000;
    const endTime = new Date(end).getTime() / 1000;
    
    history = history.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
  }
  
  res.json({ history });
});

// Simple health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Driver connection authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  
  // Skip authentication if using default key in development
  if (config.security.apiKey === 'default-dev-key' || token === config.security.apiKey) {
    return next();
  }
  
  // For more robust authentication, implement JWT or other auth here
  
  return next(new Error('Authentication error'));
});

// Client types
const CLIENT_TYPES = {
  DRIVER: 'driver',
  MONITOR: 'monitor'
};

// Keep track of connected clients
const connectedClients = {
  drivers: {},
  monitors: {}
};

// Handle WebSocket connections
io.on("connection", (socket) => {
  // Get client type and ID from connection params
  const clientType = socket.handshake.query.clientType || CLIENT_TYPES.MONITOR;
  const clientId = socket.handshake.query.clientId || socket.id;
  
  console.log(`New ${clientType} connected: ${clientId} (${socket.id})`);
  
  // Register client based on type
  if (clientType === CLIENT_TYPES.DRIVER) {
    connectedClients.drivers[clientId] = socket.id;
  } else {
    connectedClients.monitors[clientId] = socket.id;
    
    // Send all active drivers to new monitoring client
    Object.values(activeDrivers).forEach(driver => {
      socket.emit("driverData", driver);
    });
  }
  
  // Send connection acknowledgment
  socket.emit("connectionAck", { 
    clientId, 
    clientType,
    serverTime: new Date().toISOString(),
    activeDrivers: Object.keys(activeDrivers).length
  });
  
  // Handle driver location updates
  socket.on("driverLocation", (data) => {
    // Validate data format
    if (!data || !data.deviceID || !data.location || !data.location.coordinates) {
      console.error("Invalid location data received");
      return;
    }
    
    // Enrich data with additional info
    const enrichedData = {
      ...data,
      receivedAt: new Date().toISOString(),
      socketId: socket.id
    };
    
    console.log(`Location update from ${data.deviceID}: [${data.location.coordinates.join(', ')}], Speed: ${data.speed || 0} km/h`);
    
    // Save the driver data
    activeDrivers[data.deviceID] = enrichedData;
    
    // Add to history (limited memory storage - last 100 positions)
    if (!driverHistory[data.deviceID]) {
      driverHistory[data.deviceID] = [];
    }
    
    driverHistory[data.deviceID].push(enrichedData);
    
    // Keep history limited to last 100 positions per driver
    if (driverHistory[data.deviceID].length > 100) {
      driverHistory[data.deviceID].shift();
    }
    
    // Log to file (for permanent history)
    const today = new Date().toISOString().slice(0, 10);
    const logFile = path.join(
      config.storage.logDirectory,
      `${config.storage.logFilePrefix}${data.deviceID}_${today}.json`
    );
    
    fs.appendFile(
      logFile, 
      JSON.stringify(enrichedData) + "\n",
      err => {
        if (err) console.error("Error writing to log file:", err);
      }
    );
    
    // Broadcast to all monitoring clients
    io.to(Object.values(connectedClients.monitors)).emit("driverData", enrichedData);
    
    // Acknowledge receipt to the driver
    socket.emit("locationAck", {
      timestamp: data.timestamp,
      received: true,
      driverId: data.deviceID
    });
  });
  
  // Handle monitor-specific commands
  socket.on("monitorCommand", (command) => {
    if (!command || !command.type) return;
    
    switch (command.type) {
      case "requestDriverHistory":
        if (command.driverId && driverHistory[command.driverId]) {
          socket.emit("driverHistory", {
            driverId: command.driverId,
            history: driverHistory[command.driverId]
          });
        }
        break;
        
      case "sendMessageToDriver":
        if (command.driverId && command.message && connectedClients.drivers[command.driverId]) {
          io.to(connectedClients.drivers[command.driverId]).emit("driverMessage", {
            from: clientId,
            message: command.message,
            timestamp: new Date().toISOString()
          });
        }
        break;
    }
  });
  
  // Handle driver-specific events
  socket.on("driverEvent", (event) => {
    if (!event || !event.type) return;
    
    switch (event.type) {
      case "statusUpdate":
        // Update driver status (available, busy, etc.)
        if (event.driverId && event.status) {
          if (activeDrivers[event.driverId]) {
            activeDrivers[event.driverId].status = event.status;
            io.to(Object.values(connectedClients.monitors)).emit("driverStatusUpdate", {
              driverId: event.driverId,
              status: event.status,
              timestamp: new Date().toISOString()
            });
          }
        }
        break;
    }
  });
  
  // Handle client disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${clientId} (${socket.id})`);
    
    // Remove from connected clients list
    if (clientType === CLIENT_TYPES.DRIVER) {
      delete connectedClients.drivers[clientId];
      
      // Mark driver as offline but keep in active drivers for a while
      if (activeDrivers[clientId]) {
        activeDrivers[clientId].status = 'offline';
        activeDrivers[clientId].lastSeen = new Date().toISOString();
        
        // Notify monitors that driver went offline
        io.to(Object.values(connectedClients.monitors)).emit("driverOffline", {
          driverId: clientId,
          lastSeen: activeDrivers[clientId].lastSeen
        });
        
        // Schedule removal from active drivers after 10 minutes of inactivity
        setTimeout(() => {
          if (activeDrivers[clientId] && activeDrivers[clientId].status === 'offline') {
            delete activeDrivers[clientId];
          }
        }, 10 * 60 * 1000);
      }
    } else {
      delete connectedClients.monitors[clientId];
    }
  });
});

// Clean up inactive drivers periodically
const cleanupInactiveDrivers = () => {
  const now = Date.now() / 1000;
  const timeoutThreshold = 10 * 60; // 10 minutes
  
  Object.entries(activeDrivers).forEach(([driverId, driverData]) => {
    if (driverData.status === 'offline' || (now - driverData.timestamp) > timeoutThreshold) {
      console.log(`Removing inactive driver: ${driverId}`);
      delete activeDrivers[driverId];
      
      // Notify monitors that driver was removed
      io.to(Object.values(connectedClients.monitors)).emit("driverRemoved", {
        driverId,
        reason: "inactivity"
      });
    }
  });
};

// Run cleanup every 5 minutes
setInterval(cleanupInactiveDrivers, 5 * 60 * 1000);

// Function to load sample data from file
const loadSampleData = () => {
  try {
    // Try to load the sample data file if exists
    const sampleDataFile = path.join(__dirname, './sample-data/gpsData.json');
    if (fs.existsSync(sampleDataFile)) {
      return JSON.parse(fs.readFileSync(sampleDataFile, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading sample data:', err);
  }
  
  return null;
};

// Sample data sender for testing/demonstration
const enableSampleData = process.env.ENABLE_SAMPLE_DATA === 'true';
let sampleDataCounter = 0;
let sampleData = null;

if (enableSampleData) {
  sampleData = loadSampleData();
  
  if (sampleData && sampleData.gpsData && sampleData.gpsData.length > 0) {
    console.log(`Loaded ${sampleData.gpsData.length} sample GPS points for demonstration`);
    
    // Send sample data every 1 second
    setInterval(() => {
      if (sampleDataCounter >= sampleData.gpsData.length) {
        sampleDataCounter = 0;
      }
      
      const data = sampleData.gpsData[sampleDataCounter++];
      data.timestamp = Math.floor(Date.now() / 1000);
      
      io.emit("driverData", data);
      console.log(`Sent sample data point ${sampleDataCounter}/${sampleData.gpsData.length}`);
    }, config.app.locationUpdateInterval);
  } else {
    console.log('No sample data found or invalid format, disabling sample data');
  }
}

// Start the server
server.listen(config.server.port, config.server.host, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║             Real-time GPS Tracking Server              ║
╠════════════════════════════════════════════════════════╣
║ Status    : Running                                    ║
║ URL       : http${config.security.useSecureWebSockets ? 's' : ''}://${config.server.host}:${config.server.port} ║
║ Time      : ${new Date().toISOString()}          ║
║ Log Dir   : ${config.storage.logDirectory}                                 ║
║ Demo Mode : ${enableSampleData ? 'Enabled' : 'Disabled'}                                 ║
╚════════════════════════════════════════════════════════╝
  `);
});