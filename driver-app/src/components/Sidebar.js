import React from 'react';
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
import { styles } from '../styles';
import PlacesAutocomplete from './PlacesAutocomplete';

/**
 * Sidebar component containing all driver controls and info
 */
const Sidebar = ({
  driverId,
  handleDriverIdChange,
  connected,
  watchId,
  position,
  lastUpdate,
  speed,
  heading,
  startTracking,
  stopTracking,
  buttonHover,
  setButtonHover,
  error,
  startPoint,
  endPoint,
  routeDistance,
  routeDuration,
  useToll,
  setUseToll,
  nearestStartTollGate,
  nearestEndTollGate,
  estimatedTollCost,
  vehicleClass,
  setVehicleClass,
  calculateRouteInfo,
  isScriptLoaded,
  startAddress,
  handleStartAddressChange,
  handleStartLocationSelect,
  setCurrentAsStart,
  endAddress,
  handleEndAddressChange,
  handleEndLocationSelect,
  setError,
  clearRoute
}) => {
  // Helper components for Sidebar sections
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
  );

  return (
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
  );
};

export default Sidebar;