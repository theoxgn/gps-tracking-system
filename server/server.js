const express = require("express");
const http = require("http");
const https = require("https");
const socketIo = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { v4: uuidv4 } = require('uuid'); // Tambahkan untuk keperluan ID pesan chat

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
// Initialize chat data storage
let chatHistory = {}; // Format: { driverId: [messages] }

// Utilitas untuk validasi dan rate limiting chat
const chatValidation = {
  // Rate limit: menyimpan timestamp pesan terakhir per client
  messageCounts: {},
  
  /**
   * Memvalidasi pesan dan mengecek rate limit
   * @param {Object} message - Objek pesan
   * @param {String} clientId - ID client
   * @returns {Object} - Hasil validasi {valid, error}
   */
  validateMessage: function(message, clientId) {
    // Validasi format pesan
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Invalid message format' };
    }
    
    // Validasi field yang diperlukan
    if (!message.text || typeof message.text !== 'string') {
      return { valid: false, error: 'Message text is required' };
    }
    
    if (!message.from || typeof message.from !== 'string') {
      return { valid: false, error: 'Message sender (from) is required' };
    }
    
    if (!message.to || typeof message.to !== 'string') {
      return { valid: false, error: 'Message recipient (to) is required' };
    }
    
    // Validasi panjang pesan
    if (message.text.length > (config.chat && config.chat.maxMessageLength ? config.chat.maxMessageLength : 1000)) {
      return { 
        valid: false, 
        error: `Message too long. Maximum length is ${config.chat ? config.chat.maxMessageLength : 1000} characters` 
      };
    }
    
    // Rate limiting
    if (config.chat && config.chat.messageRateLimit > 0) {
      const now = Date.now();
      
      // Inisialisasi atau reset jika sudah lebih dari 1 menit
      if (!this.messageCounts[clientId] || now - this.messageCounts[clientId].firstMessage > 60000) {
        this.messageCounts[clientId] = {
          count: 1,
          firstMessage: now,
          lastMessage: now
        };
      } else {
        // Tingkatkan hitungan dan perbarui waktu pesan terakhir
        this.messageCounts[clientId].count++;
        this.messageCounts[clientId].lastMessage = now;
        
        // Cek apakah melebihi batas
        if (this.messageCounts[clientId].count > config.chat.messageRateLimit) {
          return { 
            valid: false, 
            error: `Rate limit exceeded. Maximum ${config.chat.messageRateLimit} messages per minute` 
          };
        }
      }
    }
    
    return { valid: true };
  },
  
  /**
   * Membersihkan data rate limiting
   */
  cleanupRateLimits: function() {
    const now = Date.now();
    Object.keys(this.messageCounts).forEach(clientId => {
      if (now - this.messageCounts[clientId].lastMessage > 120000) { // 2 menit
        delete this.messageCounts[clientId];
      }
    });
  }
};

/**
 * Utilitas untuk mengelola riwayat chat
 */
const chatUtils = {
  /**
   * Menyimpan pesan ke riwayat chat dan file log
   * @param {Object} message - Objek pesan
   */
  saveMessage: function(message) {
    const driverId = message.to === 'monitor' ? message.from : message.to;
    
    // Inisialisasi riwayat chat untuk driver jika belum ada
    if (!chatHistory[driverId]) {
      chatHistory[driverId] = [];
    }
    
    // Tambahkan pesan ke riwayat
    chatHistory[driverId].push(message);
    
    // Batasi jumlah pesan yang disimpan di memori (simpan 200 pesan terakhir atau sesuai konfigurasi)
    const maxMessages = config.chat && config.chat.maxChatMessagesPerDriver 
      ? config.chat.maxChatMessagesPerDriver 
      : 200;
      
    if (chatHistory[driverId].length > maxMessages) {
      chatHistory[driverId] = chatHistory[driverId].slice(-maxMessages);
    }
    
    // Log chat ke file jika diaktifkan di config
    if (config.storage && config.storage.logChat) {
      const today = new Date().toISOString().slice(0, 10);
      const logFile = path.join(
        config.storage.logDirectory,
        `${config.storage.chatLogPrefix || 'chat_'}${driverId}_${today}.json`
      );
      
      fs.appendFile(
        logFile, 
        JSON.stringify(message) + "\n",
        err => {
          if (err) console.error("Error writing chat to log file:", err);
        }
      );
    }
  },
  
  /**
   * Menandai pesan sebagai telah dibaca
   * @param {Array} messageIds - Array ID pesan
   * @param {String} reader - ID pembaca
   * @returns {Array} - Array driver IDs yang pesannya diupdate
   */
  markMessagesAsRead: function(messageIds, reader) {
    // Tandai pesan sebagai telah dibaca di semua riwayat chat
    return Object.keys(chatHistory).map(driverId => {
      let updated = false;
      
      chatHistory[driverId] = chatHistory[driverId].map(msg => {
        if (messageIds.includes(msg.id)) {
          updated = true;
          return { ...msg, read: true };
        }
        return msg;
      });
      
      // Jika ada pesan yang diupdate, kirimkan notifikasi pesan dibaca
      if (updated) {
        return {
          driverId,
          updated: true
        };
      }
      
      return null;
    }).filter(Boolean); // Filter hasil null
  }
};

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
app.get("/api/drivers", (req, res) => {
  res.json({ drivers: activeDrivers });
});

