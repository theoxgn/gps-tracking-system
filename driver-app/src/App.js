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
import ChatComponent from './ChatComponent';

// Konstanta untuk libraries Google Maps agar tidak di-re-render
const mapsLibraries = ['places'];

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
});

// Custom marker dengan flat design
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"><div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>`,
    iconSize: [24, 24],
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

// Tambahkan CSS inline untuk styling dengan flat design yang modern dan responsif
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    position: 'relative',
    '@media (max-width: 768px)': {
      flexDirection: 'column'
    }
  },
  sidebar: {
    width: '320px',
    backgroundColor: '#f8fafc', // light background for flat design
    color: '#334155', // slate-700 for better readability
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #e2e8f0', // subtle border
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    '@media (max-width: 768px)': {
      width: '100%',
      height: '50%',
      borderRight: 'none',
      borderBottom: '1px solid #e2e8f0'
    }
  },
  header: {
    backgroundColor: '#3b82f6', // flat blue color
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    color: 'white'
  },
  headerIcon: {
    color: 'white'
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.9)'
  },
  content: {
    flex: '1',
    padding: '16px',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#3b82f6', // flat blue
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px'
  },
  card: {
    padding: '16px',
    backgroundColor: '#f1f5f9', // very light blue-gray
    borderRadius: '8px',
    marginBottom: '12px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: '1px solid #e2e8f0'
  },
  cardActive: {
    backgroundColor: '#3b82f6', // flat blue
    color: 'white',
    borderColor: '#3b82f6'
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
    color: '#64748b', // slate-500
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
    color: '#475569' // slate-600
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  infoIcon: {
    color: '#3b82f6' // flat blue
  },
  controlsSection: {
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
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
    backgroundColor: '#ffffff',
    color: '#334155',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '12px',
    fontSize: '14px',
    transition: 'border-color 0.2s ease',
    '&:focus': {
      borderColor: '#3b82f6',
      outline: 'none'
    }
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px',
    backgroundColor: '#3b82f6', // flat blue
    color: 'white',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    gap: '8px',
    fontSize: '16px'
  },
  buttonRed: {
    backgroundColor: '#ef4444' // flat red
  },
  buttonHover: {
    backgroundColor: '#2563eb' // darker blue
  },
  buttonRedHover: {
    backgroundColor: '#dc2626' // darker red
  },
  mapContainer: {
    flex: '1',
    position: 'relative',
    '@media (max-width: 768px)': {
      height: '50%'
    }
  },
  statusInfo: {
    marginTop: '12px',
    marginBottom: '16px'
  },
  errorBox: {
    backgroundColor: '#fee2e2', // light red background
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid #fecaca'
  },
  errorTitle: {
    fontWeight: 'bold',
    color: '#ef4444' // flat red
  },
  errorText: {
    color: '#ef4444', // flat red
    fontSize: '14px'
  },
  statusBadgeActive: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#dcfce7', // light green
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#10b981' // green-500
  },
  statusBadgeInactive: {
    display: 'inline-flex',
    alignItems: 'center',
    backgroundColor: '#f1f5f9', // light slate
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#64748b' // slate-500
  },
  statusDotActive: {
    color: '#10b981' // green-500
  },
  statusDotInactive: {
    color: '#64748b' // slate-500
  },
  statusDetail: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
    fontSize: '14px'
  },
  statusLabel: {
    color: '#3b82f6', // flat blue
    marginBottom: '4px'
  },
  scrollbar: {
    scrollbarWidth: 'thin',
    scrollbarColor: '#cbd5e1 #f1f5f9'
  }
};

