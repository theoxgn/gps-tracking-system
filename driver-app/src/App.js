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
import { MapController } from './components/MapComponents';
import DetailedRouteMap from './components/DetailedRouteMap';
import MapView from './components/MapView';

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
  
  // State untuk rute detail
  const [routeInstructions, setRouteInstructions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [transportMode, setTransportMode] = useState('driving-car');
  const [showRouteInstructions, setShowRouteInstructions] = useState(false);
  
  // Toll and vehicle state
  const [vehicleClass, setVehicleClass] = useState('gol1'); // default golongan tol
  const [nearestStartTollGate, setNearestStartTollGate] = useState(null);
  const [nearestEndTollGate, setNearestEndTollGate] = useState(null);
  const [estimatedTollCost, setEstimatedTollCost] = useState(null);
  const [useToll, setUseToll] = useState(true);
  const [tollGates, setTollGates] = useState([]);
  const [buttonHover, setButtonHover] = useState(false);
  
  // Refs to track previous values and prevent unnecessary recalculations
  const prevRouteRef = useRef({
    startPoint: null,
    endPoint: null,
    transportMode: null,
    useToll: true,
    vehicleClass: 'gol1'
  });
  
  // Ref to track if route calculation is in progress
  const isCalculatingRoute = useRef(false);
  
  // Ref for tracking map initialization
  const mapInitialized = useRef(false);
  
  // Ref for tracking if toll data has been fetched
  const tollDataFetched = useRef(false);

  /**
   * Initialize socket connection - FIXED
   * Only create socket once and handle reconnections properly
   */
  useEffect(() => {
    // If socket already exists, don't create another one
    if (socket) return;
    
    console.log('Initializing socket connection to:', SERVER_URL);
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
      console.log('Cleaning up socket connection');
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []); // Empty dependency array to run only once on mount

  /**
   * Update driver ID when it changes - FIXED
   * Separate effect that only runs when driverId changes
   */
  useEffect(() => {
    if (socket && connected) {
      console.log('Re-identifying with new driver ID:', driverId);
      socket.emit('identify', {
        type: 'driver',
        driverId: driverId
      });
    }
  }, [driverId, connected, socket]);

  /**
   * Force map resize when component mounts - FIXED
   * Uses ref to prevent multiple executions
   */
  useEffect(() => {
    if (!mapInitialized.current) {
      const timer = setTimeout(() => {
        if (mapRef.current) {
          console.log('Invalidating map size');
          mapRef.current.invalidateSize();
          mapInitialized.current = true;
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array to run only once

  /**
   * Add required CSS for map display - FIXED
   * Only runs once on mount
   */
  useEffect(() => {
    const styleId = 'leaflet-custom-styles';
    
    // Only add style element if it doesn't already exist
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
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
        if (document.getElementById(styleId)) {
          document.head.removeChild(document.getElementById(styleId));
        }
      };
    }
  }, []); // Empty dependency array to run only once

  /**
   * Fetch toll gates data from API - FIXED
   * Added flag to prevent multiple fetches
   */
  useEffect(() => {
    const fetchTollGates = async () => {
      // Only fetch once
      if (tollDataFetched.current) return;
      
      try {
        console.log('Fetching toll gates data...');
        tollDataFetched.current = true;
        
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
        // Reset fetched flag on complete failure to allow retry
        tollDataFetched.current = false;
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
   * FIXED: Added memoization to prevent duplicate API calls
   */
  const estimateTollCost = async (startGate, endGate, vehicleClass) => {
    if (!startGate || !endGate) return null;
    
    // Check if gates are the same (no toll fee)
    if (startGate.name === endGate.name) return 0;
    
    // Create a cache key for this specific request
    const cacheKey = `${startGate.name}-${endGate.name}-${vehicleClass}`;
    
    // Initialize toll cost cache if it doesn't exist
    if (!window.tollCostCache) {
      window.tollCostCache = {};
    }
    
    // Check if we have a cached result
    const cachedCost = window.tollCostCache[cacheKey];
    if (cachedCost !== undefined) {
      console.log('Using cached toll cost for', cacheKey, ':', cachedCost);
      return cachedCost;
    }
    
    try {
      // Call the API to get the toll cost
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/calculate-toll`, {
        params: {
          startGate: startGate.name,
          endGate: endGate.name,
          vehicleType: vehicleClass
        },
        headers: {
          'x-api-key': process.env.REACT_APP_API_KEY || '',
          'Content-Type': 'application/json'
        }
      });
      
      let tollCost = null;
      if (response.data && typeof response.data.cost === 'number') {
        tollCost = response.data.cost;
        // Cache the result for future use
        window.tollCostCache[cacheKey] = tollCost;
      }
      
      return tollCost;
    } catch (error) {
      console.error('Failed to calculate toll cost:', error);
      return null;
    }
  };

  /**
   * Calculate route information (distance, duration, toll)
   * FIXED: Completely restructured to avoid infinite loops
   */
  const calculateRouteInfo = async (start, end) => {
    // Prevent concurrent calculations and check if inputs are valid
    if (isCalculatingRoute.current || !start || !end) {
      return;
    }
    
    console.log('Calculating route info between:', start, 'and', end);
    
    // Skip recalculation if inputs haven't changed
    const inputsChanged = 
      !prevRouteRef.current.startPoint || 
      !prevRouteRef.current.endPoint ||
      prevRouteRef.current.startPoint[0] !== start[0] ||
      prevRouteRef.current.startPoint[1] !== start[1] ||
      prevRouteRef.current.endPoint[0] !== end[0] ||
      prevRouteRef.current.endPoint[1] !== end[1] ||
      prevRouteRef.current.transportMode !== transportMode ||
      prevRouteRef.current.useToll !== useToll ||
      prevRouteRef.current.vehicleClass !== vehicleClass;
      
    if (!inputsChanged) {
      console.log('Skipping route calculation - inputs unchanged');
      return;
    }
    
    // Set calculation flag to prevent concurrent calculations
    isCalculatingRoute.current = true;
    
    // Update prev values
    prevRouteRef.current = {
      startPoint: [...start],
      endPoint: [...end],
      transportMode,
      useToll,
      vehicleClass
    };
    
    try {
      // Basic route calculations
      const distance = calculateDistance(start, end);
      const avgSpeedKmh = 50;
      const durationMinutes = Math.round((distance / avgSpeedKmh) * 60);
      
      // Generate basic instructions
      const instructions = [
        {
          instruction: `Mulai perjalanan dari titik awal`,
          distance: 0,
          type: 'depart',
          modifier: 'straight'
        },
        {
          instruction: `Arah menuju tujuan`,
          distance: distance * 1000, // Konversi ke meter
          type: 'continue',
          modifier: 'straight'
        },
        {
          instruction: `Sampai di tujuan`,
          distance: 0,
          type: 'arrive',
          modifier: 'straight'
        }
      ];
      
      // Update route state in a single batch
      setRouteDistance(distance);
      setRouteDuration(durationMinutes);
      setRouteInstructions(instructions);
      setShowRouteInstructions(true);
      
      // Calculate toll information if necessary
      let startTollGate = null;
      let endTollGate = null;
      let tollCost = null;
      
      if (useToll) {
        console.log('Finding nearest toll gates...');
        startTollGate = findNearestTollGate(start);
        endTollGate = findNearestTollGate(end);
        
        if (startTollGate && endTollGate) {
          console.log('Calculating toll cost...');
          tollCost = await estimateTollCost(startTollGate, endTollGate, vehicleClass);
        }
      }
      
      // Update toll state in a separate batch to avoid cascading updates
      setNearestStartTollGate(startTollGate);
      setNearestEndTollGate(endTollGate);
      setEstimatedTollCost(tollCost);
      
    } catch (error) {
      console.error('Error calculating route info:', error);
      
      // Minimal fallback on error
      const distance = calculateDistance(start, end);
      setRouteDistance(distance);
      
      const avgSpeedKmh = 50;
      const durationMinutes = Math.round((distance / avgSpeedKmh) * 60);
      setRouteDuration(durationMinutes);
      
      // Reset other state to avoid stale data
      setRouteInstructions([]);
      setShowRouteInstructions(false);
      setNearestStartTollGate(null);
      setNearestEndTollGate(null);
      setEstimatedTollCost(null);
    } finally {
      // Always reset calculation flag when done
      isCalculatingRoute.current = false;
    }
  };

  /**
   * Handle route calculation completed - FIXED
   * Prevents unnecessary state updates
   */
  const handleRouteCalculated = (routeData) => {
    if (!routeData) return;
    
    // Track if any updates are needed
    let needsUpdate = false;
    
    // Store previous values to check if they've actually changed
    const prevDistance = routeDistance;
    const prevDuration = routeDuration;
    
    // Only update if values are different to avoid needless re-renders
    if (routeData.distance !== prevDistance) {
      setRouteDistance(routeData.distance);
      needsUpdate = true;
    }
    
    if (routeData.duration !== prevDuration) {
      setRouteDuration(routeData.duration);
      needsUpdate = true;
    }
    
    // For instructions, we need to check if they're significantly different
    // A simple approach is to check the array length
    if (routeData.instructions && 
        (!routeInstructions || 
         routeInstructions.length !== routeData.instructions.length)) {
      setRouteInstructions(routeData.instructions);
      
      // Only set this to true if we actually have instructions
      if (routeData.instructions.length > 0) {
        setShowRouteInstructions(true);
      }
      
      needsUpdate = true;
    }
    
    // If any updates were made, recalculate toll information
    if (needsUpdate && useToll && startPoint && endPoint) {
      // We need to recalculate toll information, but we should
      // avoid an immediate call to avoid cascading updates.
      // Instead, schedule it for the next tick
      setTimeout(() => {
        const startTollGate = findNearestTollGate(startPoint);
        const endTollGate = findNearestTollGate(endPoint);
        
        setNearestStartTollGate(startTollGate);
        setNearestEndTollGate(endTollGate);
        
        if (startTollGate && endTollGate) {
          estimateTollCost(startTollGate, endTollGate, vehicleClass)
            .then(cost => {
              setEstimatedTollCost(cost);
            })
            .catch(err => {
              console.error('Error estimating toll cost:', err);
              setEstimatedTollCost(null);
            });
        } else {
          setEstimatedTollCost(null);
        }
      }, 0);
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
      // Schedule calculation for next tick to avoid
      // state update issues during render
      setTimeout(() => {
        calculateRouteInfo(location.position, endPoint);
      }, 0);
    }
  };
  
  const handleEndLocationSelect = (location) => {
    setEndAddress(location.address);
    setEndPoint(location.position);
    
    // Calculate route info when both points are set
    if (startPoint) {
      // Schedule calculation for next tick to avoid
      // state update issues during render
      setTimeout(() => {
        calculateRouteInfo(startPoint, location.position);
      }, 0);
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
      // Schedule calculation for next tick to avoid
      // state update issues during render
      setTimeout(() => {
        calculateRouteInfo(position, endPoint);
      }, 0);
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
    setRouteInstructions([]);
    setShowRouteInstructions(false);
    
    // Reset route calculation state
    prevRouteRef.current = {
      startPoint: null,
      endPoint: null,
      transportMode: transportMode,
      useToll: useToll,
      vehicleClass: vehicleClass
    };
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
        
        {/* Mode Transportasi */}
        <div style={styles.card}>
          <div style={styles.statusLabel}>Mode Transportasi</div>
          <select
            value={transportMode}
            onChange={(e) => {
              const newMode = e.target.value;
              setTransportMode(newMode);
              
              // Only recalculate if we have both points
              if (startPoint && endPoint) {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                  // Update reference first
                  prevRouteRef.current.transportMode = newMode;
                  // Then recalculate
                  calculateRouteInfo(startPoint, endPoint);
                }, 0);
              }
            }}
            style={{
              width: '100%',
              padding: '6px',
              marginTop: '4px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0'
            }}
          >
            <option value="driving-car">Mobil</option>
            <option value="driving-hgv">Truk</option>
            <option value="cycling-regular">Sepeda</option>
            <option value="foot-walking">Jalan Kaki</option>
          </select>
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
                      // Use setTimeout to avoid state update during render
                      setTimeout(() => {
                        // Update reference first
                        prevRouteRef.current.useToll = newUseToll;
                        // Then recalculate
                        calculateRouteInfo(startPoint, endPoint);
                      }, 0);
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
                        // Force estimation without triggering full recalculation
                        estimateTollCost(nearestStartTollGate, nearestEndTollGate, vehicleClass)
                          .then(cost => {
                            setEstimatedTollCost(cost);
                          })
                          .catch(err => {
                            console.error('Error estimating toll cost:', err);
                          });
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
                        setTimeout(() => {
                          calculateRouteInfo(startPoint, endPoint);
                        }, 0);
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
              const newVehicleClass = e.target.value;
              setVehicleClass(newVehicleClass);
              
              // Refresh toll estimate if we already have a route
              if (startPoint && endPoint && nearestStartTollGate && nearestEndTollGate && useToll) {
                console.log('Vehicle class changed, recalculating toll cost');
                
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                  // Update reference first
                  prevRouteRef.current.vehicleClass = newVehicleClass;
                  
                  // Just update toll cost without full recalculation
                  estimateTollCost(nearestStartTollGate, nearestEndTollGate, newVehicleClass)
                    .then(cost => {
                      setEstimatedTollCost(cost);
                    })
                    .catch(err => {
                      console.error('Error estimating toll cost:', err);
                      setEstimatedTollCost(null);
                    });
                }, 0);
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
      <MapView
        position={position}
        driverId={driverId}
        lastUpdate={lastUpdate}
        speed={speed}
        heading={heading}
        startPoint={startPoint}
        endPoint={endPoint}
        transportMode={transportMode}
        onRouteCalculated={handleRouteCalculated}
      />
      
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