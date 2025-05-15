import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { LoadScript } from '@react-google-maps/api';
import axios from "axios";
import ChatComponent from './ChatComponent';

// Import icons
import { 
  Truck, 
  Navigation, 
  Wifi, 
  WifiOff,
  MapPin,
  Activity,
  Clock,
  RefreshCw,
  ArrowRight,
  MapPinned,
  Target,
  X
} from 'lucide-react';

// Import components and utilities
import { styles } from './styles';
import PlacesAutocomplete from './components/PlacesAutocomplete';
import { createCustomIcon, calculateDistance } from './utils/mapUtils';
import { RouteLine, MapController } from './components/MapComponents';

// Constants
const SERVER_URL = process.env.REACT_APP_API_URL;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAPS_LIBRARIES = ['places'];

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
});

/**
 * Main App component
 */
function App() {
  // Location and tracking state
  const [position, setPosition] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  // Socket and connection state
  const [connected, setConnected] = useState(false);
  const [driverId, setDriverId] = useState('Driver-' + Math.floor(Math.random() * 1000));
  const [socket, setSocket] = useState(null);
  
  // Map references
  const mapRef = useRef(null);
  
  // Route state
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  
  // Toll and vehicle state
  const [vehicleClass, setVehicleClass] = useState('gol1'); // default golongan tol
  const [nearestStartTollGate, setNearestStartTollGate] = useState(null);
  const [nearestEndTollGate, setNearestEndTollGate] = useState(null);
  const [estimatedTollCost, setEstimatedTollCost] = useState(null);
  const [useToll, setUseToll] = useState(true);
  const [tollGates, setTollGates] = useState([]);
  const [buttonHover, setButtonHover] = useState(false);

  /**
   * Initialize socket connection
   */
  useEffect(() => {
    const socketInstance = io(SERVER_URL);
    
    socketInstance.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      
      // Identify as a driver to the server
      socketInstance.emit('identify', {
        type: 'driver',
        driverId: driverId
      });
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });
    
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, [driverId]);

  /**
   * Force map resize when component mounts
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  /**
   * Add required CSS for map display
   */
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .leaflet-container {
        width: 100% !important;
        height: 100% !important;
        z-index: 1;
      }
      .map-wrapper {
        position: relative;
        flex-grow: 1;
        height: 100vh;
        width: 100%;
        overflow: hidden;
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #f8fafc;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #cbd5e1;
        border-radius: 4px;
      }
      .custom-div-icon {
        transition: transform 0.2s ease;
      }
      .custom-div-icon:hover {
        transform: scale(1.2);
      }
      
      /* Responsive styles */
      @media (max-width: 768px) {
        .map-wrapper {
          height: 50vh;
        }
        #root {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  /**
   * Fetch toll gates data from API
   */
  useEffect(() => {
    const fetchTollGates = async () => {
      try {
        console.log('Fetching toll gates data...');
        
        // Try primary endpoint first
        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/toll-gates`);
          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            console.log('Toll gates data received from /api/toll-gates:', response.data.length, 'gates');
            setTollGates(response.data);
            return;
          }
        } catch (primaryErr) {
          console.warn('Failed to fetch from primary endpoint /api/toll-gates:', primaryErr.message);
        }

        // Try alternative endpoint if primary fails
        try {
          const altResponse = await axios.get(`${process.env.REACT_APP_API_URL}/toll/gates`);
          if (altResponse.data && Array.isArray(altResponse.data) && altResponse.data.length > 0) {
            console.log('Toll gates data received from /toll/gates:', altResponse.data.length, 'gates');
            setTollGates(altResponse.data);
            return;
          }
        } catch (altErr) {
          console.warn('Failed to fetch from alternative endpoint /toll/gates:', altErr.message);
        }

        console.error('Failed to fetch toll gates data from all endpoints');
        setTollGates([]);
      } catch (err) {
        console.error('Completely failed to get toll gates data:', err);
        setTollGates([]);
      }
    };
    fetchTollGates();
  }, []);

  /**
   * Find nearest toll gate to a point
   */
  const findNearestTollGate = (point) => {
    if (!point || tollGates.length === 0) return null;
    let nearest = null;
    let minDistance = Infinity;
    
    console.log('Finding nearest toll gate for point:', point);
    
    tollGates.forEach(gate => {
      // Adapt to different data formats that might come from API
      const latitude = gate.latitude || gate.lat || (gate.position ? gate.position[0] : null);
      const longitude = gate.longitude || gate.lng || (gate.position ? gate.position[1] : null);
      
      if (latitude !== null && longitude !== null) {
        const gatePos = [latitude, longitude];
        const distance = calculateDistance(point, gatePos);
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { ...gate, distance };
        }
      }
    });
    
    if (nearest) {
      console.log('Nearest toll gate found:', nearest.name, 'at distance:', nearest.distance.toFixed(2), 'km');
      return nearest;
    }
    
    console.log('No toll gate found');
    return null;
  };

  /**
   * Estimate toll cost based on gates and vehicle class
   */
  const estimateTollCost = (startGate, endGate, vehicleClass) => {
    if (!startGate || !endGate) return null;
    
    // Check if gates are the same (no toll fee)
    if (startGate.name === endGate.name) return 0;
    
    // Call the API to get the toll cost
    return axios.get(`${process.env.REACT_APP_API_URL}/api/calculate-toll`, {
      params: {
        startGate: startGate.name,
        endGate: endGate.name,
        vehicleType: vehicleClass
      },
      headers: {
        'x-api-key': process.env.REACT_APP_API_KEY || '',
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (response.data && typeof response.data.cost === 'number') {
        return response.data.cost;
      }
      return null;
    })
    .catch(error => {
      console.error('Failed to calculate toll cost:', error);
      return null;
    });
  };

  /**
   * Calculate route information (distance, duration, toll)
   */
  const calculateRouteInfo = async (start, end) => {
    console.log('Calculating route info between:', start, 'and', end);
    
    // Calculate distance in kilometers using Haversine formula
    const distance = calculateDistance(start, end);
    setRouteDistance(distance);
    console.log('Route distance:', distance.toFixed(2), 'km');
    
    // Estimate duration based on average speed (50 km/h)
    const avgSpeedKmh = 50;
    const durationHours = distance / avgSpeedKmh;
    const durationMinutes = Math.round(durationHours * 60);
    setRouteDuration(durationMinutes);
    console.log('Estimated duration:', durationMinutes, 'minutes');
    
    // Find nearest toll gates to start and end points
    console.log('Finding nearest toll gates...');
    const startTollGate = findNearestTollGate(start);
    const endTollGate = findNearestTollGate(end);
    
    setNearestStartTollGate(startTollGate);
    setNearestEndTollGate(endTollGate);
    
    // Calculate toll cost if toll is enabled and gates are found
    if (useToll && startTollGate && endTollGate) {
      console.log('Calculating toll cost...');
      try {
        const tollCost = await estimateTollCost(startTollGate, endTollGate, vehicleClass);
        setEstimatedTollCost(tollCost);
      } catch (error) {
        console.error('Error calculating toll cost:', error);
        setEstimatedTollCost(null);
      }
    } else {
      setEstimatedTollCost(null);
    }
  };

  /**
   * Start location tracking
   */
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    
    setError('Requesting location access...');
    
    const locationTimeout = 15000; 
    
    try {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const currentPosition = [latitude, longitude];
          console.log('Got position:', currentPosition);
          setPosition(currentPosition);
          setSpeed(position.coords.speed || 0);
          setHeading(position.coords.heading || 0);
          setLastUpdate(new Date().toLocaleTimeString());
          setError(null); // Clear error on success
          
          // Send position to server if connected
          if (socket && connected) {
            socket.emit('driverLocation', {
              deviceID: driverId,
              location: {
                type: 'Point',
                coordinates: [longitude, latitude]
              },
              speed: position.coords.speed || 0,
              heading: position.coords.heading || 0,
              timestamp: Math.floor(Date.now() / 1000)
            });
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          
          // More user-friendly error messages
          if (err.code === 1) {
            setError('Location access denied. Please enable location services for this website.');
          } else if (err.code === 2) {
            setError('Location unavailable. Please try again later.');
          } else if (err.code === 3) {
            setError('Location request timed out. Please try again.');
          } else {
            setError(`Error getting location: ${err.message}`);
          }
        },
        { 
          enableHighAccuracy: true, 
          maximumAge: 0,
          timeout: locationTimeout
        }
      );
      
      setWatchId(id);
    } catch (e) {
      console.error('Fatal error setting up geolocation:', e);
      setError(`Could not initialize location tracking: ${e.message}`);
    }
  };

  /**
   * Stop location tracking
   */
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    setError(null);
  };

  // Event handlers
  const handleDriverIdChange = (e) => {
    setDriverId(e.target.value);
  };

  const handleStartAddressChange = (e) => {
    setStartAddress(e.target.value);
  };

  const handleEndAddressChange = (e) => {
    setEndAddress(e.target.value);
  };
  
  const handleStartLocationSelect = (location) => {
    setStartAddress(location.address);
    setStartPoint(location.position);
    
    // Calculate route info when both points are set
    if (endPoint) {
      calculateRouteInfo(location.position, endPoint);
    }
  };
  
  const handleEndLocationSelect = (location) => {
    setEndAddress(location.address);
    setEndPoint(location.position);
    
    // Calculate route info when both points are set
    if (startPoint) {
      calculateRouteInfo(startPoint, location.position);
    }
  };

  const setCurrentAsStart = () => {
    if (!position) {
      setError('Location not available. Please start tracking first.');
      return;
    }
    
    setStartPoint(position);
    setStartAddress(`Lokasi Saat Ini (${position[0].toFixed(4)}, ${position[1].toFixed(4)})`);
    
    // Calculate route info when both points are set
    if (endPoint) {
      calculateRouteInfo(position, endPoint);
    }
  };

  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setStartAddress('');
    setEndAddress('');
    setRouteDistance(null);
    setRouteDuration(null);
    setNearestStartTollGate(null);
    setNearestEndTollGate(null);
    setEstimatedTollCost(null);
  };

  // Render helper components
  const renderHeader = () => (
    <div style={styles.header}>
      <div style={styles.headerTitle}>
        <Truck style={styles.headerIcon} size={24} />
        Driver Tracker
      </div>
      <div style={styles.statusBadge}>
        <div>
          {connected ? 
            <><Wifi size={14} style={{ color: '#4ade80', marginRight: '4px' }} /> Connected</> : 
            <><WifiOff size={14} style={{ color: '#f87171', marginRight: '4px' }} /> Disconnected</>
          }
        </div>
        <div style={watchId !== null ? styles.statusBadgeActive : styles.statusBadgeInactive}>
          <Activity size={14} style={watchId !== null ? styles.statusDotActive : styles.statusDotInactive} />
          <span style={{ marginLeft: '4px' }}>{watchId !== null ? 'Active' : 'Idle'}</span>
        </div>
      </div>
    </div>
  );

  const renderDriverInfo = () => (
    <>
      <div style={styles.sectionTitle}>
        <Truck size={18} /> Driver Information
      </div>
      
      <div style={{
        ...styles.card, 
        ...(watchId !== null ? styles.cardActive : {})
      }}>
        <div style={styles.cardHeader}>
          <div style={styles.cardTitle}>{driverId}</div>
          <div style={styles.cardTime}>
            <Clock size={12} />
            {lastUpdate ? lastUpdate : 'Not tracking'}
          </div>
        </div>
        <div style={styles.cardGrid}>
          <div style={styles.infoItem}>
            <MapPin size={13} style={styles.infoIcon} />
            {position ? `${position[0].toFixed(4)}, ${position[1].toFixed(4)}` : 'No location'}
          </div>
          <div style={styles.infoItem}>
            <Navigation size={13} style={styles.infoIcon} />
            {speed ? (speed * 3.6).toFixed(1) + ' km/h' : 'Idle'}
          </div>
        </div>
      </div>
    </>
  );

  const renderStatusDetails = () => (
    <>
      <div style={styles.sectionTitle}>
        <Activity size={18} /> Status Details
      </div>
      
      <div style={styles.statusDetail}>
        <div style={styles.card}>
          <div style={styles.statusLabel}>Location</div>
          <div style={{ wordWrap: 'break-word' }}>
            {position ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'No location data'}
          </div>
        </div>
        
        <div style={styles.card}>
          <div style={styles.statusLabel}>Speed</div>
          <div>{(speed * 3.6).toFixed(1)} km/h</div>
        </div>
        
        <div style={styles.card}>
          <div style={styles.statusLabel}>Heading</div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {heading ? heading.toFixed(0) + '°' : 'N/A'}
            {heading && 
              <Navigation 
                size={14} 
                style={{ 
                  marginLeft: '8px', 
                  color: '#60a5fa',
                  transform: `rotate(${heading}deg)` 
                }} 
              />
            }
          </div>
        </div>
        
        <div style={styles.card}>
          <div style={styles.statusLabel}>Last Update</div>
          <div>{lastUpdate || 'Never'}</div>
        </div>
      </div>
    </>
  );

  const renderRouteInfo = () => {
    if (!startPoint || !endPoint) return null;
    
    return (
      <>
        <div style={{...styles.sectionTitle, marginTop: '12px'}}>
          <MapPinned size={16} /> Informasi Rute
        </div>
        
        <div style={styles.card}>
          <div style={styles.statusLabel}>Jarak</div>
          <div>{routeDistance ? routeDistance.toFixed(2) + ' km' : 'Menghitung...'}</div>
        </div>
        
        <div style={styles.card}>
          <div style={styles.statusLabel}>Perkiraan Waktu</div>
          <div>{routeDuration ? routeDuration + ' menit' : 'Menghitung...'}</div>
        </div>
      </>
    );
  };

  const renderTollInfo = () => {
    if (!startPoint || !endPoint) return null;
    
    return (
      <>
        <div style={{...styles.sectionTitle, marginTop: '12px', fontSize: '16px'}}>
          <MapPinned size={16} /> Informasi Tol
        </div>
        
        <div style={{...styles.card, marginBottom: '8px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={styles.statusLabel}>Gunakan Tol</div>
            <div>
              <label className="switch" style={{
                position: 'relative',
                display: 'inline-block',
                width: '40px',
                height: '20px'
              }}>
                <input 
                  type="checkbox" 
                  checked={useToll}
                  onChange={() => {
                    const newUseToll = !useToll;
                    setUseToll(newUseToll);
                    if (startPoint && endPoint) {
                      // Recalculate route info when toll preference changes
                      calculateRouteInfo(startPoint, endPoint);
                    }
                  }}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0
                  }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: useToll ? '#3b82f6' : '#374151',
                  transition: '.4s',
                  borderRadius: '34px',
                  '&:before': {
                    position: 'absolute',
                    content: '""',
                    height: '16px',
                    width: '16px',
                    left: '2px',
                    bottom: '2px',
                    backgroundColor: 'white',
                    transition: '.4s',
                    borderRadius: '50%',
                    transform: useToll ? 'translateX(20px)' : 'translateX(0)'
                  }
                }}>
                  <div style={{
                    position: 'absolute',
                    content: '""',
                    height: '16px',
                    width: '16px',
                    left: '2px',
                    bottom: '2px',
                    backgroundColor: 'white',
                    transition: '.4s',
                    borderRadius: '50%',
                    transform: useToll ? 'translateX(20px)' : 'translateX(0)'
                  }}></div>
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {useToll && (
          <>
            {nearestStartTollGate && (
              <div style={styles.card}>
                <div style={styles.statusLabel}>Gerbang Tol Masuk</div>
                <div>{nearestStartTollGate.name}</div>
                <div style={{fontSize: '12px', color: '#9ca3af', marginTop: '4px'}}>
                  Jarak: {typeof nearestStartTollGate.distance === 'number' && !isNaN(nearestStartTollGate.distance) ? nearestStartTollGate.distance.toFixed(1) : '-'} km
                </div>
              </div>
            )}
            {nearestEndTollGate && (
              <div style={styles.card}>
                <div style={styles.statusLabel}>Gerbang Tol Keluar</div>
                <div>{nearestEndTollGate.name}</div>
                <div style={{fontSize: '12px', color: '#9ca3af', marginTop: '4px'}}>
                  Jarak: {typeof nearestEndTollGate.distance === 'number' && !isNaN(nearestEndTollGate.distance) ? nearestEndTollGate.distance.toFixed(1) : '-'} km
                </div>
              </div>
            )}
            {(typeof estimatedTollCost === 'number' && !isNaN(estimatedTollCost)) ? (
              <div style={{...styles.card, backgroundColor: '#1d4ed8'}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <div style={styles.statusLabel}>Perkiraan Biaya Tol</div>
                  <button 
                    onClick={() => {
                      console.log('Manual refresh of toll cost');
                      if (startPoint && endPoint && nearestStartTollGate && nearestEndTollGate) {
                        // Force recalculation
                        calculateRouteInfo(startPoint, endPoint);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#93c5fd',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Refresh toll cost estimate"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div style={{fontSize: '18px', fontWeight: 'bold'}}>
                  Rp {estimatedTollCost.toLocaleString('id-ID')}
                </div>
                <div style={{fontSize: '12px', color: '#93c5fd', marginTop: '4px'}}>
                  Untuk kendaraan golongan: {vehicleClass}
                </div>
              </div>
            ) : (
              <div style={{...styles.card, backgroundColor: '#fbbf24', color: '#1f2937'}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <div style={{...styles.statusLabel, color: '#1f2937'}}>Perkiraan Biaya Tol</div>
                  <button 
                    onClick={() => {
                      console.log('Manual refresh of toll cost');
                      if (startPoint && endPoint) {
                        // Force recalculation
                        calculateRouteInfo(startPoint, endPoint);
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#1f2937',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Refresh toll cost calculation"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div style={{fontSize: '14px', fontWeight: 'bold'}}>
                  Biaya tol belum tersedia
                </div>
                <div style={{fontSize: '12px', marginTop: '4px'}}>
                  Klik refresh untuk mencoba lagi
                </div>
              </div>
            )}
            {!nearestStartTollGate && !nearestEndTollGate && (
              <div style={styles.card}>
                <div style={{textAlign: 'center', color: '#9ca3af'}}>
                  Tidak ada gerbang tol terdekat
                </div>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  const renderErrorBox = () => {
    if (!error) return null;
    
    return (
      <div style={{
        backgroundColor: error.includes('simulated') ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        padding: '12px',
        borderRadius: '12px',
        marginTop: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          fontWeight: 'bold',
          color: error.includes('simulated') ? '#93c5fd' : '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {error.includes('simulated') ? (
            <><RefreshCw size={14} /> Simulated Mode</>
          ) : (
            <><X size={14} /> Location Error</>
          )}
        </div>
        <div style={{
          color: error.includes('simulated') ? '#bfdbfe' : '#fca5a5',
          fontSize: '14px'
        }}>
          {error}
        </div>
      </div>
    );
  };

  const renderControls = () => (
    <div style={styles.controlsSection}>
      <div style={styles.inputGroup}>
        <input
          type="text"
          value={driverId}
          onChange={handleDriverIdChange}
          style={styles.input}
          placeholder="Enter driver ID"
        />
        
        {/* Vehicle class dropdown */}
        <div className="mb-4">
          <div style={{...styles.sectionTitle, marginTop: '12px', marginBottom: '12px', fontSize: '16px'}} htmlFor="vehicleClass">
            <MapPinned size={16} /> Golongan Kendaraan (Tol)
          </div>
          <select
            id="vehicleClass"
            value={vehicleClass}
            onChange={e => {
              setVehicleClass(e.target.value);
              // Refresh toll estimate if we already have a route
              if (startPoint && endPoint && nearestStartTollGate && nearestEndTollGate && useToll) {
                console.log('Vehicle class changed, recalculating toll cost');
                // Short delay to ensure state updates
                setTimeout(() => {
                  calculateRouteInfo(startPoint, endPoint);
                }, 100);
              }
            }}
            className="w-full px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          >
            <option value="gol1">Golongan 1 (Sedan/Jeep/Minibus/Pickup)</option>
            <option value="gol2">Golongan 2 (Truk dengan 2 sumbu)</option>
            <option value="gol3">Golongan 3 (Truk dengan 3 sumbu)</option>
            <option value="gol4">Golongan 4 (Truk dengan 4 sumbu)</option>
            <option value="gol5">Golongan 5 (Truk dengan 5 sumbu atau lebih)</option>
          </select>
        </div>
        
        {/* Route inputs */}
        <div style={{...styles.sectionTitle, marginTop: '12px', marginBottom: '12px', fontSize: '16px'}}>
          <MapPinned size={16} /> Rute Perjalanan
        </div>
        
        <div style={styles.inputGroup}>
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}>
            {isScriptLoaded ? (
              <PlacesAutocomplete
                placeholder="Lokasi Awal"
                value={startAddress}
                onChange={handleStartAddressChange}
                onSelect={handleStartLocationSelect}
                style={{...styles.input, marginBottom: '0', flex: 1}}
              />
            ) : (
              <input
                type="text"
                value={startAddress}
                onChange={handleStartAddressChange}
                style={{...styles.input, marginBottom: '0', flex: 1}}
                placeholder="Lokasi Awal (memuat...)"
                disabled
              />
            )}
            <button 
              onClick={setCurrentAsStart}
              style={{...styles.button, width: 'auto', padding: '8px', marginLeft: '8px'}}
              title="Gunakan lokasi saat ini"
            >
              <MapPin size={16} />
            </button>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}>
            {isScriptLoaded ? (
              <PlacesAutocomplete
                placeholder="Tujuan"
                value={endAddress}
                onChange={handleEndAddressChange}
                onSelect={handleEndLocationSelect}
                style={{...styles.input, marginBottom: '0', flex: 1}}
              />
            ) : (
              <input
                type="text"
                value={endAddress}
                onChange={handleEndAddressChange}
                style={{...styles.input, marginBottom: '0', flex: 1}}
                placeholder="Tujuan (memuat...)"
                disabled
              />
            )}
            <button 
              onClick={() => {
                if (!position) {
                  setError('Please start tracking to select endpoints on the map');
                  return;
                }
                // User needs to click on map
                setError('Click on the map to select your destination');
              }}
              style={{...styles.button, width: 'auto', padding: '8px', marginLeft: '8px'}}
              title="Pilih titik di peta"
            >
              <Target size={16} />
            </button>
          </div>
          
          {(startPoint && endPoint) && (
            <button 
              onClick={clearRoute}
              style={{...styles.button, backgroundColor: '#6b7280', marginTop: '8px', padding: '8px'}}
            >
              <span>Hapus Rute</span>
            </button>
          )}
        </div>
        
        <button 
          onClick={watchId === null ? startTracking : stopTracking} 
          style={{
            ...styles.button,
            ...(watchId === null ? {} : styles.buttonRed),
            ...(buttonHover ? (watchId === null ? styles.buttonHover : styles.buttonRedHover) : {}),
            marginTop: '12px'
          }}
          onMouseEnter={() => setButtonHover(true)}
          onMouseLeave={() => setButtonHover(false)}
        >
          {watchId === null ? (
            <><span>Start Tracking</span> <ArrowRight size={18} /></>
          ) : (
            <><span>Stop Tracking</span> <RefreshCw size={18} /></>
          )}
        </button>
      </div>
    </div>
  );

  const renderMap = () => (
    <div className="map-wrapper" style={styles.mapContainer}>
      <MapContainer 
        center={position || [-6.2088, 106.8456]} // Default to Jakarta if no position
        zoom={15} 
        style={{ height: "100%", width: "100%" }}
        whenReady={(map) => {
          mapRef.current = map.target;
          setTimeout(() => {
            mapRef.current.invalidateSize();
          }, 100);
        }}
      >
        <TileLayer
          attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Current position marker */}
        {position && (
          <Marker 
            position={position}
            icon={createCustomIcon('#2563eb')}
          >
            <Popup>
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#2563eb' }}>{driverId}</div>
                <div style={{ fontSize: '14px' }}>Speed: {(speed * 3.6).toFixed(1)} km/h</div>
                <div style={{ fontSize: '14px' }}>Heading: {heading ? heading.toFixed(0) + '°' : 'N/A'}</div>
                <div style={{ fontSize: '14px' }}>Last Update: {lastUpdate || 'Never'}</div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Start point marker */}
        {startPoint && (
          <Marker 
            position={startPoint}
            icon={createCustomIcon('#10b981')} // Green color
          >
            <Popup>
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#10b981' }}>Lokasi Awal</div>
                <div style={{ fontSize: '14px' }}>{startPoint[0].toFixed(6)}, {startPoint[1].toFixed(6)}</div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* End point marker */}
        {endPoint && (
          <Marker 
            position={endPoint}
            icon={createCustomIcon('#ef4444')} // Red color
          >
            <Popup>
              <div style={{ textAlign: 'center', padding: '4px' }}>
                <div style={{ fontWeight: 'bold', color: '#ef4444' }}>Tujuan</div>
                <div style={{ fontSize: '14px' }}>{endPoint[0].toFixed(6)}, {endPoint[1].toFixed(6)}</div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Route line */}
        {startPoint && endPoint && (
          <RouteLine startPoint={startPoint} endPoint={endPoint} />
        )}
        
        {position && <MapController position={position} />}
      </MapContainer>
      
      <ChatComponent 
        socket={socket} 
        driverId={driverId} 
        connected={connected} 
      />
    </div>
  );

  // Main render
  return (
    <LoadScript
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      libraries={MAPS_LIBRARIES}
      onLoad={() => setIsScriptLoaded(true)}
    >
      <div style={styles.container}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          {renderHeader()}
          
          {/* Main Content */}
          <div style={{...styles.content, ...styles.scrollbar}} className="custom-scrollbar">
            {renderDriverInfo()}
            {renderStatusDetails()}
            {renderRouteInfo()}
            {renderTollInfo()}
            {renderErrorBox()}
          </div>
          
          {/* Controls */}
          {renderControls()}
        </div>
        
        {/* Map Container */}
        {renderMap()}
      </div>
    </LoadScript>
  );
}

export default App;