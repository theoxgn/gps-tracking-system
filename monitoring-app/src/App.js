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
  Route as RouteIcon,
  Activity,
  Target,
  Eye,
  MapPinned
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

// Styles object to match driver app
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#f8fafc'
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  brandTitle: {
    fontSize: '18px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#1e293b'
  },
  navTabs: {
    display: 'flex',
    gap: '16px'
  },
  navTab: {
    padding: '6px 12px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  navTabActive: {
    backgroundColor: '#f1f5f9',
    color: '#3b82f6'
  },
  navTabInactive: {
    color: '#64748b'
  },
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  sidebarContent: {
    flex: 1,
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
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px'
  },
  card: {
    padding: '16px',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    marginBottom: '12px',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: '1px solid #e2e8f0'
  },
  cardActive: {
    backgroundColor: '#3b82f6',
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
    color: '#64748b',
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
    color: '#475569'
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  infoIcon: {
    color: '#3b82f6'
  },
  routeBadge: {
    marginTop: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  routeBadgeActive: {
    backgroundColor: '#dcfce7',
    color: '#16a34a'
  },
  routeBadgeInactive: {
    backgroundColor: '#f1f5f9',
    color: '#64748b'
  },
  controlsSection: {
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    gap: '8px',
    fontSize: '16px'
  },
  buttonHover: {
    backgroundColor: '#2563eb'
  },
  mapContainer: {
    flex: 1,
    position: 'relative'
  },
  bottomPanels: {
    display: 'flex',
    padding: '16px',
    gap: '16px',
    backgroundColor: '#ffffff',
    borderTop: '1px solid #e2e8f0'
  },
  bottomPanel: {
    flex: 1,
    padding: '16px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  panelContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontSize: '14px',
    color: '#475569'
  },
  statusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusValue: {
    fontWeight: '500'
  }
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
  const cardStyle = {
    ...styles.card,
    ...(isActive ? styles.cardActive : {})
  };
  
  const timeStyle = {
    ...styles.cardTime,
    ...(isActive ? { color: 'rgba(255,255,255,0.8)' } : {})
  };
  
  const gridStyle = {
    ...styles.cardGrid,
    ...(isActive ? { color: 'rgba(255,255,255,0.9)' } : {})
  };

  return (
    <div style={cardStyle} onClick={onClick}>
      <div style={styles.cardHeader}>
        <div style={styles.cardTitle}>{driver.id}</div>
        <div style={timeStyle}>
          <Clock size={12} />
          {getTimeElapsed(driver.timestamp)}
        </div>
      </div>
      <div style={gridStyle}>
        <div style={styles.infoItem}>
          <MapPin size={13} style={{color: isActive ? 'rgba(255,255,255,0.8)' : '#3b82f6'}} />
          {driver.position[0].toFixed(4)}, {driver.position[1].toFixed(4)}
        </div>
        <div style={styles.infoItem}>
          <Navigation size={13} style={{color: isActive ? 'rgba(255,255,255,0.8)' : '#3b82f6'}} />
          {formatSpeed(driver.speed)}
        </div>
      </div>
      
      {/* Route indicator badge */}
      {hasRoute && (
        <div style={{
          ...styles.routeBadge,
          ...(isActive ? 
            { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' } : 
            styles.routeBadgeActive
          )
        }}>
          <RouteIcon size={12} />
          Rute Aktif
        </div>
      )}
    </div>
  );
};

// Component to display the list of drivers
const DriversList = ({ drivers, activeDriver, onDriverSelect, driverRoutes }) => {
  return (
    <>
      <div style={styles.sectionTitle}>
        <Truck size={18} /> Daftar Driver
      </div>
      {Object.keys(drivers).length === 0 && (
        <div style={{
          ...styles.card,
          textAlign: 'center',
          color: '#64748b',
          fontStyle: 'italic'
        }}>
          Tidak ada driver aktif
        </div>
      )}
      <div style={{marginBottom: '16px'}}>
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
    </>
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
  driverRoutes
}) => {
  return (
    <div style={styles.sidebar}>
      {/* Sidebar Content */}
      <div style={styles.sidebarContent} className="custom-scrollbar">
        <DriversList 
          drivers={drivers}
          activeDriver={activeDriver}
          onDriverSelect={onDriverSelect}
          driverRoutes={driverRoutes}
        />
        
        {/* Driver Statistics */}
        <div style={styles.sectionTitle}>
          <Activity size={18} /> Statistik Driver
        </div>
        
        <div style={{...styles.card, backgroundColor: '#f0f9ff', borderColor: '#bae6fd'}}>
          <div style={{...styles.statusItem, marginBottom: '8px'}}>
            <Users size={16} style={{color: '#0284c7'}} />
            <span>Total Driver Aktif:</span>
            <span style={{...styles.statusValue, color: '#0284c7'}}>
              {Object.keys(drivers).length}
            </span>
          </div>
          <div style={styles.statusItem}>
            <RouteIcon size={16} style={{color: '#0284c7'}} />
            <span>Driver dengan Rute:</span>
            <span style={{...styles.statusValue, color: '#0284c7'}}>
              {Object.keys(driverRoutes).length}
            </span>
          </div>
        </div>
        
        {/* Display route information when a driver with route is selected */}
        {activeDriver && driverRoutes[activeDriver] && (
          <>
            <div style={styles.sectionTitle}>
              <MapPinned size={18} /> Informasi Rute
            </div>
            <div style={{...styles.card, backgroundColor: '#f0f9ff', borderColor: '#bae6fd'}}>
              <div style={{...styles.cardGrid, color: '#0f172a'}}>
                <div>
                  <div style={{color: '#0284c7', fontWeight: '500', marginBottom: '4px'}}>Jarak</div>
                  <div style={styles.statusValue}>{driverRoutes[activeDriver].distance?.toFixed(2) || '?'} km</div>
                </div>
                <div>
                  <div style={{color: '#0284c7', fontWeight: '500', marginBottom: '4px'}}>Durasi</div>
                  <div style={styles.statusValue}>{driverRoutes[activeDriver].duration || '?'} menit</div>
                </div>
              </div>
              <div style={{marginTop: '12px'}}>
                <div style={{color: '#0284c7', fontWeight: '500', marginBottom: '4px'}}>Status Rute</div>
                <div style={{fontSize: '14px'}}>
                  {Array.isArray(driverRoutes[activeDriver].routeGeometry) && 
                   driverRoutes[activeDriver].routeGeometry.length >= 2 ? (
                    <span style={{color: '#16a34a'}}>✓ Rute aktif dengan {driverRoutes[activeDriver].routeGeometry.length} titik</span>
                  ) : (
                    <span style={{color: '#ea580c'}}>⚠ Rute sederhana</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Controls */}
      <div style={styles.controlsSection}>
        <button 
          style={{
            ...styles.button,
            backgroundColor: autoCenter ? '#16a34a' : '#6b7280'
          }}
          onClick={onToggleAutoCenter}
        >
          <RefreshCw size={18} style={{
            animation: autoCenter ? 'spin 1s linear infinite' : 'none'
          }} />
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
        <div style={{textAlign: 'center', padding: '4px'}}>
          <div style={{fontWeight: 'bold', color: '#3b82f6'}}>{id}</div>
          <div style={{fontSize: '14px', marginTop: '4px'}}>Kecepatan: {formatSpeed(driver.speed)}</div>
          <div style={{fontSize: '14px'}}>Update: {driver.lastUpdate}</div>
          <div style={{fontSize: '14px'}}>Arah: {driver.heading}°</div>
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
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  
  // Update view when active driver changes or when drivers update
  useEffect(() => {
    if (!map) return;
    
    try {
      // Force map to redraw first
      map.invalidateSize();
      
      if (autoCenter) {
        if (activeDriver && drivers[activeDriver]) {
          const [lat, lng] = drivers[activeDriver].position;
          map.setView([lat, lng], 15);
        } else if (Object.keys(drivers).length > 0) {
          // Calculate bounds for all drivers
          const positions = Object.values(drivers).map(d => d.position);
          if (positions.length > 0) {
            if (positions.length === 1) {
              // If only one driver, just center on them
              map.setView(positions[0], 13);
            } else {
              // Create bounds and fit the map to them
              try {
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
    
    // Handle route updates
    socketInstance.on('driverRouteUpdate', (routeData) => {
      if (!routeData || !routeData.deviceID) {
        return;
      }
      
      // Ensure routeGeometry is an array even if it's missing
      if (!routeData.routeGeometry || !Array.isArray(routeData.routeGeometry)) {
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
      socket.emit('requestDriverRoute', { driverId: activeDriver });
    }
  }, [activeDriver, socket]);

  // Select a driver to focus on
  const handleDriverSelect = (driverId) => {
    // Toggle selection if clicking the same driver
    setActiveDriver(driverId === activeDriver ? null : driverId);
  };

  // Toggle auto-center functionality
  const handleToggleAutoCenter = () => {
    setAutoCenter(!autoCenter);
  };

  // Get active driver count for status
  const getActiveDriverCount = () => {
    return Object.keys(drivers).length;
  };

  // Get driver with route count
  const getDriversWithRouteCount = () => {
    return Object.keys(driverRoutes).length;
  };

  return (
    <div style={styles.container}>
      {/* Header Navigation */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brandTitle}>
            <Truck size={22} style={{ color: '#3b82f6' }} />
            TrackMaster
          </div>
          
          <div style={styles.navTabs}>
            <div style={{
              ...styles.navTab,
              ...styles.navTabInactive
            }}>
              Driver App
            </div>
            <div style={{
              ...styles.navTab,
              ...styles.navTabActive
            }}>
              Monitoring App
            </div>
          </div>
        </div>
        
        {/* Connection Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: connected ? '#16a34a' : '#dc2626'
        }}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connected ? 'Terhubung' : 'Terputus'}
        </div>
      </div>
      
      {/* Main Content Area */}
      <div style={styles.mainContent}>
        {/* Sidebar */}
        <Sidebar 
          drivers={drivers}
          connected={connected}
          activeDriver={activeDriver}
          autoCenter={autoCenter}
          onDriverSelect={handleDriverSelect}
          onToggleAutoCenter={handleToggleAutoCenter}
          driverRoutes={driverRoutes}
        />
        
        {/* Main Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Map Container */}
          <div style={styles.mapContainer}>
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
              
              {/* Display selected driver's route with proper validation */}
              {activeDriver && driverRoutes[activeDriver] && (
                Array.isArray(driverRoutes[activeDriver].routeGeometry) && 
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
                )
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
          </div>
          
          {/* Bottom Info Panels */}
          <div style={styles.bottomPanels}>
            {/* System Status */}
            <div style={styles.bottomPanel}>
              <div style={styles.panelTitle}>
                <Activity size={18} />
                Status Sistem
              </div>
              
              <div style={styles.panelContent}>
                {/* Connection Status */}
                <div style={styles.statusItem}>
                  {connected ? 
                    <Wifi size={16} color="#16a34a" /> : 
                    <WifiOff size={16} color="#dc2626" />
                  }
                  <span>Status Koneksi:</span>
                  <span style={{
                    ...styles.statusValue,
                    color: connected ? '#16a34a' : '#dc2626'
                  }}>
                    {connected ? 'Terhubung' : 'Terputus'}
                  </span>
                </div>
                
                {/* Active Drivers */}
                <div style={styles.statusItem}>
                  <Users size={16} color="#3b82f6" />
                  <span>Driver Aktif:</span>
                  <span style={{...styles.statusValue, color: '#3b82f6'}}>
                    {getActiveDriverCount()} driver
                  </span>
                </div>
                
                {/* Auto Center Status */}
                <div style={styles.statusItem}>
                  <Target size={16} color={autoCenter ? '#16a34a' : '#6b7280'} />
                  <span>Auto-Center:</span>
                  <span style={{
                    ...styles.statusValue,
                    color: autoCenter ? '#16a34a' : '#6b7280'
                  }}>
                    {autoCenter ? 'Aktif' : 'Tidak Aktif'}
                  </span>
                </div>
                
                {/* Selected Driver */}
                <div style={styles.statusItem}>
                  <Eye size={16} color="#3b82f6" />
                  <span>Driver Dipilih:</span>
                  <span style={styles.statusValue}>
                    {activeDriver || 'Tidak ada'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Monitoring Statistics */}
            <div style={styles.bottomPanel}>
              <div style={styles.panelTitle}>
                <MapPinned size={18} />
                Statistik Monitoring
              </div>
              
              <div style={styles.panelContent}>
                {/* Total Drivers */}
                <div style={styles.statusItem}>
                  <Truck size={16} color="#3b82f6" />
                  <span>Total Driver:</span>
                  <span style={{...styles.statusValue, color: '#3b82f6'}}>
                    {getActiveDriverCount()} aktif
                  </span>
                </div>
                
                {/* Drivers with Routes */}
                <div style={styles.statusItem}>
                  <RouteIcon size={16} color="#16a34a" />
                  <span>Driver dengan Rute:</span>
                  <span style={{...styles.statusValue, color: '#16a34a'}}>
                    {getDriversWithRouteCount()} driver
                  </span>
                </div>
                
                {/* Map Center */}
                <div style={styles.statusItem}>
                  <MapPin size={16} color="#3b82f6" />
                  <span>Pusat Peta:</span>
                  <span style={styles.statusValue}>
                    {activeDriver ? 
                      `Driver ${activeDriver}` : 
                      'Semua Driver'
                    }
                  </span>
                </div>
                
                {/* Last Update */}
                <div style={styles.statusItem}>
                  <Clock size={16} color="#3b82f6" />
                  <span>Update Terakhir:</span>
                  <span style={styles.statusValue}>
                    {new Date().toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;