const SERVER_URL = process.env.REACT_APP_API_URL;
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Komponen untuk input alamat dengan autocomplete menggunakan Places API yang direkomendasikan Google
const PlacesAutocomplete = ({ placeholder, onSelect, value, onChange, style }) => {
  // State untuk nilai input, suggestions, dan loading state
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteService = useRef(null);
  
  // Inisialisasi Places API saat Google Maps API dimuat
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      try {
        // Simpan referensi ke API Places untuk digunakan nanti
        autocompleteService.current = {
          type: 'suggestion',
          api: window.google.maps.places
        };
        
        console.log('Berhasil menginisialisasi Google Maps Places API');
      } catch (error) {
        console.error('Error saat inisialisasi Google Maps Places API:', error);
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
      setIsLoading(true);
      
      // Gunakan AutocompleteSuggestion API untuk mendapatkan saran
      if (autocompleteService.current) {
        // Buat options untuk API baru
        const searchOptions = {
          input: newValue,
          locationRestriction: {
            // Batasi ke Indonesia
            rectangle: {
              // Batas koordinat Indonesia (perkiraan)
              low: { latitude: -11.0, longitude: 95.0 },
              high: { latitude: 6.0, longitude: 141.0 }
            }
          },
          componentRestrictions: { country: 'id' } // Batasi ke Indonesia
        };
        
        // Gunakan timeout untuk menghindari terlalu banyak permintaan
        const timeoutId = setTimeout(() => {
          // Menggunakan AutocompleteSuggestion API yang baru
          const autocompleteService = new window.google.maps.places.AutocompleteService();
            autocompleteService.getPlacePredictions(searchOptions)
              .then(response => {
                setIsLoading(false);
                if (response && response.predictions) {
                  console.log('Suggestions received:', response.predictions);
                  setSuggestions(response.predictions);
                } else {
                  setSuggestions([]);
                }
              })
              .catch(error => {
                setIsLoading(false);
                console.error('Error saat mendapatkan saran lokasi:', error);
                setSuggestions([]);
              
                try {
                  if (window.google && window.google.maps && window.google.maps.places && window.google.maps.places.AutocompleteService) {
                    const fallbackService = new window.google.maps.places.AutocompleteService();
                    const fallbackOptions = {
                      input: newValue,
                      componentRestrictions: { country: 'id' }
                    };
                    
                    fallbackService.getPlacePredictions(fallbackOptions, (predictions, status) => {
                      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                        console.log('Fallback suggestions received:', predictions);
                        setSuggestions(predictions);
                      }
                    });
                  }
                } catch (fallbackError) {
                  console.error('Fallback autocomplete juga gagal:', fallbackError);
                }
              });
          }, 300); // Delay 300ms untuk mengurangi jumlah permintaan
        
        return () => clearTimeout(timeoutId);
      }
    } else {
      setIsLoading(false);
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };


  // Handler untuk pemilihan suggestion
  const handleSelectSuggestion = async (suggestion) => {
    // Ekstrak deskripsi alamat dari suggestion berdasarkan format API baru
    let address = '';
    let placeId = '';
    
    // Prioritaskan format dari AutocompleteSuggestion API
    if (suggestion.formattedText) {
      // Format utama dari AutocompleteSuggestion API
      address = suggestion.formattedText;
      placeId = suggestion.placeId;
    } else if (suggestion.primaryText && suggestion.secondaryText) {
      // Format terpisah dari AutocompleteSuggestion API
      address = `${suggestion.primaryText}, ${suggestion.secondaryText}`;
      placeId = suggestion.placeId;
    } else if (suggestion.description) {
      // Format lama dari AutocompleteService (untuk kompatibilitas)
      address = suggestion.description;
      placeId = suggestion.place_id;
    } else if (suggestion.structured_formatting) {
      // Format alternatif dari AutocompleteService (untuk kompatibilitas)
      const { main_text, secondary_text } = suggestion.structured_formatting;
      address = secondary_text ? `${main_text}, ${secondary_text}` : main_text;
      placeId = suggestion.place_id;
    }
    
    // Perbarui input dan reset state
    setInputValue(address);
    setShowSuggestions(false);
    setSuggestions([]);
    setIsLoading(true);
    
    try {
      // Jika kita memiliki placeId, gunakan Place API untuk mendapatkan detail lokasi
      if (placeId && autocompleteService.current) {
        try {
          console.log('Mencoba mendapatkan lokasi dengan Place API baru');
          // Gunakan fetchPlace dari API baru untuk mendapatkan detail lokasi
          const placeResult = await autocompleteService.current.api.Place.fetchPlace({
            id: placeId,
            fields: ['location']
          });
          
          if (placeResult && placeResult.place && placeResult.place.location) {
            const location = placeResult.place.location;
            console.log('Berhasil mendapatkan lokasi dengan Place API baru:', location);
            
            // Panggil callback onSelect dengan alamat dan posisi
            onSelect && onSelect({
              address,
              position: [location.latitude, location.longitude]
            });
            setIsLoading(false);
            return;
          }
        } catch (placeError) {
          console.warn('Error saat mengambil detail tempat dengan Place API baru:', placeError);
          // Lanjutkan dengan metode fallback jika gagal
        }
        
        // Coba dengan PlacesService jika fetchPlace gagal
        try {
          console.log('Mencoba mendapatkan lokasi dengan PlacesService');
          // Buat PlacesService dengan dummy element
          const placesService = new window.google.maps.places.PlacesService(document.createElement('div'));
          
          // Gunakan getDetails untuk mendapatkan detail lokasi
          placesService.getDetails(
            { placeId: placeId, fields: ['geometry'] },
            (place, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                const location = place.geometry.location;
                console.log('Berhasil mendapatkan lokasi dengan PlacesService:', location);
                
                // Panggil callback onSelect dengan alamat dan posisi
                onSelect && onSelect({
                  address,
                  position: [location.lat(), location.lng()]
                });
                setIsLoading(false);
                return;
              } else {
                console.warn('PlacesService gagal mendapatkan detail lokasi, status:', status);
                // Lanjutkan dengan metode fallback
                fallbackGeocoding();
              }
            }
          );
          return;
        } catch (placesServiceError) {
          console.warn('Error saat menggunakan PlacesService:', placesServiceError);
          // Lanjutkan dengan metode fallback
        }
      }
      
      // Fallback geocoding function
      const fallbackGeocoding = async () => {
        try {
          console.log('Menggunakan fallback geocoding dengan getGeocode');
          const results = await getGeocode({ address });
          const { lat, lng } = await getLatLng(results[0]);
          console.log('Berhasil mendapatkan lokasi dengan getGeocode:', lat, lng);
          
          // Panggil callback onSelect dengan alamat dan posisi
          onSelect && onSelect({
            address,
            position: [lat, lng]
          });
        } catch (geocodeError) {
          console.error('Error saat geocoding:', geocodeError);
        } finally {
          setIsLoading(false);
        }
      };
      
      // Jalankan fallback geocoding
      await fallbackGeocoding();
    } catch (error) {
      console.error('Error saat memilih lokasi:', error);
      setIsLoading(false);
    }
  };

  // Handler untuk menghapus input
  const handleClearInput = () => {
    setInputValue('');
    onChange && onChange({ target: { value: '' } });
    setSuggestions([]);
    setShowSuggestions(false);
    setIsLoading(false);
  };

  // Style untuk loading indicator
  const loadingIndicatorStyle = {
    position: 'absolute',
    right: inputValue ? '36px' : '12px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid #9ca3af',
    borderTopColor: '#3b82f6',
    animation: 'spin 1s linear infinite'
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Tambahkan animasi spin untuk loading indicator */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
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
            paddingRight: isLoading ? '56px' : (inputValue ? '36px' : '12px')
          }}
          onFocus={() => inputValue && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {isLoading && <div style={loadingIndicatorStyle} />}
        {inputValue && (
          <X 
            size={16} 
            style={{ 
              position: 'absolute', 
              right: '12px', 
              color: '#9ca3af', 
              cursor: 'pointer',
              zIndex: 2
            }} 
            onClick={handleClearInput}
          />
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <ul style={dropdownStyle} className="custom-scrollbar">
          {suggestions.map((suggestion) => {
            // Ekstrak ID dari suggestion berdasarkan format API
            const id = suggestion.placeId || suggestion.place_id || `suggestion-${Math.random()}`;
            
            // Ekstrak teks utama dan sekunder dari berbagai format API
            let mainText = '';
            let secondaryText = '';
            
            // Format dari AutocompleteSuggestion API (baru)
            if (suggestion.formattedText) {
              // Jika ada formattedText, gunakan sebagai teks utama
              mainText = suggestion.formattedText;
              // Jika ada primaryText dan secondaryText yang terpisah, gunakan untuk tampilan yang lebih baik
              if (suggestion.primaryText) {
                mainText = suggestion.primaryText;
                secondaryText = suggestion.secondaryText || '';
              }
            } 
            // Format dari AutocompleteService API (lama)
            else if (suggestion.structured_formatting) {
              mainText = suggestion.structured_formatting.main_text;
              secondaryText = suggestion.structured_formatting.secondary_text || '';
            } 
            // Fallback ke description jika tidak ada format lain
            else if (suggestion.description) {
              mainText = suggestion.description;
            }
            // Fallback terakhir jika tidak ada format yang dikenali
            else {
              mainText = suggestion.text || 'Lokasi tidak diketahui';
            }
            
            return (
              <li
                key={id}
                style={suggestionItemStyle}
                onMouseDown={() => handleSelectSuggestion(suggestion)}
                onMouseOver={(e) => {
                  Object.assign(e.target.style, suggestionItemHoverStyle);
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = '';
                }}
              >
                <strong>{mainText}</strong> {secondaryText && <small style={{ color: '#9ca3af' }}>{secondaryText}</small>}
              </li>
            );
          })}
        </ul>
      )}
      
      {showSuggestions && suggestions.length === 0 && isLoading && (
        <div style={{...dropdownStyle, padding: '10px', textAlign: 'center', color: '#9ca3af'}}>
          Mencari lokasi...
        </div>
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
// Variabel ini tidak digunakan saat ini, dikomentari untuk menghindari peringatan ESLint
/*
const vehicleTypes = [
  { label: 'Mobil', value: 'car', golonganTol: 'gol1' },
  { label: 'Truk Kecil', value: 'small_truck', golonganTol: 'gol2' },
  { label: 'Truk Sedang', value: 'medium_truck', golonganTol: 'gol3' },
  { label: 'Truk Besar', value: 'large_truck', golonganTol: 'gol4' },
  { label: 'Bus', value: 'bus', golonganTol: 'gol3' },
  { label: 'Motor', value: 'motorcycle', golonganTol: 'gol1' }
];
*/

function App() {
  const [position, setPosition] = useState(null);
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

  // Force map resize when component mounts
  useEffect(() => {
    // Small delay to ensure the map container is fully rendered
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Add required CSS directly in a useEffect for proper map display with responsive design
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

        console.error('Failed to fetch toll gates data from all endpoints');
        setTollGates([]);
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

  // Stop tracking
  const stopTracking = () => {
    if (watchId !== null) {
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

  // Clear route
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
    
    if (nearest) {
      console.log('Nearest toll gate found:', nearest.name, 'at distance:', nearest.distance.toFixed(2), 'km');
      return nearest;
    }
    
    console.log('No toll gate found');
    return null;
  };

  // Function to estimate toll costs based on distance and vehicle class
  const estimateTollCost = (startGate, endGate, vehicleClass) => {
    if (!startGate || !endGate) return null;
    
    // Check if gates are the same (no toll fee)
    if (startGate.name === endGate.name) return 0;
    
    // Extract locations from gates
    const startLat = startGate.latitude || startGate.lat || 0;
    const startLng = startGate.longitude || startGate.lng || 0;
    const endLat = endGate.latitude || endGate.lat || 0;
    const endLng = endGate.longitude || endGate.lng || 0;
    
    // Calculate distance between gates
    // Variabel ini tidak digunakan saat ini, dikomentari untuk menghindari peringatan ESLint
    /*
    const gateDistance = calculateDistance(
      [startLat, startLng], 
      [endLat, endLng]
    );
    */
    
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
                {position ? `${position[0].toFixed(4)}, ${position[1].toFixed(4)}` : 'No location'}
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
            <div style={{...styles.sectionTitle, marginTop: '12px', marginBottom: '12px', fontSize: '16px'} } htmlFor="vehicleClass">
              <MapPinned size={16} /> Golongan Kendaraan (Tol)
            </div>
              {/* <label htmlFor="vehicleClass" className="block text-sm font-medium text-blue-800 mb-1">Golongan Kendaraan (Tol)</label> */}
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
      </div>
      
      {/* Map Container */}
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
    </div>
    </LoadScript>
  );
}

export default App;