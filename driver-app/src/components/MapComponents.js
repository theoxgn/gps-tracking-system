// components/MapComponents.js - Common map sub-components
import React, { useEffect } from 'react';
import { Polyline, useMap } from 'react-leaflet';

/**
 * Component to draw a route line between two points
 * @param {Object} props - Component props
 * @param {Array} props.startPoint - Start point coordinates [lat, lng]
 * @param {Array} props.endPoint - End point coordinates [lat, lng]
 */
export const RouteLine = ({ startPoint, endPoint }) => {
  // If either point is missing, don't render
  if (!startPoint || !endPoint) return null;

  // Array of positions for Polyline: [start point, end point]
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

/**
 * Component to update map view when position changes
 * @param {Object} props - Component props
 * @param {Array} props.position - Current position coordinates [lat, lng]
 */
export function MapController({ position }) {
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