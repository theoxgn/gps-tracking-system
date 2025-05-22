import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { LoadScript } from '@react-google-maps/api';
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
import { calculateDistance } from './utils/mapUtils';
import MapView from './components/MapView';
import TruckSpecifications from './components/TruckSpecifications';
import { getGraphhopperRoute } from './services/graphhopperRouteService';

// Constants
const SERVER_URL = process.env.REACT_APP_API_URL;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAPS_LIBRARIES = ['places'];

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
  const [transportMode, setTransportMode] = useState('driving-car');
  
  // State untuk UI
  const [buttonHover, setButtonHover] = useState(false);
  
  // Refs to track previous values and prevent unnecessary recalculations
  const prevRouteRef = useRef({
    startPoint: null,
    endPoint: null,
    transportMode: null,
    preferTollRoads: true // Initialize with default
  });
  
  // Ref to track if route calculation is in progress
  const isCalculatingRoute = useRef(false);
  
  // Ref for tracking map initialization
  const mapInitialized = useRef(false);

  const [truckSpecs, setTruckSpecs] = useState({
    height: 4.2,  // meter
    weight: 16,   // ton
    width: 2.5,   // meter
    length: 12,   // meter
    axles: 2      // jumlah sumbu
  });
  const [preferTollRoads, setPreferTollRoads] = useState(true);

  /**
   * Initialize socket connection
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]); 

  /**
   * Update driver ID when it changes
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
   * Force map resize when component mounts
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
   * Add required CSS for map display
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
   * Calculate route information (distance, duration only)
   */
  const calculateRouteInfo = async (start, end) => {
    // Prevent concurrent calculations and check if inputs are valid
    if (isCalculatingRoute.current || !start || !end) {
      return;
    }
    
    console.log('Calculating route info between:', start, 'and', end, 'with toll preference:', preferTollRoads);
    
    // Skip recalculation if inputs haven't changed
    const inputsChanged = 
      !prevRouteRef.current.startPoint || 
      !prevRouteRef.current.endPoint ||
      prevRouteRef.current.startPoint[0] !== start[0] ||
      prevRouteRef.current.startPoint[1] !== start[1] ||
      prevRouteRef.current.endPoint[0] !== end[0] ||
      prevRouteRef.current.endPoint[1] !== end[1] ||
      prevRouteRef.current.transportMode !== transportMode ||
      prevRouteRef.current.preferTollRoads !== preferTollRoads;
      
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
      preferTollRoads
    };
    
    try {
      // Untuk mode truk, gunakan GraphHopper secara langsung
      if (transportMode === 'driving-hgv') {
        console.log('Using GraphHopper for truck routing calculation');
        
        try {
          // Gunakan service GraphHopper
          const routeData = await getGraphhopperRoute(start, end, transportMode, truckSpecs, preferTollRoads);
          
          // Update state rute
          setRouteDistance(routeData.distance);
          setRouteDuration(routeData.duration);
          setRouteInstructions(routeData.instructions || []);
          
          // Kirim data rute ke server
          sendRouteToServer({
            ...routeData,
            // Pastikan format data sesuai dengan yang diharapkan server
            vehicleSpecs: truckSpecs,
            preferTollRoads: preferTollRoads
          });
          
          return;
        } catch (error) {
          console.error('GraphHopper routing failed, falling back to OSRM:', error);
          // Lanjutkan dengan perhitungan OSRM sebagai fallback
        }
      }
      
      // Untuk mode transportasi lainnya, atau jika GraphHopper gagal
      // Basic route calculations
      const distance = calculateDistance(start, end);
      const avgSpeedKmh = transportMode === 'driving-hgv' ? 40 : 50; // Slower for trucks
      let durationMinutes = Math.round((distance / avgSpeedKmh) * 60);
      
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
      
      const routeData = {
        distance: distance,
        duration: durationMinutes,
        instructions: instructions,
        routeGeometry: [start, end], // Simple straight line for now
        vehicleSpecs: transportMode === 'driving-hgv' ? truckSpecs : null,
        preferTollRoads: preferTollRoads
      };
      
      // Update route state in a single batch
      setRouteDistance(distance);
      setRouteDuration(durationMinutes);
      setRouteInstructions(instructions);
      sendRouteToServer(routeData);
    } catch (error) {
      console.error('Error calculating route info:', error);
      
      // Minimal fallback on error
      const distance = calculateDistance(start, end);
      setRouteDistance(distance);
      
      const avgSpeedKmh = transportMode === 'driving-hgv' ? 40 : 50; // Slower for trucks
      const durationMinutes = Math.round((distance / avgSpeedKmh) * 60);
      setRouteDuration(durationMinutes);
      
      // Reset other state to avoid stale data
      setRouteInstructions([]);
    } finally {
      // Always reset calculation flag when done
      isCalculatingRoute.current = false;
    }
  };

  /**
   * Handle toll preference toggle changes
   */
  const handleTollPreferenceChange = () => {
    // Update the preference state
    const newPreference = !preferTollRoads;
    setPreferTollRoads(newPreference);
    
    // Force a complete route recalculation if we have both points
    if (startPoint && endPoint) {
      // Notify the server about the preference change
      if (socket && connected) {
        socket.emit('routePreferenceChanged', {
          deviceID: driverId,
          preferTollRoads: newPreference
        });
      }
      
      // Clear any cached route data in the map component
      // We do this indirectly by sending a special event through the socket
      if (socket && connected) {
        socket.emit('clearCachedRoutes', {
          deviceID: driverId
        });
      }
      
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        console.log("Recalculating route with new toll preference:", newPreference);
        
        // Calculate with updated preference
        calculateRouteInfo(startPoint, endPoint);
        
        // Also manually update the MapView component's props to force rerender
        if (mapRef.current) {
          try {
            // This helps trigger a fresh render in the map component
            mapRef.current.invalidateSize();
          } catch (err) {
            console.log("Error invalidating map size:", err);
          }
        }
      }, 50);
    }
    
    // Update the UI to provide visual feedback immediately
    console.log(`Toll preference changed to: ${newPreference ? 'Use toll roads' : 'Avoid toll roads'}`);
  };

  /**
   * Handle route calculation completed
   * Prevents unnecessary state updates
   */
  const handleRouteCalculated = (routeData) => {
    if (!routeData) return;
    
    // Store previous values to check if they've actually changed
    const prevDistance = routeDistance;
    const prevDuration = routeDuration;
    
    // Only update if values are different to avoid needless re-renders
    if (routeData.distance !== prevDistance) {
      setRouteDistance(routeData.distance);
    }
    
    if (routeData.duration !== prevDuration) {
      setRouteDuration(routeData.duration);
    }
    
    // Update instructions
    if (routeData.instructions && 
        (!routeInstructions || 
         routeInstructions.length !== routeData.instructions.length)) {
      setRouteInstructions(routeData.instructions);
    }
    
    // Send the route information to the server
    sendRouteToServer(routeData);
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
    setRouteInstructions([]);
    
    // Reset route calculation state
    prevRouteRef.current = {
      startPoint: null,
      endPoint: null,
      transportMode: transportMode,
      preferTollRoads: preferTollRoads
    };
  };

  /**
   * Send route information to the server
   */
  const sendRouteToServer = (routeData) => {
    if (!socket || !connected) {
      console.log('Cannot send route: socket not connected');
      return;
    }
    
    if (!startPoint || !endPoint) {
      console.log('Cannot send route: missing start or end points');
      return;
    }
    
    // Validate route geometry
    let routeGeometry = routeData?.routeGeometry;
    if (!routeGeometry || !Array.isArray(routeGeometry) || routeGeometry.length < 2) {
      console.log('Creating simple route geometry from start and end points');
      routeGeometry = [startPoint, endPoint];
    }
    
    console.log('Sending route information to server:', {
      driverId,
      startPoint,
      endPoint,
      pointsCount: routeGeometry.length,
      transportMode, // Include transport mode
      preferTollRoads // Include toll preference
    });
    
    // Prepare route data
    const routeDataToSend = {
      deviceID: driverId,
      startPoint: startPoint,
      endPoint: endPoint,
      routeGeometry: routeGeometry,
      transportMode: transportMode, // Include transport mode
      distance: routeData?.distance || routeDistance,
      duration: routeData?.duration || routeDuration,
      timestamp: Date.now(),
      preferTollRoads: preferTollRoads,
      // Include truck specs if mode is truck
      ...(transportMode === 'driving-hgv' ? { vehicleSpecs: truckSpecs } : {})
    };
    
    // Send to server
    socket.emit('driverRoute', routeDataToSend);
    
    // Add event listener for server acknowledgement if not already listening
    if (!socket._hasRouteAckListener) {
      socket.on('routeAck', (ack) => {
        console.log('Route acknowledgement received:', ack);
      });
      socket._hasRouteAckListener = true;
    }
  };


  // Render helper components
  // const renderHeader = () => (
  //   <div style={styles.header}>
  //     <div style={styles.headerTitle}>
  //       <Truck style={styles.headerIcon} size={24} />
  //       Driver Tracker
  //     </div>
  //     <div style={styles.statusBadge}>
  //       <div>
  //         {connected ? 
  //           <><Wifi size={14} style={{ color: '#4ade80', marginRight: '4px' }} /> Connected</> : 
  //           <><WifiOff size={14} style={{ color: '#f87171', marginRight: '4px' }} /> Disconnected</>
  //         }
  //       </div>
  //       <div style={watchId !== null ? styles.statusBadgeActive : styles.statusBadgeInactive}>
  //         <Activity size={14} style={watchId !== null ? styles.statusDotActive : styles.statusDotInactive} />
  //         <span style={{ marginLeft: '4px' }}>{watchId !== null ? 'Active' : 'Idle'}</span>
  //       </div>
  //     </div>
  //   </div>
  // );

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

  const renderRouteInfo = () => {
    if (!startPoint || !endPoint) return null;

    const renderTollRoadPreference = () => {
      if (!startPoint || !endPoint) return null;
      
      return (
        <div style={styles.card}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={styles.statusLabel}>
              <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                Prioritaskan Jalan Tol
              </div>
            </div>
            <div>
              <label className="switch" style={{
                position: 'relative',
                display: 'inline-block',
                width: '40px',
                height: '20px'
              }}>
                <input 
                  type="checkbox" 
                  checked={preferTollRoads}
                  onChange={handleTollPreferenceChange}
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
                  backgroundColor: preferTollRoads ? '#3b82f6' : '#94a3b8',
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
                    transform: preferTollRoads ? 'translateX(20px)' : 'translateX(0)'
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
                    transform: preferTollRoads ? 'translateX(20px)' : 'translateX(0)'
                  }}></div>
                </span>
              </label>
            </div>
          </div>
        </div>
      );
    };
    
    
    return (
      <>
        <div style={{...styles.sectionTitle, marginTop: '12px'}}>
          <MapPinned size={16} /> Informasi Rute
        </div>

        {renderTollRoadPreference()}
        
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
        
        {/* Informasi Khusus Truk - Hanya ditampilkan jika mode = truck */}
        {transportMode === 'driving-hgv' && (
          <div style={{...styles.card, backgroundColor: '#fdba74', color: '#7c2d12'}}>
            <div style={{fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Info Mode Truk
            </div>
            <div style={{fontSize: '14px', lineHeight: '1.4'}}>
              <p>OSRM Public API tidak memiliki profil khusus untuk truk. Rute yang ditampilkan menggunakan profil mobil dengan penyesuaian waktu tempuh.</p>
              <p style={{marginTop: '8px'}}>Perhatikan batasan tinggi, berat, dan lebar jalan yang mungkin tidak terdeteksi. Perkiraan waktu sudah disesuaikan untuk kecepatan truk.</p>
            </div>
          </div>
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
        
        {/* Tambahkan komponen spesifikasi truk jika mode transportasi adalah truk */}
        {transportMode === 'driving-hgv' && (
          <TruckSpecifications 
            truckSpecs={truckSpecs}
            onUpdate={setTruckSpecs}
            style={{marginTop: '12px'}}
          />
        )}
        
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
        truckSpecs={transportMode === 'driving-hgv' ? truckSpecs : null} // Teruskan truck specs
        preferTollRoads={preferTollRoads}
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#f8fafc'
      }}>
        {/* Header Navigation */}
        <div style={{
          backgroundColor: '#ffffff',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#1e293b'
            }}>
              <Truck size={22} style={{ color: '#3b82f6' }} />
              TrackMaster
            </div>
            
            <div style={{
              display: 'flex',
              gap: '16px'
            }}>
              <div style={{
                padding: '6px 12px',
                borderRadius: '4px',
                backgroundColor: '#f1f5f9',
                fontSize: '14px',
                fontWeight: '500',
                color: '#3b82f6'
              }}>
                Driver App
              </div>
              <div style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                color: '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                ':hover': { backgroundColor: '#f1f5f9' }
              }}>
                Monitoring App
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content Area */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* Sidebar */}
          <div style={{
            width: '280px',
            backgroundColor: '#ffffff',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            
            {/* Sidebar Content */}
            <div style={{...styles.content, ...styles.scrollbar}} className="custom-scrollbar">
              {renderDriverInfo()}
              {/* {renderStatusDetails()} */}
              {renderRouteInfo()}
              {renderErrorBox()}
            </div>
            
            {/* Controls */}
            {renderControls()}
          </div>
          
          {/* Main Content */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Map Container */}
            {renderMap()}
            
            {/* Bottom Info Panels */}
            <div style={{
              display: 'flex',
              padding: '16px',
              gap: '16px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0'
            }}>
              {/* Status Details */}
              <div style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Activity size={18} />
                  Status Sistem
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#475569'
                }}>
                  {/* Status GPS */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Target size={16} color={watchId !== null ? '#10b981' : '#f87171'} />
                    <span>Status GPS: </span>
                    <span style={{ 
                      color: watchId !== null ? '#10b981' : '#f87171',
                      fontWeight: '500'
                    }}>
                      {watchId !== null ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                    {error && (
                      <span style={{ color: '#f87171', fontSize: '12px', marginLeft: '4px' }}>
                        ({error})
                      </span>
                    )}
                  </div>
                  
                  {/* Status Koneksi */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {connected ? 
                      <Wifi size={16} color="#10b981" /> : 
                      <WifiOff size={16} color="#f87171" />
                    }
                    <span>Status Koneksi: </span>
                    <span style={{ 
                      color: connected ? '#10b981' : '#f87171',
                      fontWeight: '500'
                    }}>
                      {connected ? 'Terhubung' : 'Terputus'}
                    </span>
                  </div>
                  
                  {/* Informasi Posisi */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <MapPin size={16} color="#3b82f6" />
                    <span>Posisi: </span>
                    <span style={{ fontWeight: '500' }}>
                      {position ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'Tidak tersedia'}
                    </span>
                  </div>
                  
                  {/* Informasi Kecepatan */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Navigation size={16} color="#3b82f6" />
                    <span>Kecepatan: </span>
                    <span style={{ fontWeight: '500' }}>
                      {speed ? `${(speed * 3.6).toFixed(1)} km/h` : '0 km/h'}
                    </span>
                  </div>
                  
                  {/* Waktu Update Terakhir */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Clock size={16} color="#3b82f6" />
                    <span>Update Terakhir: </span>
                    <span style={{ fontWeight: '500' }}>
                      {lastUpdate || 'Belum ada update'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Informasi Kendaraan & Rute */}
              <div style={{
                flex: 1,
                padding: '16px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Truck size={18} />
                  Informasi Kendaraan & Rute
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#475569'
                }}>
                  {/* Jenis Kendaraan */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Truck size={16} color="#3b82f6" />
                    <span>Jenis Kendaraan: </span>
                    <span style={{ fontWeight: '500' }}>
                      {transportMode === 'driving-hgv' ? 'Truk Barang' : 'Kendaraan Standar'}
                    </span>
                  </div>
                  
                  {/* Informasi Rute */}
                  {(startPoint && endPoint) ? (
                    <>
                      {/* Jarak Tempuh */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <MapPinned size={16} color="#3b82f6" />
                        <span>Jarak Tempuh: </span>
                        <span style={{ fontWeight: '500' }}>
                          {routeDistance ? `${routeDistance.toFixed(1)} km` : 'Menghitung...'}
                        </span>
                      </div>
                      
                      {/* Estimasi Waktu */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <Clock size={16} color="#3b82f6" />
                        <span>Estimasi Waktu: </span>
                        <span style={{ fontWeight: '500' }}>
                          {routeDuration ? `${Math.floor(routeDuration / 60)} jam ${routeDuration % 60} menit` : 'Menghitung...'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                      Belum ada rute yang dipilih
                    </div>
                  )}
                  
                  {/* Preferensi Jalan Tol */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                    padding: '8px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px'
                  }}>
                    <input 
                      type="checkbox" 
                      id="toll-preference"
                      checked={preferTollRoads}
                      onChange={handleTollPreferenceChange}
                      style={{ accentColor: '#3b82f6' }}
                    />
                    <label htmlFor="toll-preference" style={{ fontWeight: '500' }}>
                      Gunakan Jalan Tol
                    </label>
                  </div>
                  
                  {/* Spesifikasi Truk (jika mode transportasi adalah truk) */}
                  {transportMode === 'driving-hgv' && (
                    <div style={{
                      marginTop: '4px',
                      padding: '8px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}>
                      <div style={{ fontWeight: '500', marginBottom: '4px' }}>Spesifikasi Truk:</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tinggi: {truckSpecs.height} m</span>
                        <span>Berat: {truckSpecs.weight} ton</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Panjang: {truckSpecs.length} m</span>
                        <span>Lebar: {truckSpecs.width} m</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LoadScript>
  );
}

export default App;