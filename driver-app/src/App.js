import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { 
  Truck, 
  Navigation, 
  Wifi, 
  WifiOff,
  MapPin,
  Activity,
  Clock,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
});

// Custom marker with color
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [25, 25],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

// Tambahkan CSS inline untuk styling
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden'
  },
  sidebar: {
    width: '320px',
    backgroundColor: '#111827', // bg-gray-900
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    borderRight: '1px solid #1f2937',
    borderTopRightRadius: '24px',
    borderBottomRightRadius: '24px',
    overflow: 'hidden'
  },
  header: {
    background: 'linear-gradient(to right, #1d4ed8, #1e40af)', // from-blue-700 to-blue-900
    padding: '24px',
    borderBottomLeftRadius: '0px',
    borderBottomRightRadius: '24px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    borderBottom: '2px solid #1e40af',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: '800',
    letterSpacing: '-0.025em',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '8px'
  },
  headerIcon: {
    color: '#93c5fd' // text-blue-300
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#d1d5db' // text-gray-300
  },
  content: {
    flex: '1',
    padding: '20px',
    backgroundColor: '#1f2937', // bg-gray-800
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#bfdbfe', // text-blue-200
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #1d4ed8', // border-blue-700
    paddingBottom: '8px'
  },
  card: {
    padding: '16px',
    backgroundColor: '#374151', // bg-gray-700
    borderRadius: '12px',
    marginBottom: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: '2px solid transparent'
  },
  cardActive: {
    backgroundColor: '#1d4ed8', // bg-blue-700
    borderColor: '#60a5fa', // border-blue-400
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    transform: 'scale(1.05)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  cardTime: {
    fontSize: '12px',
    color: '#d1d5db', // text-gray-300
    display: 'flex', 
    alignItems: 'center',
    gap: '4px'
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginTop: '8px',
    fontSize: '12px',
    color: '#e5e7eb' // text-gray-200
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  infoIcon: {
    color: '#93c5fd' // text-blue-300
  },
  controlsSection: {
    padding: '20px',
    background: 'linear-gradient(to right, #1e40af, #1e3a8a)', // from-blue-800 to-blue-900
    borderTop: '1px solid #1d4ed8', // border-blue-700
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  inputGroup: {
    marginBottom: '12px'
  },
  input: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#374151', // bg-gray-700
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    marginBottom: '12px',
    fontSize: '14px'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px',
    backgroundColor: '#3b82f6', // bg-blue-500
    color: 'white',
    fontWeight: '600',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    gap: '8px',
    fontSize: '16px'
  },
  buttonRed: {
    backgroundColor: '#ef4444' // bg-red-500
  },
  buttonHover: {
    backgroundColor: '#2563eb' // bg-blue-600
  },
  buttonRedHover: {
    backgroundColor: '#dc2626' // bg-red-600
  },
  mapContainer: {
    flex: '1',
    position: 'relative'
  },
  statusInfo: {
    marginTop: '12px',
    marginBottom: '16px'
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // bg-red-500 with opacity
    padding: '12px',
    borderRadius: '12px',
    marginBottom: '16px'
  },
  errorTitle: {
    fontWeight: 'bold',
    color: '#fca5a5' // text-red-300
  },
  errorText: {
    color: '#fca5a5', // text-red-300
    fontSize: '14px'
  },
  statusBadgeActive: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: '6px 10px',
    borderRadius: '9999px',
    fontSize: '12px'
  },
  statusBadgeInactive: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    padding: '6px 10px',
    borderRadius: '9999px',
    fontSize: '12px'
  },
  statusDotActive: {
    color: '#10b981'
  },
  statusDotInactive: {
    color: '#6b7280'
  },
  statusDetail: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    fontSize: '14px'
  },
  statusLabel: {
    color: '#93c5fd',
    marginBottom: '4px'
  },
  scrollbar: {
    scrollbarWidth: 'thin',
    scrollbarColor: '#4b5563 #1f2937'
  }
};

const SERVER_URL = 'http://localhost:4001';

// Component to update map view when position changes
function MapController({ position }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
      
      // Force map redraw
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    }
  }, [position, map]);
  
  return null;
}

function App() {
  const [position, setPosition] = useState([-7.2575, 112.7521]); // Default position (Sidoarjo, East Java)
  const [connected, setConnected] = useState(false);
  const [driverId, setDriverId] = useState('Driver-' + Math.floor(Math.random() * 1000));
  const [socket, setSocket] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [watchId, setWatchId] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const mapRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(SERVER_URL);
    
    socketInstance.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });
    
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

  // Force map resize when component mounts
  useEffect(() => {
    // Small delay to ensure the map container is fully rendered
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        console.log("Map size invalidated");
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Add required CSS directly in a useEffect for proper map display
  useEffect(() => {
    // Add explicit Leaflet styles to ensure the map displays properly
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
        width: 6px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: #1f2937;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #4b5563;
        border-radius: 20px;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Request location access and start tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentPosition = [latitude, longitude];
        console.log('Got position:', currentPosition);
        setPosition(currentPosition);
        setSpeed(position.coords.speed || 0);
        setHeading(position.coords.heading || 0);
        setLastUpdate(new Date().toLocaleTimeString());
        
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
        setError(`Error getting location: ${err.message}`);
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 0,
        timeout: 5000
      }
    );
    
    setWatchId(id);
    setError(null);
  };

  // Stop tracking
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  // Update driver ID
  const handleDriverIdChange = (e) => {
    setDriverId(e.target.value);
  };

  // Button hover states
  const [buttonHover, setButtonHover] = useState(false);

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        {/* Header */}
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
        
        {/* Main Content */}
        <div style={{...styles.content, ...styles.scrollbar}} className="custom-scrollbar">
          <div style={styles.sectionTitle}>
            <Truck size={18} /> Driver Information
          </div>
          
          {/* Driver card */}
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
                {position[0].toFixed(4)}, {position[1].toFixed(4)}
              </div>
              <div style={styles.infoItem}>
                <Navigation size={13} style={styles.infoIcon} />
                {speed ? (speed * 3.6).toFixed(1) + ' km/h' : 'Idle'}
              </div>
            </div>
          </div>
          
          {/* Status details */}
          <div style={styles.sectionTitle}>
            <Activity size={18} /> Status Details
          </div>
          
          <div style={styles.statusDetail}>
            <div style={styles.card}>
              <div style={styles.statusLabel}>Location</div>
              <div style={{ wordWrap: 'break-word' }}>{position[0].toFixed(6)}, {position[1].toFixed(6)}</div>
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
          
          {/* Error message */}
          {error && (
            <div style={styles.errorBox}>
              <div style={styles.errorTitle}>Error</div>
              <div style={styles.errorText}>{error}</div>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div style={styles.controlsSection}>
          <div style={styles.inputGroup}>
            <input
              type="text"
              value={driverId}
              onChange={handleDriverIdChange}
              style={styles.input}
              placeholder="Enter driver ID"
            />
          </div>
          
          <button 
            onClick={watchId === null ? startTracking : stopTracking} 
            style={{
              ...styles.button,
              ...(watchId === null ? {} : styles.buttonRed),
              ...(buttonHover ? (watchId === null ? styles.buttonHover : styles.buttonRedHover) : {})
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
      
      {/* Map Container */}
      <div className="map-wrapper" style={styles.mapContainer}>
        <MapContainer 
          center={position} 
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
          <MapController position={position} />
        </MapContainer>
      </div>
    </div>
  );
}

export default App;