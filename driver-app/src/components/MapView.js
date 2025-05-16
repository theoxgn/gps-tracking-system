import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DetailedRouteMap from './DetailedRouteMap';
import MapController from './MapController';

// Fungsi untuk membuat custom icon
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 20.25 12 36 12 36C12 36 24 20.25 24 12C24 5.37 18.63 0 12 0ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5C14.49 7.5 16.5 9.51 16.5 12C16.5 14.49 14.49 16.5 12 16.5Z" fill="${color}"/>
      </svg>
    `,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36]
  });
};

// Fix for Leaflet icon issues
const fixLeafletIcons = () => {
  delete L.Icon.Default.prototype._getIconUrl;
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.4/images/marker-shadow.png',
  });
};

/**
 * Komponen MapView untuk menampilkan peta dan rute
 */
const MapView = ({
  position,
  driverId,
  lastUpdate,
  speed,
  heading,
  startPoint, 
  endPoint,
  transportMode,
  preferTollRoads = true, // Default value jika tidak diberikan
  onRouteCalculated
}) => {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  
  // Fix Leaflet icons on mount
  useEffect(() => {
    fixLeafletIcons();
  }, []);
  
  // Ensure the map is properly sized
  useEffect(() => {
    if (mapRef.current && mapReady) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 200);
    }
  }, [mapReady]);
  
  // Handle map initialization
  const handleMapReady = (map) => {
    mapRef.current = map.target;
    setMapReady(true);
  };
  
  return (
    <div className="map-wrapper" style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer 
        center={position || [-6.2088, 106.8456]} // Default to Jakarta if no position
        zoom={15} 
        style={{ height: "100%", width: "100%" }}
        whenReady={handleMapReady}
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
        
        {/* Route line and detailed route */}
        {mapReady && startPoint && endPoint && (
          <DetailedRouteMap 
            startPoint={startPoint} 
            endPoint={endPoint} 
            transportMode={transportMode}
            preferTollRoads={preferTollRoads}
            onRouteCalculated={onRouteCalculated}
          />
        )}
        
        {/* Map controller for view centering */}
        {position && mapReady && (
          <MapController position={position} />
        )}
      </MapContainer>
    </div>
  );
};

export default MapView;