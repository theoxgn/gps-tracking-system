const express = require("express");
const http = require("http");
const https = require("https");
const socketIo = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { v4: uuidv4 } = require('uuid'); // Tambahkan untuk keperluan ID pesan chat
const axios = require('axios'); // Tambahkan untuk GraphHopper API
require('dotenv').config(); // Tambahkan untuk membaca file .env

// GraphHopper API configuration
const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY;
const GRAPHHOPPER_API_URL = 'https://graphhopper.com/api/1/route';

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
let chatHistory = {}; // Format: { driverId: [messages] }
let driverRoutes = {}; 

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


// Simple health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// GraphHopper Route API endpoint
app.get("/api/route", async (req, res) => {
  try {
    const { 
      startLat, startLng, 
      endLat, endLng, 
      profile = 'car',
      truckSpecs = null,
      preferToll = true
    } = req.query;
    
    // Validasi input
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: "Missing required coordinates" });
    }
    
    console.log(`Calculating route from [${startLat},${startLng}] to [${endLat},${endLng}] using ${profile} profile`);
    
    // Siapkan parameter untuk GraphHopper
    const params = {
      point: [`${startLng},${startLat}`, `${endLng},${endLat}`],
      profile: profile || 'car',
      details: ["road_class", "toll", "surface"],
      instructions: true,
      calc_points: true,
      points_encoded: false,
      locale: "id",
      key: GRAPHHOPPER_API_KEY
    };
    
    // Tambahkan parameter khusus truk jika ada
    if (profile === 'truck' && truckSpecs) {
      try {
        const specs = typeof truckSpecs === 'string' ? JSON.parse(truckSpecs) : truckSpecs;
        
        Object.assign(params, {
          "vehicle.height": specs.height,
          "vehicle.weight": specs.weight * 1000, // konversi ke kg
          "vehicle.width": specs.width,
          "vehicle.length": specs.length,
          "vehicle.axles": specs.axles
        });
        
        console.log("Added truck specifications:", specs);
      } catch (error) {
        console.error("Failed to parse truck specs:", error);
      }
    }
    
    // Tambahkan opsi hindari tol jika diminta
    if (!preferToll) {
      // GraphHopper menggunakan custom model untuk menghindari tol
      Object.assign(params, {
        "ch.disable": true,
        "custom_model": JSON.stringify({
          "priority": [
            {
              "if": "road_class == TOLL",
              "multiply_by": 0.1 // Prioritas rendah untuk jalan tol
            }
          ]
        })
      });
      
      console.log("Added preference to avoid toll roads");
    }
    
    // Panggil API GraphHopper
    const response = await axios.get(GRAPHHOPPER_API_URL, { params });
    
    // Proses hasilnya dan tambahkan estimasi biaya tol
    if (response.data && response.data.paths && response.data.paths.length > 0) {
      const result = processRouteResponse(response.data, profile);
      return res.json(result);
    } else {
      return res.status(404).json({ error: "No route found" });
    }
  } catch (error) {
    console.error("GraphHopper API error:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Error calculating route",
      details: error.response?.data || error.message
    });
  }
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

  // Handle driver route updates
  socket.on("driverRoute", (data) => {
    // Validate data format
    if (!data || !data.deviceID || !data.startPoint || !data.endPoint) {
      console.error("Invalid route data received");
      return;
    }
    
    console.log(`Route update from ${data.deviceID}: ${data.startPoint} to ${data.endPoint}`);
    
    // Store the route data
    driverRoutes[data.deviceID] = {
      deviceID: data.deviceID,
      startPoint: data.startPoint,
      endPoint: data.endPoint,
      routeGeometry: data.routeGeometry || [data.startPoint, data.endPoint],
      transportMode: data.transportMode || 'driving-car',
      distance: data.distance,
      duration: data.duration,
      timestamp: Date.now()
    };
    
    // Update the active driver data with route information
    if (activeDrivers[data.deviceID]) {
      activeDrivers[data.deviceID].route = {
        startPoint: data.startPoint,
        endPoint: data.endPoint,
        hasRouteData: true
      };
    }
    
    // Broadcast to all monitoring clients
    io.to(Object.values(connectedClients.monitors)).emit("driverRouteUpdate", driverRoutes[data.deviceID]);
    
    // Acknowledge receipt to the driver
    socket.emit("routeAck", {
      deviceID: data.deviceID,
      received: true
    });
  });

  socket.on("requestDriverRoute", (data) => {
    if (!data || !data.driverId) return;
    
    if (driverRoutes[data.driverId]) {
      socket.emit("driverRouteUpdate", driverRoutes[data.driverId]);
    } else {
      socket.emit("driverRouteUpdate", {
        deviceID: data.driverId,
        hasRouteData: false
      });
    }
  });

  // Handle new request for route with toll information
  socket.on("requestRouteWithToll", async (data) => {
    // Validasi data
    if (!data || !data.startPoint || !data.endPoint) {
      socket.emit("routeError", { error: "Invalid route request data" });
      return;
    }
    
    try {
      // Persiapkan parameter untuk permintaan rute
      const params = {
        startLat: data.startPoint[0],
        startLng: data.startPoint[1],
        endLat: data.endPoint[0],
        endLng: data.endPoint[1],
        profile: mapTransportModeToProfile(data.transportMode || 'driving-car'),
        preferToll: data.preferTollRoads !== false // Default ke true jika tidak disediakan
      };
      
      // Tambahkan spesifikasi truk jika disediakan
      if (data.transportMode === 'driving-hgv' && data.truckSpecs) {
        params.truckSpecs = data.truckSpecs;
      }
      
      // Panggil API internal
      const response = await axios.get(`http://localhost:${config.server.port}/api/route`, { params });
      
      // Transformasi respons untuk sesuai dengan format yang diharapkan
      const routeData = transformGraphhopperResponse(response.data, data);
      
      // Simpan rute dengan informasi tol
      if (data.deviceID) {
        driverRoutes[data.deviceID] = {
          ...routeData,
          deviceID: data.deviceID,
          timestamp: Date.now()
        };
        
        // Notifikasi monitor baru tentang perubahan rute
        io.to(Object.values(connectedClients.monitors)).emit("driverRouteUpdate", driverRoutes[data.deviceID]);
      }
      
      // Kirim kembali ke pengirim
      socket.emit("routeWithTollResponse", routeData);
      
    } catch (error) {
      console.error("Error processing route with toll request:", error);
      socket.emit("routeError", {
        error: "Failed to process route request",
        details: error.message
      });
    }
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
      
      // Send all active driver routes to the new monitor
      Object.values(driverRoutes).forEach(route => {
        socket.emit("driverRouteUpdate", route);
      });
    }
  });
});

