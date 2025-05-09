// config.js - Configuration for GPS tracking system
module.exports = {
    // Server configuration
    server: {
      port: process.env.PORT || 4001,
      host: process.env.HOST || '0.0.0.0',
      corsOrigins: process.env.CORS_ORIGINS || '*'
    },
    
    // Database/storage configuration
    storage: {
      // File storage settings
      logDirectory: process.env.LOG_DIR || './logs',
      logFilePrefix: 'gps_log_',
      
      // Use database flag (if implementing database storage later)
      useDatabase: process.env.USE_DB === 'true' || false,
      
      // Database connection (for future implementation)
      dbConnection: process.env.DB_CONNECTION_STRING || '',
    },
    
    // Security settings
    security: {
      // Enable secure WebSocket (wss://)
      useSecureWebSockets: process.env.USE_SECURE_WS === 'true' || false,
      
      // Simple API key for basic protection (not for production use)
      apiKey: process.env.API_KEY || 'default-dev-key',
      
      // SSL certificate paths (if using HTTPS directly)
      sslCert: process.env.SSL_CERT || '',
      sslKey: process.env.SSL_KEY || ''
    },
    
    // Application settings
    app: {
      // Default map settings
      defaultCenter: [8.7, 115.2], // Default to Bali coordinates based on your data
      defaultZoom: 12,
      
      // Tracking settings
      locationUpdateInterval: process.env.LOCATION_INTERVAL || 1000, // ms
      retryInterval: process.env.RETRY_INTERVAL ? parseInt(process.env.RETRY_INTERVAL) : 5000, // ms
      
      // Appearance
      driverMarkerColor: '#3388ff',
      selectedDriverMarkerColor: '#ff3388'
    }
  };