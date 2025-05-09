import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { Truck, Users, Clock, Wifi, WifiOff, RefreshCw, MapPin, Navigation } from 'lucide-react';

// Fix for default marker icons in Leaflet with React
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
});

// Ganti nilai hardcoded dengan variabel environment
const SERVER_URL = process.env.REACT_APP_API_URL;

// Custom truck icon with rotation for direction
const createCustomIcon = (color, heading = 0) => {
  // Use vibrant colors based on active state
  const truckColor = color === '#2563eb' ? '#FF9900' : '#E67E22'; // Bright orange for active, darker orange for inactive
  const cabinColor = color === '#2563eb' ? '#333333' : '#555555'; // Dark cabin color
  
  // Create SVG truck icon with rotation based on the dumping truck image
  const truckSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" 
         style="transform: rotate(${heading}deg); transform-origin: center;" width="48" height="40">
      <!-- Truck body/bed -->
      <path d="M10,50 L20,30 L50,30 L65,15 L80,15 L80,30 L85,30 L85,50 L10,50 Z" fill="${truckColor}" stroke="#333" stroke-width="2" />
      
      <!-- Cabin -->
      <path d="M10,50 L10,30 L20,30 L20,50 Z" fill="${cabinColor}" stroke="#333" stroke-width="2" />
      
      <!-- Window in cabin -->
      <rect x="12" y="33" width="6" height="7" fill="white" stroke="#333" stroke-width="1" />
      
      <!-- Stripes in truck bed -->
      <rect x="25" y="35" width="5" height="10" fill="#333" />
      <rect x="35" y="35" width="5" height="10" fill="#333" />
      <rect x="45" y="35" width="5" height="10" fill="#333" />
      <rect x="55" y="35" width="5" height="10" fill="#333" />
      
      <!-- Left wheel -->
      <circle cx="25" cy="55" r="12" fill="black" stroke="#222" stroke-width="2" />
      <circle cx="25" cy="55" r="6" fill="#777" stroke="#555" stroke-width="1" />
      <circle cx="25" cy="55" r="2" fill="#333" />
      
      <!-- Right wheel -->
      <circle cx="70" cy="55" r="12" fill="black" stroke="#222" stroke-width="2" />
      <circle cx="70" cy="55" r="6" fill="#777" stroke="#555" stroke-width="1" />
      <circle cx="70" cy="55" r="2" fill="#333" />
    </svg>
  `;

  return L.divIcon({
    className: 'custom-truck-icon',
    html: `<div style="background-color: transparent; width: 50px; height: 50px; display: flex; justify-content: center; align-items: center;">${truckSvg}</div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -25]
  });
};

