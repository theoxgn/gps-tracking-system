import React, { useEffect, useState } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Component to display a driver's route on the monitor map
 * @param {Object} props - Component props 
 * @param {Array} props.routeData - Route geometry coordinates [[lat, lng], ...]
 * @param {Array} props.startPoint - Starting point coordinates [lat, lng]
 * @param {Array} props.endPoint - Ending point coordinates [lat, lng]
 * @param {Boolean} props.fitRoute - Whether to fit the map to the route bounds
 */
const MonitorRouteMap = ({ 
  routeData, 
  startPoint, 
  endPoint, 
  fitRoute = true 
}) => {
  const map = useMap();
  const [routeGeometry, setRouteGeometry] = useState([]);
  
  // Update route geometry when route data changes
  useEffect(() => {
    if (routeData && routeData.length > 0) {
      setRouteGeometry(routeData);
      
      // Fit map to the route bounds if requested
      if (fitRoute && map) {
        try {
          const bounds = L.latLngBounds(routeData);
          map.fitBounds(bounds, { padding: [50, 50] });
        } catch (error) {
          console.error('Error fitting bounds to route:', error);
          
          // Fallback - if we at least have start and end points, fit to those
          if (startPoint && endPoint) {
            const bounds = L.latLngBounds([startPoint, endPoint]);
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      }
    } else if (startPoint && endPoint) {
      // If we only have start and end points (no route data)
      setRouteGeometry([startPoint, endPoint]);
      
      if (fitRoute && map) {
        const bounds = L.latLngBounds([startPoint, endPoint]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else {
      // No route data available
      setRouteGeometry([]);
    }
  }, [routeData, startPoint, endPoint, fitRoute, map]);
  
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
        color="#3b82f6"
        weight={5}
        opacity={0.7}
      />
      
      {/* Direction arrow markers along the route */}
      <RouteDirectionMarkers positions={routeGeometry} />
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

export default MonitorRouteMap;