// Helper function to convert transport mode to GraphHopper profile
function mapTransportModeToProfile(mode) {
  switch (mode) {
    case 'driving-car': return 'car';
    case 'driving-hgv': return 'truck';
    case 'cycling-regular': return 'bike';
    case 'foot-walking': return 'foot';
    default: return 'car';
  }
}

// Function to process route response and add toll cost estimation
function processRouteResponse(routeData, profile) {
  const path = routeData.paths[0];
  const usesToll = path.details && path.details.toll && path.details.toll.length > 0;
  
  // Jika tidak menggunakan tol, tidak perlu hitung biaya
  if (!usesToll) {
    return {
      ...routeData,
      toll_info: {
        usesToll: false
      }
    };
  }
  
  // Hitung total jarak tol
  let tollDistance = 0;
  let tollSegments = [];
  
  if (path.details && path.details.toll) {
    for (const tollSegment of path.details.toll) {
      const startIndex = tollSegment[0];
      const endIndex = tollSegment[1];
      
      // Hitung jarak untuk segmen tol ini
      const segmentPoints = path.points.coordinates.slice(startIndex, endIndex + 1);
      let segmentDistance = 0;
      
      for (let i = 0; i < segmentPoints.length - 1; i++) {
        const p1 = segmentPoints[i];
        const p2 = segmentPoints[i + 1];
        segmentDistance += calculateDistance(
          [p1[1], p1[0]], // [lat, lng]
          [p2[1], p2[0]]  // [lat, lng]
        );
      }
      
      tollDistance += segmentDistance;
      
      // Identifikasi segmen tol (untuk debugging dan detail)
      tollSegments.push({
        start_idx: startIndex,
        end_idx: endIndex,
        distance: segmentDistance
      });
    }
  }
  
  // Estimasi biaya tol berdasarkan kelas kendaraan dan jarak
  const vehicleClass = getVehicleClass(profile);
  const tollRate = getTollRateForClass(vehicleClass);
  const estimatedCost = Math.round(tollDistance * tollRate / 1000); // Konversi m ke km
  
  // Tambahkan informasi tol ke respons
  return {
    ...routeData,
    toll_info: {
      usesToll: true,
      tollDistance: tollDistance / 1000, // km
      vehicleClass: vehicleClass,
      estimatedCost: estimatedCost,
      currency: "IDR",
      segments: tollSegments,
      note: "Estimasi biaya berdasarkan tarif rata-rata per kilometer"
    }
  };
}

