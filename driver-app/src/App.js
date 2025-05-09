import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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
  ArrowRight,
  MapPinned,
  Target,
  Search,
  X
} from 'lucide-react';
import L from 'leaflet';
import { getGeocode, getLatLng } from 'use-places-autocomplete';
import { LoadScript } from '@react-google-maps/api';

// Konstanta untuk libraries Google Maps agar tidak di-re-render
const mapsLibraries = ['places'];

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

// Komponen RouteLine untuk menggambar garis rute antara dua titik
const RouteLine = ({ startPoint, endPoint }) => {
  // Jika salah satu titik tidak ada, tidak perlu menggambar garis
  if (!startPoint || !endPoint) return null;

  // Array posisi untuk Polyline: [titik awal, titik akhir]
  const routePositions = [startPoint, endPoint];

  return (
    <Polyline 
      positions={routePositions} 
      color="#3b82f6" 
      weight={4} 
      opacity={1} 
      dashArray="10, 10"
    />
  );
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

const SERVER_URL = process.env.REACT_APP_API_URL;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Komponen untuk input alamat dengan autocomplete menggunakan AutocompleteSuggestion yang direkomendasikan Google
const PlacesAutocomplete = ({ placeholder, onSelect, value, onChange, style }) => {
  // State untuk nilai input, suggestions, dan loading state
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const autocompleteService = useRef(null);
  
  // Inisialisasi AutocompleteService saat Google Maps API dimuat
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
    }
  }, []);

  // Sinkronkan nilai dari props dengan nilai internal
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value, inputValue]);

  // Style untuk dropdown
  const dropdownStyle = {
    position: 'absolute',
    backgroundColor: '#1f2937',
    width: '100%',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    marginTop: '4px',
    maxHeight: '200px',
    overflowY: 'auto'
  };

  const suggestionItemStyle = {
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #374151',
    fontSize: '14px',
    color: '#e5e7eb'
  };

  const suggestionItemHoverStyle = {
    backgroundColor: '#374151'
  };

  // Handler untuk input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange && onChange(e);
    
    if (newValue.length > 0) {
      // Mulai pencarian
      setShowSuggestions(true);
      
      // Gunakan AutocompleteService untuk mendapatkan saran
      if (autocompleteService.current) {
        autocompleteService.current.getPlacePredictions({
          input: newValue,
          componentRestrictions: { country: 'id' } // Batasi ke Indonesia
        }, (results, status) => {
          // Pencarian selesai
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setSuggestions(results);
          } else {
            setSuggestions([]);
          }
        });
      }
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  // Handler untuk pemilihan suggestion
  const handleSelectSuggestion = async (suggestion) => {
    setInputValue(suggestion.description);
    setShowSuggestions(false);
    setSuggestions([]);
    
    try {
      const results = await getGeocode({ address: suggestion.description });
      const { lat, lng } = await getLatLng(results[0]);
      onSelect && onSelect({
        address: suggestion.description,
        position: [lat, lng]
      });
    } catch (error) {
      console.error('Error selecting location:', error);
    }
  };

  // Handler untuk menghapus input
  const handleClearInput = () => {
    setInputValue('');
    onChange && onChange({ target: { value: '' } });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', color: '#9ca3af' }} />
        <input
          value={inputValue}
          onChange={handleInputChange}
          disabled={!window.google}
          placeholder={placeholder}
          style={{
            ...style,
            paddingLeft: '36px',
            paddingRight: inputValue ? '36px' : '12px'
          }}
          onFocus={() => inputValue && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {inputValue && (
          <X 
            size={16} 
            style={{ position: 'absolute', right: '12px', color: '#9ca3af', cursor: 'pointer' }} 
            onClick={handleClearInput}
          />
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <ul style={dropdownStyle} className="custom-scrollbar">
          {suggestions.map((suggestion) => {
            const { place_id, structured_formatting } = suggestion;
            const { main_text, secondary_text } = structured_formatting || { main_text: suggestion.description, secondary_text: '' };
            
            return (
              <li
                key={place_id}
                style={suggestionItemStyle}
                onMouseDown={() => handleSelectSuggestion(suggestion)}
                onMouseOver={(e) => {
                  Object.assign(e.target.style, suggestionItemHoverStyle);
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '';
                }}
              >
                <strong>{main_text}</strong> <small style={{ color: '#9ca3af' }}>{secondary_text}</small>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

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

// Data jenis kendaraan darat
const vehicleTypes = [
  { id: 'car', name: 'Mobil Pribadi', tollMultiplier: 1 },
  { id: 'suv', name: 'SUV/MPV', tollMultiplier: 1 },
  { id: 'pickup', name: 'Pickup', tollMultiplier: 1.5 },
  { id: 'truck_small', name: 'Truk Kecil', tollMultiplier: 1.5 },
  { id: 'truck_medium', name: 'Truk Sedang', tollMultiplier: 2 },
  { id: 'truck_large', name: 'Truk Besar', tollMultiplier: 2.5 },
  { id: 'bus_small', name: 'Bus Kecil', tollMultiplier: 1.5 },
  { id: 'bus_large', name: 'Bus Besar', tollMultiplier: 2 },
];

// Data contoh gerbang tol di Indonesia (untuk demo)
const tollGates = [
  { name: 'Gerbang Tol Waru', position: [-7.3467, 112.7267], baseCost: 7500 },
  { name: 'Gerbang Tol Sidoarjo', position: [-7.4467, 112.7167], baseCost: 8500 },
  { name: 'Gerbang Tol Porong', position: [-7.5467, 112.6967], baseCost: 9500 },
  { name: 'Gerbang Tol Gempol', position: [-7.5567, 112.6867], baseCost: 10500 },
  { name: 'Gerbang Tol Surabaya Barat', position: [-7.2767, 112.6867], baseCost: 11500 },
  { name: 'Gerbang Tol Surabaya Timur', position: [-7.2667, 112.7867], baseCost: 12500 },
];

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
  
  // Route state
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeDuration, setRouteDuration] = useState(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  
  // Tambahan state untuk kendaraan dan tol
  const [vehicleType, setVehicleType] = useState('car');
  const [nearestStartTollGate, setNearestStartTollGate] = useState(null);
  const [nearestEndTollGate, setNearestEndTollGate] = useState(null);
  const [estimatedTollCost, setEstimatedTollCost] = useState(null);
  const [useToll, setUseToll] = useState(true);

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
        // console.log("Map size invalidated");
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
        // console.log('Got position:', currentPosition);
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
        timeout: process.env.REACT_APP_TIMEOUT ? parseInt(process.env.REACT_APP_TIMEOUT) : 5000
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

  // Handle address input changes
  const handleStartAddressChange = (e) => {
    setStartAddress(e.target.value);
  };

  const handleEndAddressChange = (e) => {
    setEndAddress(e.target.value);
  };
  
  // Handle selection from autocomplete
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

  // Set start point to current position
  const setCurrentAsStart = () => {
    setStartPoint(position);
    setStartAddress(`Lokasi Saat Ini (${position[0].toFixed(4)}, ${position[1].toFixed(4)})`);
    
    // Calculate route info when both points are set
    if (endPoint) {
      calculateRouteInfo(position, endPoint);
    }
  };

  // Set end point manually (in real app, would use geocoding API)
  const setManualEndPoint = () => {
    // For demo purposes, set a point 0.01 degrees away from current position
    const newEndPoint = [position[0] + 0.01, position[1] + 0.01];
    setEndPoint(newEndPoint);
    setEndAddress(`Tujuan (${newEndPoint[0].toFixed(4)}, ${newEndPoint[1].toFixed(4)})`);
    
    // Calculate route info when both points are set
    if (startPoint) {
      calculateRouteInfo(startPoint, newEndPoint);
    }
  };

  // Clear route
  const clearRoute = () => {
    setStartPoint(null);
    setEndPoint(null);
    setStartAddress('');
    setEndAddress('');
    setRouteDistance(null);
    setRouteDuration(null);
  };
  
  // Fungsi untuk menghitung jarak antara dua titik (Haversine formula)
  const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2[0] - point1[0]) * Math.PI / 180;
    const dLon = (point2[1] - point1[1]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // jarak dalam kilometer
  };

  // Fungsi untuk mencari gerbang tol terdekat dari suatu titik
  const findNearestTollGate = (point) => {
    if (!point) return null;
    
    let nearestGate = null;
    let minDistance = Infinity;
    
    tollGates.forEach(gate => {
      const distance = calculateDistance(point, gate.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearestGate = { ...gate, distance };
      }
    });
    
    // Hanya kembalikan gerbang tol jika jaraknya kurang dari 20km
    return minDistance < 20 ? nearestGate : null;
  };

  // Calculate route information (distance, duration, and toll info)
  const calculateRouteInfo = (start, end) => {
    // Calculate distance in kilometers using Haversine formula
    const distance = calculateDistance(start, end);
    setRouteDistance(distance);
    
    // Estimate duration based on average speed (50 km/h)
    const avgSpeedKmh = 50;
    const durationHours = distance / avgSpeedKmh;
    const durationMinutes = Math.round(durationHours * 60);
    setRouteDuration(durationMinutes);
    
    // Find nearest toll gates to start and end points
    const startTollGate = findNearestTollGate(start);
    const endTollGate = findNearestTollGate(end);
    
    setNearestStartTollGate(startTollGate);
    setNearestEndTollGate(endTollGate);
    
    // Calculate estimated toll cost if both toll gates are found
    if (startTollGate && endTollGate && useToll) {
      // Get vehicle toll multiplier
      const selectedVehicle = vehicleTypes.find(v => v.id === vehicleType);
      const multiplier = selectedVehicle ? selectedVehicle.tollMultiplier : 1;
      
      // Base cost calculation (simplified for demo)
      const baseCost = Math.abs(endTollGate.baseCost - startTollGate.baseCost);
      const distanceCost = distance * 300; // Rp 300 per km
      
      // Apply vehicle type multiplier
      const totalCost = Math.round((baseCost + distanceCost) * multiplier);
      setEstimatedTollCost(totalCost);
    } else {
      setEstimatedTollCost(null);
    }
  };

  // Button hover states
  const [buttonHover, setButtonHover] = useState(false);

  return (
    <LoadScript
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      libraries={mapsLibraries}
      onLoad={() => setIsScriptLoaded(true)}
    >
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
            
            {/* Route information */}
            {(startPoint && endPoint) && (
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
                
                {/* Informasi Tol */}
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
                            setUseToll(!useToll);
                            if (startPoint && endPoint) {
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
                          Jarak: {nearestStartTollGate.distance.toFixed(1)} km
                        </div>
                      </div>
                    )}
                    
                    {nearestEndTollGate && (
                      <div style={styles.card}>
                        <div style={styles.statusLabel}>Gerbang Tol Keluar</div>
                        <div>{nearestEndTollGate.name}</div>
                        <div style={{fontSize: '12px', color: '#9ca3af', marginTop: '4px'}}>
                          Jarak: {nearestEndTollGate.distance.toFixed(1)} km
                        </div>
                      </div>
                    )}
                    
                    {estimatedTollCost && (
                      <div style={{...styles.card, backgroundColor: '#1d4ed8'}}>
                        <div style={styles.statusLabel}>Perkiraan Biaya Tol</div>
                        <div style={{fontSize: '18px', fontWeight: 'bold'}}>
                          Rp {estimatedTollCost.toLocaleString('id-ID')}
                        </div>
                        <div style={{fontSize: '12px', color: '#93c5fd', marginTop: '4px'}}>
                          Untuk kendaraan: {vehicleTypes.find(v => v.id === vehicleType)?.name}
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
            )}
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
            
            {/* Dropdown jenis kendaraan */}
            <select 
              value={vehicleType}
              onChange={(e) => {
                setVehicleType(e.target.value);
                // Recalculate toll cost when vehicle type changes
                if (startPoint && endPoint && useToll) {
                  calculateRouteInfo(startPoint, endPoint);
                }
              }}
              style={{
                ...styles.input,
                marginBottom: '12px',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px top 50%',
                backgroundSize: '12px auto',
                paddingRight: '30px'
              }}
            >
              {vehicleTypes.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                </option>
              ))}
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
                onClick={setManualEndPoint}
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
          {/* Current position marker */}
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
          
          <MapController position={position} />
        </MapContainer>
      </div>
    </div>
    </LoadScript>
  );
}

export default App;