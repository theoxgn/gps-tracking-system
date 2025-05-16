import React, { useEffect, useState, useRef } from 'react';
import { useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { getDefaultTruckSpecs } from '../services/osmRouteService';

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
  const [truckWarnings, setTruckWarnings] = useState([]);
  const [isTruckRoute, setIsTruckRoute] = useState(false);
  
  // Gunakan ref untuk mencegah perhitungan ulang yang tidak perlu
  const prevPropsRef = useRef({ startPoint, endPoint, transportMode });
  const routeCalculatedRef = useRef(false);
  
  // Ref untuk map instance
  const map = useMap();
  
  // Efek untuk mendeteksi jika mode transportasi adalah truk
  useEffect(() => {
    setIsTruckRoute(transportMode === 'driving-hgv');
  }, [transportMode]);

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
    setTruckWarnings([]);
    
    try {
      // OSRM mengharapkan format [lng, lat], bukan [lat, lng]
      const startCoord = `${start[1]},${start[0]}`; 
      const endCoord = `${end[1]},${end[0]}`;
      
      // Map transportMode ke profile OSRM
      const profile = mapTransportModeToOsrmProfile(mode);
      
      // Tambahkan parameter khusus untuk truk
      const extraParams = mode === 'driving-hgv' ? {
        // radiuses: -1,
        continue_straight: true
      } : {};
      
      // Buat URL untuk request OSRM public API
      const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${startCoord};${endCoord}`;
      
      console.log('Fetching OSRM route for mode:', mode);
      
      const response = await axios.get(osrmUrl, {
        params: {
          alternatives: false,
          steps: true,
          geometries: 'geojson',
          overview: 'full',
          annotations: 'true',
          ...extraParams
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
        
        // Dapatkan durasi dan jarak asli
        let distance = route.distance / 1000; // Convert to km
        let duration = Math.round(route.duration / 60); // Convert to minutes
        
        // Post-processing untuk rute truk
        if (mode === 'driving-hgv') {
          // Sesuaikan durasi untuk truk (30% lebih lama)
          const truckDuration = Math.round(duration * 1.3);
          
          // Generate peringatan untuk rute truk
          const warnings = detectTruckHazards(geometry);
          setTruckWarnings(warnings);
          
          // Perbarui durasi jika mode adalah truck
          duration = truckDuration;
        }
        
        // Panggil callback dengan hasil
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: distance,
            duration: duration,
            instructions: instructions,
            routeGeometry: geometry,
            truckWarnings: mode === 'driving-hgv' ? truckWarnings : null
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
      const avgSpeedKmh = mode === 'driving-hgv' ? 40 : 50; // Truck lebih lambat
      const durationMinutes = Math.round((simpleDistance / avgSpeedKmh) * 60);
      
      // Buat garis lurus sebagai fallback
      setRouteGeometry([start, end]);
      
      // Generate instruksi navigasi sederhana
      const simpleInstructions = generateBasicInstructions(start, end, mode);
      
      // Tambahkan peringatan untuk truk jika modenya truck
      if (mode === 'driving-hgv') {
        setTruckWarnings([{
          type: 'fallback',
          message: 'Menggunakan rute sederhana karena tidak bisa mendapatkan rute detail. Harap verifikasi kesesuaian rute untuk kendaraan besar.',
          severity: 'warning'
        }]);
      }
      
      // Panggil callback dengan hasil sederhana
      if (onRouteCalculated) {
        onRouteCalculated({
          distance: simpleDistance,
          duration: durationMinutes,
          instructions: simpleInstructions,
          routeGeometry: [start, end],
          truckWarnings: mode === 'driving-hgv' ? truckWarnings : null
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Deteksi potensi bahaya untuk truk
  const detectTruckHazards = (routeGeometry) => {
    const warnings = [];
    
    if (!routeGeometry || routeGeometry.length < 3) {
      return warnings;
    }
    
    // Default truck specs
    const truckSpecs = getDefaultTruckSpecs();
    
    // Penambahan peringatan informasi dasar
    warnings.push({
      type: 'info',
      message: 'Rute ini menggunakan profile mobil dari OSRM karena API publik tidak mendukung profil truk. Durasi telah disesuaikan +30% untuk truk.',
      severity: 'info'
    });
    
    // Cek tiap 3 titik berurutan untuk mendeteksi tikungan tajam
    let sharpTurnCount = 0;
    for (let i = 0; i < routeGeometry.length - 2; i += 2) { // Skip beberapa titik untuk efisiensi
      if (i + 2 >= routeGeometry.length) break;
      
      const p1 = routeGeometry[i];
      const p2 = routeGeometry[i+1];
      const p3 = routeGeometry[i+2];
      
      // Hitung sudut antara 3 titik
      const angle = calculateAngle(p1, p2, p3);
      
      // Jika sudut sangat tajam (< 60 derajat), tandai sebagai berbahaya
      if (angle < 60) {
        sharpTurnCount++;
        
        // Batasi jumlah peringatan tikungan tajam untuk menghindari terlalu banyak peringatan
        if (sharpTurnCount <= 3) {
          warnings.push({
            type: 'sharp_turn',
            message: `Tikungan tajam terdeteksi (${angle.toFixed(0)}°)`,
            severity: angle < 40 ? 'high' : 'medium',
            location: p2
          });
        }
      }
    }
    
    // Jika terlalu banyak tikungan tajam, tambahkan ringkasan
    if (sharpTurnCount > 3) {
      warnings.push({
        type: 'sharp_turns_summary',
        message: `Terdeteksi total ${sharpTurnCount} tikungan tajam di sepanjang rute`,
        severity: 'medium'
      });
    }
    
    // Tambahkan peringatan tentang kemungkinan hambatan
    warnings.push({
      type: 'dimensions',
      message: `Verifikasi batasan tinggi (${truckSpecs.height}m), berat (${truckSpecs.weight}t), dan lebar (${truckSpecs.width}m) di sepanjang rute`,
      severity: 'medium'
    });
    
    return warnings;
  };

  /**
   * Menghitung sudut antara 3 titik dalam derajat
   */
  const calculateAngle = (p1, p2, p3) => {
    // Hitung vektor dari p2 ke p1 dan p2 ke p3
    const v1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const v2 = [p3[0] - p2[0], p3[1] - p2[1]];
    
    // Hitung dot product
    const dotProduct = v1[0] * v2[0] + v1[1] * v2[1];
    
    // Hitung magnitudes
    const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
    const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);
    
    // Hindari pembagian dengan nol
    if (mag1 === 0 || mag2 === 0) return 180;
    
    // Hitung cosine dari sudut
    const cosAngle = dotProduct / (mag1 * mag2);
    
    // Konversi ke sudut dalam derajat
    const angleRad = Math.acos(Math.min(Math.max(cosAngle, -1), 1));
    const angleDeg = angleRad * 180 / Math.PI;
    
    return angleDeg;
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
        color="black"
        weight={4}
        opacity={0.7}
      />
    );
  }
  
  return (
    <>
      {/* Render polyline berdasarkan geometri rute */}
      <Polyline
        positions={routeGeometry}
        color={isTruckRoute ? "#e67e22" : "black"} // Warna oranye untuk rute truk
        weight={5}
        opacity={0.7}
      />
      
      {/* Tampilkan peringatan jika ini rute truk dan ada peringatan */}
      {isTruckRoute && truckWarnings.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(230, 126, 34, 0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          zIndex: 1000,
          maxWidth: '300px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          fontSize: '14px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠️ Peringatan Rute Truk
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {truckWarnings.map((warning, index) => (
              <li key={index} style={{ marginBottom: '6px' }}>
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Tampilkan loading indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          zIndex: 999
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span>Mengkalkulasi rute...</span>
        </div>
      )}
      
      {/* Tampilkan error jika ada */}
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'rgba(231, 76, 60, 0.9)',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '20px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          zIndex: 999
        }}>
          Error: {error}
        </div>
      )}
    </>
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
 * @param {String} mode - Transport mode
 * @returns {Array} Array of instruction objects
 */
const generateBasicInstructions = (startPoint, endPoint, mode) => {
  const distance = calculateDistance(startPoint, endPoint);
  
  // Calculate bearing between points (in degrees)
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
  
  // Adjust average speed based on transport mode
  const avgSpeedKmh = mode === 'driving-hgv' ? 40 : // Truck
                      mode === 'cycling-regular' ? 15 : // Bike
                      mode === 'foot-walking' ? 5 : // Walking
                      50; // Car (default)
  
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
      duration: (distance / avgSpeedKmh) * 3600, // Estimated seconds based on speed
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

// Tambahkan animasi spinning untuk loading indicator
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleEl);

export default DetailedRouteMap;