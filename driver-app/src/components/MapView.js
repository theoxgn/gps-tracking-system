import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import ChatComponent from '../ChatComponent';
import { RouteLine, MapController } from './MapComponents';
import { createCustomIcon } from '../utils/mapUtils';
import { styles } from '../styles';

/**
 * Map view component that displays the map and related markers
 */
const MapView = ({
  position,
  startPoint,
  endPoint,
  driverId,
  speed,
  heading,
  lastUpdate,
  socket,
  connected,
  mapRef
}) => {
  return (
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
  );
};

export default MapView;