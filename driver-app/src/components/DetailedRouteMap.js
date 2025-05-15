import React, { useEffect, useState, useRef } from 'react';
import { useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';

/**
 * Komponen untuk menampilkan rute lengkap di peta menggunakan OSRM
 * @param {Object} props - Component props
 * @param {Array} props.startPoint - Koordinat awal [lat, lng]
 * @param {Array} props.endPoint - Koordinat akhir [lat, lng]
 * @param {String} props.transportMode - Mode transportasi
 * @param {Function} props.onRouteCalculated - Callback setelah kalkulasi rute (optional)
 */
const DetailedRouteMap = ({ 
  startPoint, 
  endPoint, 
  transportMode = 'driving-car',
  onRouteCalculated = null
}) => {
  // State untuk menyimpan rute
  const [routeGeometry, setRouteGeometry] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Gunakan ref untuk mencegah perhitungan ulang yang tidak perlu
  const prevPropsRef = useRef({ startPoint, endPoint, transportMode });
  const routeCalculatedRef = useRef(false);
  
  // Ref untuk map instance
  const map = useMap();
  
  // Fungsi untuk mengambil rute dari OSRM
  const fetchRoute = async (start, end, mode) => {
    if (!start || !end) return;
    
    // Skip jika tidak ada perubahan input
    const propsChanged = 
      !prevPropsRef.current.startPoint ||
      !prevPropsRef.current.endPoint ||
      prevPropsRef.current.startPoint[0] !== start[0] ||
      prevPropsRef.current.startPoint[1] !== start[1] ||
      prevPropsRef.current.endPoint[0] !== end[0] ||
      prevPropsRef.current.endPoint[1] !== end[1] ||
      prevPropsRef.current.transportMode !== mode;
    
    if (!propsChanged && routeCalculatedRef.current) {
      console.log('Skipping route calculation - inputs unchanged');
      return;
    }
    
    // Perbarui ref
    prevPropsRef.current = { 
      startPoint: start ? [...start] : null, 
      endPoint: end ? [...end] : null, 
      transportMode: mode 
    };
    
    setIsLoading(true);
    setError(null);
    
    try {
      // OSRM mengharapkan format [lng, lat], bukan [lat, lng]
      const startCoord = `${start[1]},${start[0]}`; 
      const endCoord = `${end[1]},${end[0]}`;
      
      // Map transportMode ke profile OSRM
      const profile = mapTransportModeToOsrmProfile(mode);
      
      // Buat URL untuk request OSRM public API
      const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startCoord};${endCoord}`;
      
      console.log('Fetching OSRM route:', osrmUrl);
      
      const response = await axios.get(osrmUrl, {
        params: {
          alternatives: false,
          steps: true,
          geometries: 'geojson',
          overview: 'full',
          annotations: 'true'
        }
      });
      
      // Periksa data valid
      if (response.data && 
          response.data.routes && 
          response.data.routes.length > 0 &&
          response.data.routes[0].geometry) {
        
        // Extract geometry (koordinat dari rute)
        const route = response.data.routes[0];
        const geometry = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        
        setRouteGeometry(geometry);
        routeCalculatedRef.current = true;
        
        // Sesuaikan peta untuk menampilkan seluruh rute - delay untuk memastikan DOM diperbarui
        setTimeout(() => {
          if (geometry.length > 0 && map) {
            try {
              const bounds = L.latLngBounds(geometry);
              map.fitBounds(bounds, { padding: [50, 50] });
            } catch (e) {
              console.error('Error fitting bounds:', e);
            }
          }
        }, 100);
        
        // Generate instruksi rute dari steps
        const instructions = extractRouteInstructions(route);
        
        // Panggil callback dengan hasil
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: route.distance / 1000, // Convert to km
            duration: Math.round(route.duration / 60), // Convert to minutes
            instructions: instructions
          });
        }
      } else {
        throw new Error('Invalid route data from OSRM');
      }
    } catch (err) {
      console.error('Error fetching OSRM route:', err);
      setError(err.message);
      
      // Jika OSRM gagal, gunakan perhitungan jarak sederhana sebagai fallback
      const simpleDistance = calculateDistance(start, end);
      const avgSpeedKmh = 50;
      const durationMinutes = Math.round((simpleDistance / avgSpeedKmh) * 60);
      
      // Buat garis lurus sebagai fallback
      setRouteGeometry([start, end]);
      
      // Generate instruksi navigasi sederhana
      const simpleInstructions = generateBasicInstructions(start, end);
      
      // Panggil callback dengan hasil sederhana
      if (onRouteCalculated) {
        onRouteCalculated({
          distance: simpleDistance,
          duration: durationMinutes,
          instructions: simpleInstructions
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Jalankan fetchRoute saat komponen mount atau props berubah
  useEffect(() => {
    // Periksa validasi input
    if (!startPoint || !endPoint || !Array.isArray(startPoint) || !Array.isArray(endPoint)) {
      console.log('Invalid route points', { startPoint, endPoint });
      return;
    }
    
    // Periksa DOM dan peta telah dimuat sepenuhnya
    if (!map) {
      console.log('Map not ready yet');
      return;
    }
    
    // Ambil rute
    fetchRoute(startPoint, endPoint, transportMode);
  }, [startPoint, endPoint, transportMode, map]);

  // Jika tidak ada titik, jangan render apa-apa
  if (!startPoint || !endPoint) {
    return null;
  }
  
  // Jika rute belum dihitung, tampilkan garis langsung antara titik
  if (routeGeometry.length === 0) {
    return (
      <Polyline
        positions={[startPoint, endPoint]}
        color="#3b82f6"
        weight={4}
        opacity={0.7}
        dashArray="10, 10"
      />
    );
  }
  
  // Render polyline berdasarkan geometri rute
  return (
    <Polyline
      positions={routeGeometry}
      color="#3b82f6"
      weight={5}
      opacity={0.7}
    />
  );
};

/**
 * Map transport mode to OSRM profile
 */
const mapTransportModeToOsrmProfile = (mode) => {
  switch (mode) {
    case 'driving-car':
      return 'car';
    case 'driving-hgv':
      return 'car'; // OSRM tidak memiliki profil khusus untuk truk
    case 'cycling-regular':
      return 'bike';
    case 'foot-walking':
      return 'foot';
    default:
      return 'car';
  }
};

/**
 * Extract route instructions from OSRM response
 */
const extractRouteInstructions = (route) => {
  if (!route || !route.legs || route.legs.length === 0) {
    return [];
  }
  
  const instructions = [];
  
  route.legs.forEach(leg => {
    if (leg.steps && leg.steps.length > 0) {
      leg.steps.forEach(step => {
        if (step.maneuver) {
          instructions.push({
            instruction: step.maneuver.instruction || '',
            distance: step.distance,
            duration: step.duration,
            name: step.name || '',
            type: step.maneuver.type || '',
            modifier: step.maneuver.modifier || ''
          });
        }
      });
    }
  });
  
  return instructions;
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {Array} point1 - [lat, lng]
 * @param {Array} point2 - [lat, lng]
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (point1, point2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (point2[0] - point1[0]) * Math.PI / 180;
  const dLon = (point2[1] - point1[1]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // distance in kilometers
};

/**
 * Generate basic instructions for navigation
 * @param {Array} startPoint - Start coordinates [lat, lng]
 * @param {Array} endPoint - End coordinates [lat, lng]
 * @returns {Array} Array of instruction objects
 */
const generateBasicInstructions = (startPoint, endPoint) => {
  const distance = calculateDistance(startPoint, endPoint);
  
  // Calculate heading between points (in degrees)
  const y = Math.sin((endPoint[1] - startPoint[1]) * Math.PI / 180) * Math.cos(endPoint[0] * Math.PI / 180);
  const x = Math.cos(startPoint[0] * Math.PI / 180) * Math.sin(endPoint[0] * Math.PI / 180) -
            Math.sin(startPoint[0] * Math.PI / 180) * Math.cos(endPoint[0] * Math.PI / 180) * 
            Math.cos((endPoint[1] - startPoint[1]) * Math.PI / 180);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  
  // Determine direction based on bearing
  let direction;
  if (bearing >= 337.5 || bearing < 22.5) direction = "utara";
  else if (bearing >= 22.5 && bearing < 67.5) direction = "timur laut";
  else if (bearing >= 67.5 && bearing < 112.5) direction = "timur";
  else if (bearing >= 112.5 && bearing < 157.5) direction = "tenggara";
  else if (bearing >= 157.5 && bearing < 202.5) direction = "selatan";
  else if (bearing >= 202.5 && bearing < 247.5) direction = "barat daya";
  else if (bearing >= 247.5 && bearing < 292.5) direction = "barat";
  else direction = "barat laut";
  
  // Create basic instructions
  return [
    {
      instruction: `Mulai perjalanan dari titik awal`,
      distance: 0,
      duration: 0,
      type: 'depart',
      modifier: 'straight'
    },
    {
      instruction: `Arah ke ${direction} menuju tujuan`,
      distance: distance * 1000, // Convert to meters for consistency
      duration: (distance / 50) * 3600, // Estimated seconds based on 50 km/h
      type: 'continue',
      modifier: 'straight'
    },
    {
      instruction: `Sampai di tujuan`,
      distance: 0,
      duration: 0,
      type: 'arrive',
      modifier: 'straight'
    }
  ];
};

export default DetailedRouteMap;