// API to get specific driver data
app.get("/api/drivers/:driverId", (req, res) => {
  const driverId = req.params.driverId;
  
  if (!activeDrivers[driverId]) {
    return res.status(404).json({ error: "Driver not found" });
  }
  
  res.json({ driver: activeDrivers[driverId] });
});

// API untuk menghitung biaya tol berdasarkan gerbang masuk, keluar, dan jenis kendaraan
const { calculateTollCost } = require("./tollgateModel");
app.get("/api/calculate-toll", (req, res) => {
  /**
   * Endpoint untuk menghitung biaya tol
   * Query: startGate, endGate, vehicleType
   */
  const { startGate, endGate, vehicleType } = req.query;
  if (!startGate || !endGate || !vehicleType) {
    return res.status(400).json({ error: "Parameter startGate, endGate, dan vehicleType wajib diisi" });
  }
  const cost = calculateTollCost(startGate, endGate, vehicleType);
  if (cost === null) {
    return res.status(404).json({ error: "Data biaya tol tidak ditemukan untuk kombinasi tersebut" });
  }
  res.json({ startGate, endGate, vehicleType, cost });
});

// API to get driver history for a specific time period
app.get("/api/history/:driverId", (req, res) => {
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

// API untuk mengambil riwayat chat
app.get("/api/chat/:driverId", authenticateAPI, (req, res) => {
  const driverId = req.params.driverId;
  
  if (!chatHistory[driverId]) {
    return res.status(200).json({ messages: [] });
  }
  
  const limit = parseInt(req.query.limit) || 50;
  const messages = chatHistory[driverId].slice(-limit);
  
  res.json({ messages });
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
  
  // ===== CHAT FEATURE EVENT HANDLERS =====
  
  // Handle chat message sending
  socket.on("sendMessage", (data) => {
    // Validasi data pesan menggunakan utilitas validasi
    const validation = chatValidation.validateMessage(data, clientId);
    if (!validation.valid) {
      console.error(`Invalid message from ${clientId}: ${validation.error}`);
      socket.emit("messageError", {
        error: validation.error,
        timestamp: Date.now()
      });
      return;
    }
    
    // Tambahkan properti tambahan ke pesan
    const message = {
      ...data,
      id: uuidv4(),
      timestamp: data.timestamp || Date.now(),
      read: false
    };
    
    console.log(`Chat message from ${message.from} to ${message.to}: ${message.text.substring(0, 30)}${message.text.length > 30 ? '...' : ''}`);
    
    // Simpan pesan ke riwayat
    chatUtils.saveMessage(message);
    
    // Kirim pesan ke penerima
    if (message.to === 'monitor') {
      // Pesan dari driver ke monitor
      // Kirim ke semua monitor yang terhubung
      Object.values(connectedClients.monitors).forEach(socketId => {
        io.to(socketId).emit("receiveMessage", message);
      });
    } else {
      // Pesan dari monitor ke driver
      const driverSocketId = connectedClients.drivers[message.to];
      if (driverSocketId) {
        io.to(driverSocketId).emit("receiveMessage", message);
      } else {
        console.log(`Driver ${message.to} tidak terhubung, pesan disimpan untuk dibaca nanti`);
      }
    }
    
    // Konfirmasi pengiriman ke pengirim
    socket.emit("receiveMessage", {
      ...message,
      delivered: true
    });
  });
  
  // Handle request for chat history
  socket.on("getChatHistory", (data, callback) => {
    // Validasi parameter
    if (!data || !data.driverId) {
      console.error("Invalid request for chat history");
      if (typeof callback === 'function') {
        callback({ error: "Invalid request parameters" });
      }
      return;
    }
    
    console.log(`Chat history requested for driver: ${data.driverId}`);
    
    // Kirim riwayat chat
    if (typeof callback === 'function') {
      callback({
        messages: chatHistory[data.driverId] || []
      });
    }
  });
  
  // Handle marking messages as read
  socket.on("markAsRead", (data) => {
    // Validasi parameter
    if (!data || !data.messageIds || !data.reader) {
      console.error("Invalid request to mark messages as read");
      return;
    }
    
    console.log(`Marking ${data.messageIds.length} messages as read by ${data.reader}`);
    
    // Proses penandaan pesan sebagai telah dibaca
    const updatedDrivers = chatUtils.markMessagesAsRead(data.messageIds, data.reader);
    
    // Kirim notifikasi pesan telah dibaca ke pengirim asli
    if (updatedDrivers && updatedDrivers.length > 0) {
      updatedDrivers.forEach(({ driverId }) => {
        // Tentukan penerima notifikasi berdasarkan reader
        if (data.reader === 'monitor') {
          // Jika monitor yang membaca, kirim notifikasi ke driver terkait
          const driverSocketId = connectedClients.drivers[driverId];
          if (driverSocketId) {
            io.to(driverSocketId).emit("messageRead", data);
          }
        } else {
          // Jika driver yang membaca, kirim notifikasi ke semua monitor
          Object.values(connectedClients.monitors).forEach(socketId => {
            io.to(socketId).emit("messageRead", data);
          });
        }
      });
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

  // Handle client identification
  socket.on("identify", (data) => {
    console.log(`Client identified: ${socket.id} as ${data.type}`, data);
    
    if (data.type === CLIENT_TYPES.DRIVER) {
      const driverId = data.driverId || socket.id;
      // Update the registry with the correct driver ID
      connectedClients.drivers[driverId] = socket.id;
      console.log(`Driver registered: ${driverId}`);
      
      // Send any pending messages to this driver
      if (chatHistory[driverId]) {
        const unreadMessages = chatHistory[driverId].filter(msg => 
          !msg.read && msg.to === driverId
        );
        if (unreadMessages.length > 0) {
          console.log(`Sending ${unreadMessages.length} pending messages to driver ${driverId}`);
          unreadMessages.forEach(msg => {
            socket.emit("receiveMessage", msg);
          });
        }
      }
    } else if (data.type === CLIENT_TYPES.MONITOR) {
      // For monitor, use a consistent ID or the socket ID
      const monitorId = data.monitorId || 'monitor-' + socket.id;
      connectedClients.monitors[monitorId] = socket.id;
      console.log(`Monitor registered: ${monitorId}`);
    }
  });
});

// Clean up inactive drivers periodically
const cleanupInactiveDrivers = () => {
  const now = Date.now() / 1000;
  const timeoutThreshold = 10 * 60; // 10 minutes
  const chatCleanupThreshold = 30 * 24 * 60 * 60; // 30 days (atau ambil dari config)
  
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
  
  // Cleanup old chat messages
  Object.entries(chatHistory).forEach(([driverId, messages]) => {
    // Filter out messages older than the threshold
    const newMessages = messages.filter(message => 
      (now - message.timestamp/1000) < chatCleanupThreshold
    );
    
    // If we removed any messages, update the history
    if (newMessages.length < messages.length) {
      console.log(`Cleaned up ${messages.length - newMessages.length} old chat messages for ${driverId}`);
      chatHistory[driverId] = newMessages;
    }
    
    // If no messages left, remove the driver entry
    if (newMessages.length === 0) {
      delete chatHistory[driverId];
    }
  });
  
  // Cleanup rate limits
  chatValidation.cleanupRateLimits();
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

// Endpoint API untuk mengambil seluruh data gerbang tol Trans Jawa beserta tarif sesuai golongan kendaraan
const tollgateModel = require('./tollgateModel');

/**
 * Mengembalikan seluruh data gerbang tol Trans Jawa
 */
app.get('/api/toll-gates', (req, res) => {
  // Ambil parameter golongan kendaraan dari query string, misal: gol1, gol2, dst
  const vehicleClass = req.query.vehicleClass;
  const tollgates = tollgateModel.getAllTollgates(vehicleClass);
  res.json(tollgates);
});

// Tambahkan interval untuk pembersihan rate limits chat
setInterval(chatValidation.cleanupRateLimits, 5 * 60 * 1000);

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
║ Chat      : ${config.chat && config.chat.enabled ? 'Enabled' : 'Disabled'}                                 ║
╚════════════════════════════════════════════════════════╝
  `);
});