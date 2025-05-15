import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Komponen untuk mengontrol tampilan peta
 * @param {Object} props - Component props
 * @param {Array} props.position - Posisi saat ini [lat, lng]
 * @param {Boolean} props.autoCenter - Apakah otomatis memusatkan peta ke posisi
 * @param {Number} props.zoom - Level zoom yang diinginkan
 */
const MapController = ({ 
  position, 
  autoCenter = false,
  zoom = null
}) => {
  const map = useMap();
  
  // Efek untuk mengatur tampilan peta
  useEffect(() => {
    if (!map || !position) return;
    
    if (autoCenter) {
      map.setView(position, zoom || map.getZoom());
    }
  }, [map, position, autoCenter, zoom]);
  
  // Hanya komponen control, tidak render apa-apa
  return null;
};

export default MapController;