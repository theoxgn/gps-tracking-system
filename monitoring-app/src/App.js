import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import { 
  Truck, 
  Users, 
  Clock, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  MapPin, 
  Navigation,
  Route as RouteIcon
} from 'lucide-react';
import MonitorChatComponent from './MonitorChatComponent';
import MonitorRouteMap from './components/MonitorRouteMap';
import L from 'leaflet';

// =================== Constants ===================
const SERVER_URL = process.env.REACT_APP_API_URL;
const DEFAULT_MAP_CENTER = [-7.2575, 112.7521];
const DEFAULT_MAP_ZOOM = 13;

// =================== Utilities ===================
// Fix for default marker icons in Leaflet with React
const setupLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
  });
};

// Initialize icons
setupLeafletIcons();

// Creates a custom icon with rotation for direction
const createCustomIcon = (color, heading = 0) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1); transform: rotate(${heading}deg);">
            <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
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

// Format speed from m/s to km/h
const formatSpeed = (speedMps) => {
  return speedMps ? (speedMps * 3.6).toFixed(1) + ' km/h' : 'Idle';
};

// Injects required leaflet styles to document
const injectLeafletStyles = () => {
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
    .custom-div-icon {
      transition: transform 0.2s ease;
    }
    .custom-div-icon:hover {
      transform: scale(1.2);
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
      [style*="width: 320px"] {
        width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  return () => {
    document.head.removeChild(style);
  };
};

// =================== Components ===================

// Component to display a single driver in the list
const DriverItem = ({ driver, isActive, onClick, hasRoute }) => {
  return (
    <div 
      className={`p-4 rounded-xl cursor-pointer transition-all border ${isActive ? 'bg-blue-500 text-white border-blue-400 shadow-md' : 'bg-slate-100 hover:bg-blue-50 border-transparent'} group`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="font-bold text-base truncate">{driver.id}</div>
        <div className={`text-xs ${isActive ? 'text-blue-100' : 'text-slate-500'} flex items-center gap-1`}>
          <Clock size={12} />
          {getTimeElapsed(driver.timestamp)}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <MapPin size={13} className={isActive ? 'text-blue-100' : 'text-blue-500'} />
          {driver.position[0].toFixed(4)}, {driver.position[1].toFixed(4)}
        </div>
        <div className="flex items-center gap-1">
          <Navigation size={13} className={isActive ? 'text-blue-100' : 'text-blue-500'} />
          {formatSpeed(driver.speed)}
        </div>
      </div>
      
      {/* Route indicator badge */}
      {hasRoute && (
        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isActive ? 'bg-blue-400 text-white' : 'bg-blue-100 text-blue-600'}`}>
          <RouteIcon size={12} />
          Active Route
        </div>
      )}
    </div>
  );
};

// Component to display the list of drivers
const DriversList = ({ drivers, activeDriver, onDriverSelect, driverRoutes }) => {
  return (
    <div className="flex-grow overflow-auto bg-white px-4 py-5 custom-scrollbar">
      <h2 className="text-lg font-semibold mb-4 text-blue-500 flex items-center gap-2 border-b border-slate-200 pb-2">
        <Truck size={18} /> Daftar Driver
      </h2>
      {Object.keys(drivers).length === 0 && (
        <div className="bg-slate-100 rounded-xl p-4 text-center text-slate-500 text-sm shadow-inner">
          Tidak ada driver aktif
        </div>
      )}
      <div className="space-y-3">
        {Object.entries(drivers).map(([id, driver]) => (
          <DriverItem 
            key={id}
            driver={driver}
            isActive={activeDriver === id}
            onClick={() => onDriverSelect(id)}
            hasRoute={Boolean(driverRoutes[id])}
          />
        ))}
      </div>
    </div>
  );
};

// Component for the sidebar
const Sidebar = ({ 
  drivers, 
  connected, 
  activeDriver, 
  autoCenter, 
  onDriverSelect, 
  onToggleAutoCenter, 
  driverRoutes,
  updateDriverRoute  // Changed from setDriverRoutes to updateDriverRoute
}) => {
  return (
    <div style={{ width: '320px' }} className="bg-white text-slate-700 flex flex-col shadow-lg border-r border-slate-200 overflow-hidden">
      <div className="bg-blue-500 p-4 shadow-md flex flex-col gap-2">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Truck className="text-white" size={20} />
            Driver Monitoring
          </h1>
          <div className="flex items-center">
            {connected ? 
              <Wifi className="text-green-300 mr-1 animate-pulse" size={16} /> : 
              <WifiOff className="text-red-300 mr-1" size={16} />
            }
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white">
          <Users className="inline mr-1" size={14} />
          <span>{Object.keys(drivers).length} aktif</span>
        </div>
      </div>
      
      <DriversList 
        drivers={drivers}
        activeDriver={activeDriver}
        onDriverSelect={onDriverSelect}
        driverRoutes={driverRoutes}
      />
      
      {/* Display route information when a driver with route is selected */}
      {activeDriver && driverRoutes[activeDriver] && (
        <div className="p-4 bg-blue-50 rounded-lg mx-4 mb-4 border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-700 mb-2">Route Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-blue-500 font-medium">Distance</div>
              <div>{driverRoutes[activeDriver].distance?.toFixed(2) || '?'} km</div>
            </div>
            <div>
              <div className="text-blue-500 font-medium">Duration</div>
              <div>{driverRoutes[activeDriver].duration || '?'} minutes</div>
            </div>
            <div className="col-span-2">
              <div className="text-blue-500 font-medium">From</div>
              <div className="truncate">{driverRoutes[activeDriver].startPoint[0].toFixed(6)}, {driverRoutes[activeDriver].startPoint[1].toFixed(6)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-blue-500 font-medium">To</div>
              <div className="truncate">{driverRoutes[activeDriver].endPoint[0].toFixed(6)}, {driverRoutes[activeDriver].endPoint[1].toFixed(6)}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Test button to create route manually */}
      {activeDriver && (
        <div className="mt-3 px-4 pb-4">
          <button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg shadow text-sm"
            onClick={() => {
              if (!drivers[activeDriver]) return;
              
              console.log('Creating test route for driver:', activeDriver);
              
              // Get driver's position
              const pos = drivers[activeDriver].position;
              
              // Create test route - simple path with a few points
              const testRoute = {
                deviceID: activeDriver,
                startPoint: pos,
                endPoint: [pos[0] + 0.01, pos[1] + 0.01], // ~1km northeast
                routeGeometry: [
                  pos,
                  [pos[0] + 0.002, pos[1] + 0.003],
                  [pos[0] + 0.005, pos[1] + 0.006],
                  [pos[0] + 0.008, pos[1] + 0.009],
                  [pos[0] + 0.01, pos[1] + 0.01]
                ],
                distance: 1.5,
                duration: 5,
                timestamp: Date.now()
              };
              
              // Log the test route
              console.log('Test route data:', testRoute);
              
              // Update the driver route
              updateDriverRoute(activeDriver, testRoute);
            }}
          >
            Test Route Display
          </button>
        </div>
      )}
      
      <div className="p-5 bg-slate-100 border-t border-slate-200 flex flex-col gap-2">
        <button 
          className="flex items-center justify-center w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-xl font-semibold shadow transition-all gap-2 text-base"
          onClick={onToggleAutoCenter}
        >
          <RefreshCw size={18} className={`${autoCenter ? 'animate-spin' : ''}`} />
          {autoCenter ? 'Auto-Center AKTIF' : 'Auto-Center MATI'}
        </button>
      </div>
    </div>
  );
};

// Component for a single driver marker on the map
const DriverMarker = ({ id, driver, isActive }) => {
  return (
    <Marker 
      key={id}
      position={driver.position}
      icon={createCustomIcon(isActive ? '#3b82f6' : '#64748b', driver.heading)}
    >
      <Popup>
        <div className="text-center">
          <div className="font-bold">{id}</div>
          <div className="text-sm mt-1">Speed: {formatSpeed(driver.speed)}</div>
          <div className="text-sm">Last Update: {driver.lastUpdate}</div>
          <div className="text-sm">Heading: {driver.heading}°</div>
        </div>
      </Popup>
    </Marker>
  );
};

// Component to handle map controls and updates
const MapController = ({ activeDriver, drivers, autoCenter }) => {
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
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    }
  }, [activeDriver, drivers, map, autoCenter]);
  
  return null;
};

// =================== Custom Hooks ===================

// Hook to manage socket connections and driver data
const useDrivers = () => {
  const [drivers, setDrivers] = useState({});
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [driverRoutes, setDriverRoutes] = useState({});
  
  // Initialize socket connection
  useEffect(() => {
    const socketInstance = io(SERVER_URL);
    
    socketInstance.on('connect', () => {
      console.log('Connected to monitoring server');
      setConnected(true);
      // Identify as monitor to the server
      socketInstance.emit('identify', {
        type: 'monitor'
      });
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
    
    // Add a specific debug listener for route updates
    socketInstance.on('driverRouteUpdate', (routeData) => {
      if (!routeData || !routeData.deviceID) {
        console.warn('Received invalid route data:', routeData);
        return;
      }
      
      console.log('✅ Received route update for driver:', routeData.deviceID);
      console.log('Route details:', {
        hasGeometry: Boolean(routeData.routeGeometry),
        geometryType: routeData.routeGeometry ? typeof routeData.routeGeometry : 'N/A',
        geometryLength: Array.isArray(routeData.routeGeometry) ? routeData.routeGeometry.length : 'N/A',
        startPoint: routeData.startPoint,
        endPoint: routeData.endPoint,
        distance: routeData.distance,
        duration: routeData.duration
      });
      
      // Ensure routeGeometry is an array even if it's missing
      if (!routeData.routeGeometry || !Array.isArray(routeData.routeGeometry)) {
        console.warn('Invalid routeGeometry, using fallback straight line');
        if (routeData.startPoint && routeData.endPoint) {
          routeData.routeGeometry = [routeData.startPoint, routeData.endPoint];
        } else {
          routeData.routeGeometry = [];
        }
      }
      
      setDriverRoutes(prevRoutes => ({
        ...prevRoutes,
        [routeData.deviceID]: routeData
      }));
    });
    
    // Add a debug listener for when route requests are sent
    const originalEmit = socketInstance.emit;
    socketInstance.emit = function(eventName, ...args) {
      if (eventName === 'requestDriverRoute') {
        console.log('🔍 Requesting route for driver:', args[0]?.driverId);
      }
      return originalEmit.apply(this, [eventName, ...args]);
    };
    
    setSocket(socketInstance);
    
    return () => {
      if (socketInstance) socketInstance.disconnect();
    };
  }, []);

  return { drivers, connected, socket, driverRoutes, setDriverRoutes };
};

// =================== Main Component ===================

function App() {
  const { drivers, connected, socket, driverRoutes, setDriverRoutes } = useDrivers();
  const [activeDriver, setActiveDriver] = useState(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  
  // Add required CSS directly in a useEffect
  useEffect(() => {
    const cleanup = injectLeafletStyles();
    return cleanup;
  }, []);

  // Effect to handle map initialization
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
        setMapLoaded(true);
      }, 300);
    }
  }, [mapRef]);

  // Effect to request route data when selecting a driver
  useEffect(() => {
    if (socket && activeDriver) {
      console.log('Requesting route for driver:', activeDriver);
      socket.emit('requestDriverRoute', { driverId: activeDriver });
      
      // Add debug log to check if route data exists
      if (driverRoutes[activeDriver]) {
        console.log('Current route data for this driver:', driverRoutes[activeDriver]);
      } else {
        console.log('No route data available for this driver yet');
      }
    }
  }, [activeDriver, socket, driverRoutes]);

  // Select a driver to focus on
  const handleDriverSelect = (driverId) => {
    // Toggle selection if clicking the same driver
    setActiveDriver(driverId === activeDriver ? null : driverId);
  };

  // Toggle auto-center functionality
  const handleToggleAutoCenter = () => {
    setAutoCenter(!autoCenter);
  };
  
  // Function to manually update a driver's route (for testing)
  const updateDriverRoute = (driverId, routeData) => {
    console.log('Updating route for driver:', driverId);
    
    setDriverRoutes(prev => ({
      ...prev,
      [driverId]: routeData
    }));
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        drivers={drivers}
        connected={connected}
        activeDriver={activeDriver}
        autoCenter={autoCenter}
        onDriverSelect={handleDriverSelect}
        onToggleAutoCenter={handleToggleAutoCenter}
        driverRoutes={driverRoutes}
        updateDriverRoute={updateDriverRoute}
      />
      
      {/* Map */}
      <div className="map-wrapper">
        <MapContainer 
          center={DEFAULT_MAP_CENTER} 
          zoom={DEFAULT_MAP_ZOOM} 
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
          
          {/* Driver markers */}
          {Object.entries(drivers).map(([id, driver]) => (
            <DriverMarker 
              key={id}
              id={id}
              driver={driver}
              isActive={activeDriver === id}
            />
          ))}
          
          {/* Direct test route for debugging */}
          {activeDriver && drivers[activeDriver] && (
            <Polyline
              positions={[
                drivers[activeDriver].position,
                [
                  drivers[activeDriver].position[0] + 0.01, 
                  drivers[activeDriver].position[1] + 0.01
                ]
              ]}
              color="red"
              weight={5}
              opacity={0.7}
              dashArray="5, 5"
            />
          )}
          
          {/* Display selected driver's route with better validation */}
          {activeDriver && driverRoutes[activeDriver] && (
            <>
              {console.log('Rendering route for', activeDriver, 
                `geometry points: ${Array.isArray(driverRoutes[activeDriver].routeGeometry) ? 
                  driverRoutes[activeDriver].routeGeometry.length : 'not an array'}`
              )}
              
              {/* Only try to render if we have valid route data */}
              {Array.isArray(driverRoutes[activeDriver].routeGeometry) && 
              driverRoutes[activeDriver].routeGeometry.length >= 2 ? (
                <MonitorRouteMap
                  routeData={driverRoutes[activeDriver].routeGeometry}
                  startPoint={driverRoutes[activeDriver].startPoint}
                  endPoint={driverRoutes[activeDriver].endPoint}
                  fitRoute={true}
                />
              ) : (
                // If we don't have valid route data but have start/end points, render a simple line
                driverRoutes[activeDriver].startPoint && driverRoutes[activeDriver].endPoint ? (
                  <Polyline
                    positions={[
                      driverRoutes[activeDriver].startPoint,
                      driverRoutes[activeDriver].endPoint
                    ]}
                    color="#3b82f6"
                    weight={4}
                    opacity={0.7}
                    dashArray="10, 10"
                  />
                ) : null
              )}
            </>
          )}
          
          <MapController 
            activeDriver={activeDriver} 
            drivers={drivers} 
            autoCenter={autoCenter} 
          />
        </MapContainer>
        
        <MonitorChatComponent 
          socket={socket} 
          drivers={drivers} 
          activeDriver={activeDriver} 
          connected={connected} 
        />
        
        {/* Debug message when a driver is selected but has invalid route data */}
        {activeDriver && driverRoutes[activeDriver] && !(
          Array.isArray(driverRoutes[activeDriver].routeGeometry) && 
          driverRoutes[activeDriver].routeGeometry.length >= 2
        ) && !(
          driverRoutes[activeDriver].startPoint && driverRoutes[activeDriver].endPoint
        ) && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '10px',
            border: '1px solid red',
            borderRadius: '5px',
            zIndex: 1000
          }}>
            ⚠️ Invalid route data for driver {activeDriver}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;