import React, { useEffect, useState } from 'react';
import { Polyline, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { getOsrmRoute, transportModeToProfile, getDirectRoute } from '../services/osrmRouteService';

/**
 * Component to display a driver's route on the monitor map using OSRM routing
 * @param {Object} props - Component props 
 * @param {Array} props.routeData - Route geometry coordinates [[lat, lng], ...] (optional)
 * @param {Array} props.startPoint - Starting point coordinates [lat, lng]
 * @param {Array} props.endPoint - Ending point coordinates [lat, lng]
 * @param {String} props.transportMode - Transport mode (car, bike, foot)
 * @param {Boolean} props.fitRoute - Whether to fit the map to the route bounds
 * @param {Boolean} props.useOsrm - Whether to use OSRM routing (true) or direct line (false)
 */
const MonitorRouteMap = ({ 
  routeData, 
  startPoint, 
  endPoint,
  transportMode = 'car',
  fitRoute = true,
  useOsrm = true
}) => {
  const map = useMap();
  const [routeGeometry, setRouteGeometry] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Fetch route from OSRM when points change
  useEffect(() => {
    let isMounted = true;
    
    const fetchRouteFromOSRM = async () => {
      // Skip if we don't have both points
      if (!startPoint || !endPoint) {
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        if (useOsrm) {
          // Use OSRM to get the route
          console.log('🛣️ Fetching route from OSRM between:', startPoint, 'and', endPoint);
          
          // Convert transport mode to OSRM profile
          const profile = transportModeToProfile(transportMode);
          
          const osrmRoute = await getOsrmRoute(startPoint, endPoint, profile);
          
          if (isMounted) {
            if (osrmRoute.success) {
              console.log('✅ OSRM route received with', osrmRoute.geometry.length, 'points');
              setRouteGeometry(osrmRoute.geometry);
              
              // Fit map to the route bounds if requested
              if (fitRoute && map && osrmRoute.geometry.length > 0) {
                try {
                  const bounds = L.latLngBounds(osrmRoute.geometry);
                  map.fitBounds(bounds, { padding: [50, 50] });
                } catch (error) {
                  console.error('❌ Error fitting bounds to route:', error);
                  
                  // Fallback - fit to start and end points
                  const bounds = L.latLngBounds([startPoint, endPoint]);
                  map.fitBounds(bounds, { padding: [50, 50] });
                }
              }
            } else {
              console.error('❌ Failed to get OSRM route:', osrmRoute.error);
              setError(osrmRoute.error);
              
              // Fallback to straight line
              const directRoute = getDirectRoute(startPoint, endPoint);
              setRouteGeometry(directRoute.geometry);
            }
          }
        } else if (routeData && routeData.length > 0) {
          // Use provided route data instead of calculating
          console.log('📍 Using provided route data with', routeData.length, 'points');
          setRouteGeometry(routeData);
        } else {
          // Fallback to straight line
          console.log('📏 Using straight line route as fallback');
          setRouteGeometry([startPoint, endPoint]);
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Error fetching route:', err);
          setError(err.message);
          
          // Fallback to straight line
          setRouteGeometry([startPoint, endPoint]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchRouteFromOSRM();
    
    return () => {
      isMounted = false;
    };
  }, [startPoint, endPoint, transportMode, map, fitRoute, routeData, useOsrm]);
  
  // Create custom marker icons for start and end points
  const startIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 20.25 12 36 12 36C12 36 24 20.25 24 12C24 5.37 18.63 0 12 0ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5C14.49 7.5 16.5 9.51 16.5 12C16.5 14.49 14.49 16.5 12 16.5Z" fill="#10b981"/>
      </svg>
    `,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36]
  });
  
  const endIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 20.25 12 36 12 36C12 36 24 20.25 24 12C24 5.37 18.63 0 12 0ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5C14.49 7.5 16.5 9.51 16.5 12C16.5 14.49 14.49 16.5 12 16.5Z" fill="#ef4444"/>
      </svg>
    `,
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36]
  });
  
  // If no route geometry, don't render anything
  if (routeGeometry.length === 0) {
    return null;
  }
  
  // Render the route as a polyline
  return (
    <>
      {/* Main route line */}
      <Polyline
        positions={routeGeometry}
        color="black"
        weight={5}
        opacity={0.7}
      />
      
      {/* Start point marker */}
      {startPoint && Array.isArray(startPoint) && startPoint.length === 2 && (
        <Marker 
          position={startPoint}
          icon={startIcon}
        >
          <Popup>
            <div className="text-center">
              <div className="font-bold text-green-600">Starting Point</div>
              <div className="text-sm mt-1">{startPoint[0].toFixed(6)}, {startPoint[1].toFixed(6)}</div>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* End point marker */}
      {endPoint && Array.isArray(endPoint) && endPoint.length === 2 && (
        <Marker 
          position={endPoint}
          icon={endIcon}
        >
          <Popup>
            <div className="text-center">
              <div className="font-bold text-red-600">Destination</div>
              <div className="text-sm mt-1">{endPoint[0].toFixed(6)}, {endPoint[1].toFixed(6)}</div>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Direction arrow markers along the route */}
      <RouteDirectionMarkers positions={routeGeometry} />
      
      {/* Loading indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          padding: '8px 16px',
          borderRadius: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div className="spinner" style={{
            width: '16px',
            height: '16px',
            border: '3px solid #3b82f6',
            borderTop: '3px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div>Calculating route...</div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000,
          fontSize: '14px'
        }}>
          Error: {error}
        </div>
      )}
    </>
  );
};

/**
 * Component to add direction arrows along a route
 */
const RouteDirectionMarkers = ({ positions }) => {
  if (!positions || positions.length < 2) return null;
  
  // Place arrows approximately every n points
  const step = Math.max(Math.floor(positions.length / 4), 1);
  const arrowPositions = [];
  
  for (let i = step; i < positions.length - step; i += step) {
    // Get current point and points before/after for direction calculation
    const prev = positions[i - 1];
    const curr = positions[i];
    const next = positions[i + 1];
    
    // Calculate heading between points
    const heading = calculateHeading(prev, next);
    
    arrowPositions.push({
      position: curr,
      heading: heading
    });
  }
  
  return (
    <>
      {arrowPositions.map((arrow, index) => (
        <RouteArrow 
          key={index} 
          position={arrow.position} 
          heading={arrow.heading} 
        />
      ))}
    </>
  );
};

/**
 * Calculate heading between two points
 */
const calculateHeading = (point1, point2) => {
  const lat1 = point1[0] * Math.PI / 180;
  const lat2 = point2[0] * Math.PI / 180;
  const lon1 = point1[1] * Math.PI / 180;
  const lon2 = point2[1] * Math.PI / 180;
  
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

/**
 * Component for direction arrow marker
 */
const RouteArrow = ({ position, heading }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !position) return;
    
    // Create a custom div icon for the arrow
    const arrowIcon = L.divIcon({
      className: 'route-arrow-icon',
      html: `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L19 9H5L12 2Z" fill="#2563eb" transform="rotate(${heading}, 12, 12)"/>
        </svg>
      `,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    // Create and add marker to map
    const marker = L.marker(position, { icon: arrowIcon, interactive: false });
    marker.addTo(map);
    
    // Clean up on unmount
    return () => {
      marker.remove();
    };
  }, [position, heading, map]);
  
  return null; // No actual React component to render as we're using Leaflet directly
};

// Add spinning animation for loading indicator
const styleElement = document.createElement('style');
styleElement.innerHTML = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleElement);

export default MonitorRouteMap;