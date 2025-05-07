import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { 
  ArrowRight, 
  Navigation, 
  Wifi, 
  WifiOff,
  MapPin
} from 'lucide-react';

// Fix for default marker icons in Leaflet with React
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
});

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

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold flex items-center">
              <MapPin className="mr-2" size={24} />
              Driver Tracker
            </h1>
            <div className="flex items-center rounded-full bg-white bg-opacity-20 px-3 py-1">
              {connected ? 
                <Wifi className="text-green-300 mr-2" size={18} /> : 
                <WifiOff className="text-red-300 mr-2" size={18} />
              }
              <span className="text-sm font-medium">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Controls and Info Section */}
      <div className="p-4 bg-gray-50">
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex flex-col sm:flex-row mb-4 gap-2">
            <input
              type="text"
              value={driverId}
              onChange={handleDriverIdChange}
              className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter driver ID"
            />
            
            {watchId === null ? (
              <button 
                onClick={startTracking} 
                className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md transition duration-200 flex items-center justify-center"
              >
                Start Tracking <ArrowRight size={16} className="ml-2" />
              </button>
            ) : (
              <button 
                onClick={stopTracking} 
                className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition duration-200"
              >
                Stop Tracking
              </button>
            )}
          </div>
          
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-4 flex items-start">
              <span className="font-medium mr-2">Error:</span>
              <span>{error}</span>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <div className="font-medium flex items-center">
                <span className={`h-2 w-2 rounded-full mr-2 ${watchId !== null ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                {watchId !== null ? 'Transmitting' : 'Idle'}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Speed</div>
              <div className="font-medium">{(speed * 3.6).toFixed(1)} km/h</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Heading</div>
              <div className="font-medium flex items-center">
                {heading ? heading.toFixed(0) + '°' : 'N/A'} 
                {heading && (
                  <Navigation 
                    size={16} 
                    className="ml-2 text-blue-600" 
                    style={{ transform: `rotate(${heading}deg)` }} 
                  />
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-sm text-gray-500 mb-1">Driver ID</div>
              <div className="font-medium truncate">{driverId}</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Map Container - Keeping closer to original structure */}
      <div className="flex-grow relative" style={{ height: "100vh", width: "100%" }}>
        <MapContainer 
          center={position} 
          zoom={15} 
          style={{ height: "100%", width: "100%" }}
          className="rounded-lg shadow-md"
          ref={mapRef}
        >
          <TileLayer
            attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>
              <div className="text-center p-1">
                <div className="font-bold text-blue-600">{driverId}</div>
                <div className="text-sm">Speed: {(speed * 3.6).toFixed(1)} km/h</div>
                <div className="text-sm">Heading: {heading ? heading.toFixed(0) + '°' : 'N/A'}</div>
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