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
import axios from "axios";

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
      try {
        // Try using AutocompleteSuggestion (recommended by Google)
        if (window.google.maps.places.AutocompleteSuggestion) {
          console.log('Using recommended AutocompleteSuggestion API');
          // This is where we would initialize AutocompleteSuggestion
          // For now, we'll continue using AutocompleteService as a fallback
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
        } else {
          console.log('AutocompleteSuggestion not available, using AutocompleteService instead');
          autocompleteService.current = new window.google.maps.places.AutocompleteService();
        }
      } catch (error) {
        console.error('Error initializing Google Maps Places API:', error);
        autocompleteService.current = null;
      }
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

// Daftar tipe kendaraan beserta golongan tol
const vehicleTypes = [
  { label: 'Mobil', value: 'car', golonganTol: 'gol1' },
  { label: 'Truk Kecil', value: 'small_truck', golonganTol: 'gol2' },
  { label: 'Truk Sedang', value: 'medium_truck', golonganTol: 'gol3' },
  { label: 'Truk Besar', value: 'large_truck', golonganTol: 'gol4' },
  { label: 'Bus', value: 'bus', golonganTol: 'gol3' },
  { label: 'Motor', value: 'motorcycle', golonganTol: 'gol1' }
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
  const [vehicleClass, setVehicleClass] = useState('gol1'); // default golongan tol
  const [nearestStartTollGate, setNearestStartTollGate] = useState(null);
  const [nearestEndTollGate, setNearestEndTollGate] = useState(null);
  const [estimatedTollCost, setEstimatedTollCost] = useState(null);
  const [useToll, setUseToll] = useState(true);
  const [tollGates, setTollGates] = useState([]);
  const [buttonHover, setButtonHover] = useState(false);

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

  // Ambil data gerbang tol dari API saat komponen mount
  useEffect(() => {
    /**
     * Mengambil data gerbang tol dari API backend dan menyimpannya ke state tollGates
     */
    const fetchTollGates = async () => {
      try {
        console.log('Fetching toll gates data...');
        
        // Coba endpoint /api/toll-gates terlebih dahulu
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

        // Jika endpoint pertama gagal, coba endpoint alternatif
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

        // Jika kedua endpoint gagal, gunakan data contoh
        console.log('Using fallback sample toll gate data');
        const sampleTollGates = [
          { name: 'Gerbang Tol Waru', latitude: -7.3467, longitude: 112.7267, baseCost: 7500 },
          { name: 'Gerbang Tol Sidoarjo', latitude: -7.4467, longitude: 112.7167, baseCost: 8500 },
          { name: 'Gerbang Tol Porong', latitude: -7.5467, longitude: 112.6967, baseCost: 9500 },
          { name: 'Gerbang Tol Gempol', latitude: -7.5567, longitude: 112.6867, baseCost: 10500 },
          { name: 'Gerbang Tol Surabaya Barat', latitude: -7.2767, longitude: 112.6867, baseCost: 11500 },
          { name: 'Gerbang Tol Surabaya Timur', latitude: -7.2667, longitude: 112.7867, baseCost: 12500 },
        ];
        setTollGates(sampleTollGates);
      } catch (err) {
        console.error('Completely failed to get toll gates data:', err);
        setTollGates([]);
      }
    };
    fetchTollGates();
  }, []);

  // Request location access and start tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    
    // Show message that we're attempting to get location
    setError('Requesting location access...');
    
    // Set more reasonable timeout - 15 seconds instead of 5
    const locationTimeout = 15000; 
    
    // For development/testing - use mock location if real location fails
    const startMockLocation = () => {
      console.log('Using mock location data for testing');
      // Use a mock position near a toll gate
      const mockPosition = {
        coords: {
          latitude: -7.3467, // Near Gerbang Tol Waru
          longitude: 112.7267,
          speed: 30 / 3.6, // 30 km/h in m/s
          heading: 45
        },
        timestamp: Date.now()
      };
      
      // Update the state with mock data
      setPosition([mockPosition.coords.latitude, mockPosition.coords.longitude]);
      setSpeed(mockPosition.coords.speed);
      setHeading(mockPosition.coords.heading);
      setLastUpdate(new Date().toLocaleTimeString());
      setError('Using simulated location data (for testing)'); // Show mock data notice
      
      // If socket connection exists, send the mock data
      if (socket && connected) {
        socket.emit('driverLocation', {
          deviceID: driverId,
          location: {
            type: 'Point',
            coordinates: [mockPosition.coords.longitude, mockPosition.coords.latitude]
          },
          speed: mockPosition.coords.speed,
          heading: mockPosition.coords.heading,
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
      
      // Start a timer to simulate movement
      const mockInterval = setInterval(() => {
        // Small random movement
        const latChange = (Math.random() - 0.5) * 0.0005;
        const lngChange = (Math.random() - 0.5) * 0.0005;
        
        // Update mock position
        mockPosition.coords.latitude += latChange;
        mockPosition.coords.longitude += lngChange;
        mockPosition.coords.speed = 20 + Math.random() * 20; // Random speed between 20-40 km/h
        mockPosition.coords.heading = (mockPosition.coords.heading + (Math.random() - 0.5) * 20) % 360;
        mockPosition.timestamp = Date.now();
        
        // Update state
        setPosition([mockPosition.coords.latitude, mockPosition.coords.longitude]);
        setSpeed(mockPosition.coords.speed / 3.6); // Convert to m/s
        setHeading(mockPosition.coords.heading);
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Send to server
        if (socket && connected) {
          socket.emit('driverLocation', {
            deviceID: driverId,
            location: {
              type: 'Point',
              coordinates: [mockPosition.coords.longitude, mockPosition.coords.latitude]
            },
            speed: mockPosition.coords.speed / 3.6,
            heading: mockPosition.coords.heading,
            timestamp: Math.floor(Date.now() / 1000)
          });
        }
      }, 3000); // Update every 3 seconds
      
      // Store the interval ID directly so we can clear it later
      window.mockLocationInterval = mockInterval;
      setWatchId(-999); // Use a special ID to indicate mock location
    };
    
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
            
            // If permission denied, offer mock data
            const useMock = window.confirm('Location access denied. Would you like to use simulated location data for testing?');
            if (useMock) {
              startMockLocation();
            }
          } else if (err.code === 2) {
            setError('Location unavailable. Using simulated location data for testing.');
            startMockLocation();
          } else if (err.code === 3) {
            setError('Location request timed out. Using simulated location data for testing.');
            startMockLocation();
          } else {
            setError(`Error getting location: ${err.message}. Using simulated location data.`);
            startMockLocation();
          }
        },
        { 
          enableHighAccuracy: true, 
          maximumAge: 0,
          timeout: locationTimeout
        }
      );
      
      // Only set watchId if we haven't already set it to the mock value
      if (watchId !== -999) {
        setWatchId(id);
      }
    } catch (e) {
      console.error('Fatal error setting up geolocation:', e);
      setError(`Could not initialize location tracking: ${e.message}`);
      // Offer mock data as a fallback
      const useMock = window.confirm('Location tracking failed to initialize. Would you like to use simulated location data for testing?');
      if (useMock) {
        startMockLocation();
      }
    }
  };

  // Stop tracking
  const stopTracking = () => {
    if (watchId === -999) {
      // If using mock location, clear the interval
      if (window.mockLocationInterval) {
        clearInterval(window.mockLocationInterval);
        window.mockLocationInterval = null;
      }
      setWatchId(null);
    } else if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    
    setError(null);
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
    if (!point || tollGates.length === 0) return null;
    let nearest = null;
    let minDistance = Infinity;
    
    // Log untuk debugging
    console.log('Finding nearest toll gate for point:', point);
    
    // Periksa struktur data tollGates
    tollGates.forEach(gate => {
      // Adaptasi untuk berbagai format data yang mungkin diterima dari API
      const latitude = gate.latitude || gate.lat || (gate.position ? gate.position[0] : null);
      const longitude = gate.longitude || gate.lng || (gate.position ? gate.position[1] : null);
      
      // Jika latitude dan longitude valid
      if (latitude !== null && longitude !== null) {
        const gatePos = [latitude, longitude];
        const distance = calculateDistance(point, gatePos);
        
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { ...gate, distance };
        }
      }
    });
    
    // Return the nearest toll gate regardless of distance
    // This allows toll calculation between cities that might be far from toll gates
    if (nearest) {
      console.log('Nearest toll gate found:', nearest.name, 'at distance:', nearest.distance.toFixed(2), 'km');
      return nearest;
    }
    
    console.log('No toll gate found');
    return null;
  };

  // Improved function to estimate default toll costs when API fails
  const estimateDefaultTollCost = (startGate, endGate, vehicleClass) => {
    if (!startGate || !endGate) return null;
    
    // Check if gates are the same (no toll fee)
    if (startGate.name === endGate.name) return 0;
    
    // Extract locations from gates
    const startLat = startGate.latitude || startGate.lat || 0;
    const startLng = startGate.longitude || startGate.lng || 0;
    const endLat = endGate.latitude || endGate.lat || 0;
    const endLng = endGate.longitude || endGate.lng || 0;
    
    // Calculate distance between gates
    const gateDistance = calculateDistance(
      [startLat, startLng], 
      [endLat, endLng]
    );
    
    // Determine region based on coordinates (rough estimation)
    let region = "java"; // Default to Java
    
    // Check if it's in Sumatra (rough longitude check)
    if (startLng < 105 && endLng < 105) {
      region = "sumatra";
    }
    // Check if it's in Kalimantan
    else if (startLat > 0 && endLat > 0 && startLng > 108 && endLng > 108) {
      region = "kalimantan";
    }
    
    // Base rates per km for different regions (in IDR)
    const baseRatesPerKm = {
      java: {
        gol1: 900,
        gol2: 1350,
        gol3: 1800,
        gol4: 2250,
        gol5: 2700
      },
      sumatra: {
        gol1: 800,
        gol2: 1200,
        gol3: 1600,
        gol4: 2000,
        gol5: 2400
      },
      kalimantan: {
        gol1: 850,
        gol2: 1275,
        gol3: 1700,
        gol4: 2125,
        gol5: 2550
      }
    };
    
    // Base entry fee for toll roads (in IDR)
    const entryFees = {
      java: {
        gol1: 5000,
        gol2: 7500,
        gol3: 10000,
        gol4: 12500,
        gol5: 15000
      },
      sumatra: {
        gol1: 4500,
        gol2: 6750,
        gol3: 9000,
        gol4: 11250,
        gol5: 13500
      },
      kalimantan: {
        gol1: 4750,
        gol2: 7125,
        gol3: 9500,
        gol4: 11875,
        gol5: 14250
      }
    };
    
    // Get rates for the selected region and vehicle class
    const ratePerKm = baseRatesPerKm[region][vehicleClass] || baseRatesPerKm.java.gol1;
    const entryFee = entryFees[region][vehicleClass] || entryFees.java.gol1;
    
    // Calculate distance cost
    let distanceCost = Math.round(gateDistance * ratePerKm);
    
    // Check if it's a short trip (under 5km)
    if (gateDistance < 5) {
      // Short trips have a minimum fee
      distanceCost = Math.max(distanceCost, entryFee * 0.8);
    }
    
    // Check for premium toll road (e.g., Jakarta inner ring road, airport connections)
    const isPremiumToll = isPremiumTollRoad(startGate.name) || isPremiumTollRoad(endGate.name);
    const premiumMultiplier = isPremiumToll ? 1.2 : 1.0;
    
    // Final cost calculation: entry fee + distance-based cost
    let tollCost = entryFee + (distanceCost * premiumMultiplier);
    
    // Round to nearest 500 IDR (standard practice in Indonesia)
    tollCost = Math.ceil(tollCost / 500) * 500;
    
    return tollCost;
  };

  // Helper function to identify premium toll roads (typically urban/inner city or airport connections)
  const isPremiumTollRoad = (gateName) => {
    const premiumKeywords = [
      'Dalam Kota', 'Inner City', 'Airport', 'Bandara', 'Soekarno', 'Juanda', 
      'Sedyatmo', 'JORR', 'Ring Road', 'Lingkar', 'Harbour Road', 'Pelabuhan'
    ];
    
    return premiumKeywords.some(keyword => 
      gateName.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  // Calculate route information (distance, duration, and toll info)
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
    
    // Always call toll price API if toll is enabled, using the nearest gates
    // regardless of distance
    if (useToll) {
      console.log('Toll is enabled, checking gates...');
      if (startTollGate && endTollGate) {
        console.log('Both toll gates found, calling toll price API');
        console.log('Start gate:', startTollGate.name, 'End gate:', endTollGate.name);
        
        // Directly call the API with explicit parameters
        console.log('*** MAKING DIRECT API CALL ***');
        try {
          // Build the URL and parameters
          const apiBaseUrl = process.env.REACT_APP_API_URL || '';
          const url = `${apiBaseUrl}/api/calculate-toll`;
          const params = {
            startGate: startTollGate.name,
            endGate: endTollGate.name,
            vehicleType: vehicleClass // Changed from vehicleType to vehicleClass
          };
          
          console.log('URL:', url);
          console.log('Params:', params);
          
          // Add API key if available
          const apiKey = process.env.REACT_APP_API_KEY || 'default-dev-key';
          const headers = {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          };
          
          // Make the API call
          const response = await axios.get(url, { params, headers });
          
          console.log('API Response:', response.data);
          
          if (response.data && typeof response.data.cost === 'number') {
            console.log('Toll cost estimate:', response.data.cost);
            setEstimatedTollCost(response.data.cost);
          } else {
            console.warn('Invalid response format:', response.data);
            // Use a default cost for demo purposes when API fails
            const defaultCost = estimateDefaultTollCost(startTollGate, endTollGate, vehicleClass);
            console.log('Using default cost estimation:', defaultCost);
            setEstimatedTollCost(defaultCost);
          }
        } catch (error) {
          console.error('API call failed:', error);
          
          // Use a default cost for demo purposes when API fails
          const defaultCost = estimateDefaultTollCost(startTollGate, endTollGate, vehicleClass);
          console.log('Using default cost estimation after error:', defaultCost);
          setEstimatedTollCost(defaultCost);
        }
      } else {
        console.warn('Cannot calculate toll: missing gates',
          startTollGate ? 'OK' : 'X', 
          endTollGate ? 'OK' : 'X');
        setEstimatedTollCost(null);
      }
    } else {
      console.log('Toll is disabled, skipping toll calculation');
      setEstimatedTollCost(null);
    }
  };

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
                            const newUseToll = !useToll;
                            setUseToll(newUseToll);
                            if (startPoint && endPoint) {
                              // Recalculate route info when toll preference changes
                              calculateRouteInfo(startPoint, endPoint);
                              
                              // Additional manual call to fetch toll estimates if we're enabling toll
                              if (newUseToll && nearestStartTollGate && nearestEndTollGate) {
                                console.log('Calling toll price API directly from toggle...');
                                const defaultCost = estimateDefaultTollCost(nearestStartTollGate, nearestEndTollGate, vehicleClass);
                                setEstimatedTollCost(defaultCost);
                              }
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
                                // Force recalculation with existing data
                                const defaultCost = estimateDefaultTollCost(nearestStartTollGate, nearestEndTollGate, vehicleClass);
                                setEstimatedTollCost(defaultCost);
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
                              if (startPoint && endPoint && nearestStartTollGate && nearestEndTollGate) {
                                // Force manual calculation with existing data
                                const defaultCost = estimateDefaultTollCost(nearestStartTollGate, nearestEndTollGate, vehicleClass);
                                setEstimatedTollCost(defaultCost);
                              } else {
                                console.warn('Cannot refresh - missing required data');
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
                            title="Use default toll cost calculation"
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                        <div style={{fontSize: '14px', fontWeight: 'bold'}}>
                          Biaya tol belum tersedia
                        </div>
                        <div style={{fontSize: '12px', marginTop: '4px'}}>
                          Klik refresh untuk perhitungan default
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
          
          {error && (
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
            <div className="mb-4">
              <label htmlFor="vehicleClass" className="block text-sm font-medium text-gray-200 mb-1">Golongan Kendaraan (Tol)</label>
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
                      const defaultCost = estimateDefaultTollCost(nearestStartTollGate, nearestEndTollGate, e.target.value);
                      setEstimatedTollCost(defaultCost);
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
              
              {/* Debug button for direct API call */}
              <button
                onClick={() => {
                  console.log('Using default toll cost calculation');
                  
                  try {
                    // Use default values if needed
                    const startGate = nearestStartTollGate || {
                      name: 'Gerbang Tol Waru', 
                      latitude: -7.3467, 
                      longitude: 112.7267,
                      baseCost: 7500
                    };
                    
                    const endGate = nearestEndTollGate || {
                      name: 'Gerbang Tol Sidoarjo', 
                      latitude: -7.4467, 
                      longitude: 112.7167,
                      baseCost: 8500
                    };
                    
                    // Calculate cost using our default estimation
                    const defaultCost = estimateDefaultTollCost(startGate, endGate, vehicleClass);
                    console.log('Default cost calculation:', defaultCost);
                    setEstimatedTollCost(defaultCost);
                    
                    // Show message to user
                    alert(`Perkiraan biaya tol: Rp ${defaultCost.toLocaleString('id-ID')}\n\nCatatan: Ini hanya perkiraan default karena API tidak tersedia.`);
                  } catch (error) {
                    console.error('Error in default calculation:', error);
                    alert('Error in toll cost calculation: ' + error.message);
                  }
                }}
                style={{
                  backgroundColor: '#475569',
                  color: 'white',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} /> Hitung Biaya Tol Default
              </button>
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
            
            {(startPoint && endPoint) && (
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
            )}
          </div>
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