// Transform GraphHopper response to application's expected format
function transformGraphhopperResponse(graphhopperData, originalRequest) {
  if (!graphhopperData.paths || !graphhopperData.paths[0]) {
    return { error: "No route data available" };
  }
  
  const path = graphhopperData.paths[0];
  
  // Konversi koordinat (dari [lng, lat] ke [lat, lng] untuk Leaflet)
  const routeGeometry = path.points.coordinates.map(coord => [coord[1], coord[0]]);
  
  // Ekstrak instruksi rute
  const instructions = path.instructions ? path.instructions.map(instr => ({
    instruction: instr.text,
    distance: instr.distance,
    duration: instr.time / 1000, // konversi ms ke detik
    type: instr.sign, // GraphHopper menggunakan tanda untuk jenis instruksi
    modifier: ''
  })) : [];
  
  // Buat respons yang sesuai dengan format aplikasi
  return {
    startPoint: originalRequest.startPoint,
    endPoint: originalRequest.endPoint,
    routeGeometry: routeGeometry,
    transportMode: originalRequest.transportMode || 'driving-car',
    distance: path.distance / 1000, // konversi m ke km
    duration: Math.round(path.time / 60000), // konversi ms ke menit
    instructions: instructions,
    tollInfo: graphhopperData.toll_info || {
      usesToll: false
    },
    deviceID: originalRequest.deviceID
  };
}

// Helper untuk menentukan golongan kendaraan
function getVehicleClass(profile) {
  if (profile === 'car') return 1; // Golongan I
  if (profile === 'truck') return 2; // Default Golongan II untuk truk
  return 1; // Default
}

// Helper untuk mendapatkan tarif tol per km berdasarkan golongan
function getTollRateForClass(vehicleClass) {
  // Tarif rata-rata per km di jalan tol Indonesia (Rp)
  // Ini estimasi kasar, sebaiknya data sebenarnya diambil dari database
  switch (vehicleClass) {
    case 1: return 900;   // Golongan I: sedan, jip, pick up, truk kecil
    case 2: return 1350;  // Golongan II: truk dengan 2 gandar
    case 3: return 1800;  // Golongan III: truk dengan 3 gandar
    case 4: return 2250;  // Golongan IV: truk dengan 4 gandar
    case 5: return 2700;  // Golongan V: truk dengan 5 gandar atau lebih
    default: return 900;
  }
}

// Helper function untuk menghitung jarak antara dua titik (dalam meter)
function calculateDistance(point1, point2) {
  const R = 6371000; // radius bumi dalam meter
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

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
  
};

// Run cleanup every 5 minutes
setInterval(cleanupInactiveDrivers, 5 * 60 * 1000);

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
║ Demo Mode : ${typeof enableSampleData !== 'undefined' ? (enableSampleData ? 'Enabled' : 'Disabled') : 'Disabled'}                                 ║
║ Chat      : ${config.chat && config.chat.enabled ? 'Enabled' : 'Disabled'}                                 ║
╚════════════════════════════════════════════════════════╝
  `);
});