// Component to handle map controls and updates
function MapController({ activeDriver, drivers, autoCenter }) {
  const map = useMap();
  
  // Force map to redraw when component mounts
  useEffect(() => {
    console.log("MapController mounted, invalidating map size");
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  
  // Update view when active driver changes or when drivers update
  useEffect(() => {
    if (!map) return;

    console.log("Updating map view", { activeDriver, driversCount: Object.keys(drivers).length });
    
    try {
      // Force map to redraw first
      map.invalidateSize();
      
      if (autoCenter) {
        if (activeDriver && drivers[activeDriver]) {
          const [lat, lng] = drivers[activeDriver].position;
          console.log(`Centering on active driver: ${activeDriver} at ${lat},${lng}`);
          map.setView([lat, lng], 15);
        } else if (Object.keys(drivers).length > 0) {
          // Calculate bounds for all drivers
          const positions = Object.values(drivers).map(d => d.position);
          if (positions.length > 0) {
            if (positions.length === 1) {
              // If only one driver, just center on them
              console.log(`Centering on single driver at ${positions[0]}`);
              map.setView(positions[0], 13);
            } else {
              // Create bounds and fit the map to them
              try {
                console.log(`Fitting bounds for ${positions.length} drivers`);
                const bounds = L.latLngBounds(positions);
                map.fitBounds(bounds, { padding: [50, 50] });
              } catch (e) {
                console.error("Error creating bounds:", e);
                map.setView(positions[0], 13);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error updating map view:", e);
      // Fallback to default position if there's an error
      map.setView([-7.2575, 112.7521], 13);
    }
  }, [activeDriver, drivers, map, autoCenter]);
  
  return null;
}

// Main monitoring app component
function App() {
  const [drivers, setDrivers] = useState({});
  const [connected, setConnected] = useState(false);
  const [activeDriver, setActiveDriver] = useState(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [socket, setSocket] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  
  // Add required CSS directly in a useEffect with higher priority
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
      .custom-truck-icon svg {
        filter: drop-shadow(1px 3px 5px rgba(0,0,0,0.6));
        transition: all 0.3s ease;
      }
      .custom-truck-icon:hover svg {
        transform: scale(1.3);
        filter: drop-shadow(2px 5px 8px rgba(0,0,0,0.7));
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(SERVER_URL);
    
    socketInstance.on('connect', () => {
      console.log('Connected to monitoring server');
      setConnected(true);
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Disconnected from monitoring server');
      setConnected(false);
    });
    
    socketInstance.on('driverData', (data) => {
      console.log('Received driver data:', data);
      setDrivers(prevDrivers => {
        const newDrivers = { ...prevDrivers };
        
        // Add or update driver
        if (data.location && data.location.coordinates && data.location.coordinates.length === 2) {
          const [longitude, latitude] = data.location.coordinates;
          newDrivers[data.deviceID] = {
            id: data.deviceID,
            position: [latitude, longitude],
            speed: data.speed || 0,
            heading: data.heading || 0,
            timestamp: data.timestamp,
            lastUpdate: new Date().toLocaleTimeString()
          };
        }
        
        return newDrivers;
      });
    });
    
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

  // Effect to handle map initialization
  useEffect(() => {
    // Force map to resize after the component has fully rendered
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
        setMapLoaded(true);
      }, 300);
    }
  }, [mapRef]);

  // Select a driver to focus on
  const handleDriverSelect = (driverId) => {
    setActiveDriver(driverId === activeDriver ? null : driverId);
  };

  // Format time elapsed since last update
  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - timestamp;
    
    if (elapsed < 60) return `${elapsed}s ago`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    return `${Math.floor(elapsed / 3600)}h ago`;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-gray-900 text-white flex flex-col shadow-2xl border-r border-gray-800 rounded-r-3xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 rounded-b-3xl shadow-lg flex flex-col gap-2 border-b-2 border-blue-800">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 drop-shadow-lg">
              <Truck className="text-blue-300" size={24} />
              Driver Monitoring
            </h1>
            <div className="flex items-center">
              {connected ? 
                <Wifi className="text-green-400 mr-1 animate-pulse" size={18} /> : 
                <WifiOff className="text-red-400 mr-1" size={18} />
              }
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Users className="inline mr-1" size={14} />
            <span>{Object.keys(drivers).length} aktif</span>
          </div>
        </div>
        {/* Driver list */}
        <div className="flex-grow overflow-auto bg-gray-800 px-4 py-5 custom-scrollbar">
          <h2 className="text-lg font-semibold mb-4 text-blue-200 flex items-center gap-2 border-b border-blue-700 pb-2">
            <Truck size={18} /> Daftar Driver
          </h2>
          {Object.keys(drivers).length === 0 && (
            <div className="bg-gray-700 rounded-xl p-4 text-center text-gray-400 text-sm shadow-inner">
              Tidak ada driver aktif
            </div>
          )}
          <div className="space-y-3">
            {Object.entries(drivers).map(([id, driver]) => (
              <div 
                key={id}
                className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${activeDriver === id ? 'bg-blue-700 border-blue-400 shadow-xl scale-105' : 'bg-gray-700 hover:bg-blue-800 border-transparent hover:scale-105'} group`}
                onClick={() => handleDriverSelect(id)}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold text-base truncate group-hover:text-blue-200 transition-colors duration-150">{id}</div>
                  <div className="text-xs text-gray-300 flex items-center gap-1">
                    <Clock size={12} />
                    {getTimeElapsed(driver.timestamp)}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-200">
                  <div className="flex items-center gap-1">
                    <MapPin size={13} className="text-blue-300" />
                    {driver.position[0].toFixed(4)}, {driver.position[1].toFixed(4)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Navigation size={13} className="text-blue-300" />
                    {driver.speed ? (driver.speed * 3.6).toFixed(1) + ' km/h' : 'Idle'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Controls */}
        <div className="p-5 bg-gradient-to-r from-blue-800 to-blue-900 border-t border-blue-700 flex flex-col gap-2">
          <button 
            className="flex items-center justify-center w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-xl font-semibold shadow-lg transition-all gap-2 text-base"
            onClick={() => setAutoCenter(!autoCenter)}
          >
            <RefreshCw size={18} className={`${autoCenter ? 'animate-spin' : ''}`} />
            {autoCenter ? 'Auto-Center AKTIF' : 'Auto-Center MATI'}
          </button>
        </div>
      </div>
      
      {/* Map */}
      <div className="map-wrapper">
        {/* Add a clear height and width to the map container */}
        <MapContainer 
          center={[-7.2575, 112.7521]} 
          zoom={13} 
          style={{ width: '100%', height: '100%', position: 'relative' }}
          whenReady={(map) => {
            mapRef.current = map.target;
            setTimeout(() => {
              mapRef.current.invalidateSize();
              setMapLoaded(true);
            }, 100);
          }}
        >
          <TileLayer
            attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {Object.entries(drivers).map(([id, driver]) => (
            <Marker 
              key={id}
              position={driver.position}
              icon={createCustomIcon(activeDriver === id ? '#2563eb' : '#4b5563', driver.heading)}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-bold">{id}</div>
                  <div className="text-sm mt-1">Speed: {(driver.speed * 3.6).toFixed(1)} km/h</div>
                  <div className="text-sm">Last Update: {driver.lastUpdate}</div>
                  <div className="text-sm">Heading: {driver.heading}°</div>
                </div>
              </Popup>
            </Marker>
          ))}
          
          <MapController 
            activeDriver={activeDriver} 
            drivers={drivers} 
            autoCenter={autoCenter} 
          />
        </MapContainer>
      </div>
    </div>
  );
}

export default App;