import axios from 'axios';

// OSRM public API endpoint - bisa digunakan gratis dengan batasan
const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1';

/**
 * Mendapatkan rute dari OSRM
 * @param {Array} startPoint - Koordinat titik awal [lat, lng]
 * @param {Array} endPoint - Koordinat titik akhir [lat, lng]
 * @param {String} transportMode - Mode transportasi (car, bike, foot)
 * @param {Object} vehicleSpecs - Spesifikasi kendaraan (untuk truk)
 * @returns {Promise} - Promise yang menghasilkan data rute
 */
export const getOsrmRoute = async (startPoint, endPoint, transportMode = 'car', vehicleSpecs = null) => {
  try {
    // OSRM mengharapkan format [lng, lat], bukan [lat, lng]
    const startCoord = `${startPoint[1]},${startPoint[0]}`;
    const endCoord = `${endPoint[1]},${endPoint[0]}`;
    
    // Map transportMode ke profile OSRM
    const profile = transportModeToProfile(transportMode);
    
    // Buat URL untuk request
    const url = `${OSRM_ENDPOINT}/${profile}/${startCoord};${endCoord}`;
    
    console.log('Requesting OSRM route:', url);
    
    // Parameter yang diperlukan
    const params = {
      alternatives: false,
      steps: true,
      geometries: 'geojson',
      overview: 'full',
      annotations: 'true'
    };
    
    // Tambahkan parameter khusus untuk truk jika transportMode adalah truck
    if (transportMode === 'driving-hgv' || transportMode === 'truck') {
      params.continue_straight = true; // Hindari putar balik yang sulit untuk truk
    }
    
    const response = await axios.get(url, { params });
    
    console.log('OSRM response received:', response.status);
    
    // Transformasi respons ke format standar
    let routeData = transformOsrmResponse(response.data);
    
    // Jika kendaraan adalah truk, lakukan post-processing untuk truk
    if (transportMode === 'driving-hgv' || transportMode === 'truck') {
      routeData = postProcessTruckRoute(routeData, vehicleSpecs || getDefaultTruckSpecs());
    }
    
    return routeData;
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    throw error;
  }
};

/**
 * Post-process rute untuk memastikan kesesuaian dengan truk
 * @param {Object} routeData - Rute dari OSRM
 * @param {Object} truckSpecs - Spesifikasi truk
 * @returns {Object} - Rute yang telah dimodifikasi
 */
const postProcessTruckRoute = (routeData, truckSpecs) => {
  if (!routeData || !routeData.features || routeData.features.length === 0) {
    return routeData;
  }
  
  const mainRoute = routeData.features[0];
  
  if (!mainRoute.properties || !mainRoute.properties.segments) {
    return routeData;
  }

  // Ekstrak informasi rute
  const segments = mainRoute.properties.segments[0];

  // Sesuaikan durasi dan jarak untuk truk
  // Truk biasanya bergerak lebih lambat dari mobil
  if (segments.duration) {
    // Tambahkan 30% waktu untuk truk
    segments.truckDuration = segments.duration * 1.3;
    segments.summary.truckDuration = segments.duration * 1.3;
    
    // Update duration asli untuk UI
    segments.originalDuration = segments.duration;
    segments.duration = segments.truckDuration;
    segments.summary.originalDuration = segments.summary.duration;
    segments.summary.duration = segments.truckDuration;
  }
  
  // Deteksi segmen jalan potensial yang tidak cocok untuk truk
  const warnings = detectPotentialHazards(mainRoute.geometry, truckSpecs);
  
  // Tambahkan peringatan ke objek rute
  routeData.truckWarnings = warnings;
  mainRoute.properties.truckWarnings = warnings;
  
  return routeData;
};

/**
 * Deteksi potensi bahaya untuk truk sepanjang rute
 * @param {Object} geometry - Geometri rute
 * @param {Object} truckSpecs - Spesifikasi truk
 * @returns {Array} - Array peringatan
 */
const detectPotentialHazards = (geometry, truckSpecs) => {
  const warnings = [];
  
  if (!geometry || !geometry.coordinates || geometry.coordinates.length < 3) {
    return warnings;
  }
  
  const { height, weight, width, length } = truckSpecs;
  
  // Cek tiap 3 titik berurutan untuk mendeteksi tikungan tajam
  for (let i = 0; i < geometry.coordinates.length - 2; i++) {
    const p1 = geometry.coordinates[i];
    const p2 = geometry.coordinates[i+1];
    const p3 = geometry.coordinates[i+2];
    
    // Hitung sudut antara 3 titik
    const angle = calculateAngle(p1, p2, p3);
    
    // Jika sudut sangat tajam (< 45 derajat), tandai sebagai berbahaya
    if (angle < 45) {
      warnings.push({
        type: 'sharp_turn',
        message: `Tikungan tajam terdeteksi (${angle.toFixed(0)}°)`,
        position: p2,
        index: i+1,
        severity: angle < 30 ? 'high' : 'medium'
      });
    }
  }
  
  // Tambahkan peringatan umum untuk truk besar
  if (height > 4.0 || weight > 15 || length > 12) {
    warnings.push({
      type: 'general',
      message: `Truk dengan dimensi besar (H:${height}m, W:${weight}t, L:${length}m) mungkin mengalami kesulitan di beberapa jalan`,
      severity: 'info'
    });
  }
  
  // Jika tidak ada peringatan spesifik tapi mode transportasi adalah truk
  if (warnings.length === 0) {
    warnings.push({
      type: 'info',
      message: 'Rute dioptimalkan menggunakan profil mobil. Harap perhatikan batasan truk seperti tinggi, berat, dan lebar jalan.',
      severity: 'info'
    });
  }
  
  return warnings;
};

/**
 * Menghitung sudut antara 3 titik dalam derajat
 * @param {Array} p1 - Titik 1 [lng, lat]
 * @param {Array} p2 - Titik 2 [lng, lat]
 * @param {Array} p3 - Titik 3 [lng, lat]
 * @returns {Number} - Sudut dalam derajat
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
  
  // Hitung cosine dari sudut
  const cosAngle = dotProduct / (mag1 * mag2);
  
  // Konversi ke sudut dalam derajat
  const angleRad = Math.acos(Math.min(Math.max(cosAngle, -1), 1));
  const angleDeg = angleRad * 180 / Math.PI;
  
  return angleDeg;
};

/**
 * Default spesifikasi truk untuk Indonesia
 * @returns {Object} - Spesifikasi default
 */
export const getDefaultTruckSpecs = () => {
  return {
    height: 4.2,  // meter
    weight: 16,   // ton
    width: 2.5,   // meter
    length: 12,   // meter
    axles: 2      // jumlah sumbu
  };
};

/**
 * Mendapatkan beberapa rute alternatif dari OSRM
 * @param {Array} startPoint - Koordinat titik awal [lat, lng]
 * @param {Array} endPoint - Koordinat titik akhir [lat, lng]
 * @param {String} transportMode - Mode transportasi (car, bike, foot)
 * @returns {Promise} - Promise yang menghasilkan data rute alternatif
 */
export const getOsrmAlternativeRoutes = async (startPoint, endPoint, transportMode = 'car') => {
  try {
    const startCoord = `${startPoint[1]},${startPoint[0]}`;
    const endCoord = `${endPoint[1]},${endPoint[0]}`;
    
    const profile = transportModeToProfile(transportMode);
    const url = `${OSRM_ENDPOINT}/${profile}/${startCoord};${endCoord}`;
    
    console.log('Requesting OSRM alternative routes:', url);
    
    const params = {
      alternatives: true,
      steps: true,
      geometries: 'geojson',
      overview: 'full'
    };
    
    const response = await axios.get(url, { params });
    
    console.log('OSRM alternatives response received:', response.status);
    
    // Transformasi respons ke format standar termasuk rute alternatif
    return transformOsrmResponse(response.data, true);
  } catch (error) {
    console.error('Error fetching OSRM alternative routes:', error);
    throw error;
  }
};

/**
 * Mengubah mode transportasi ke profile OSRM
 * @param {String} mode - Mode transportasi custom
 * @returns {String} - Profile OSRM yang sesuai
 */
export const transportModeToProfile = (mode) => {
  switch (mode) {
    case 'driving-car':
    case 'car':
      return 'car';
    case 'driving-hgv':
    case 'truck':
      return 'car'; // OSRM public tidak memiliki profile truck khusus
    case 'cycling-regular':
    case 'bike':
      return 'bike';
    case 'foot-walking':
    case 'walking':
    case 'foot':
      return 'foot';
    default:
      return 'car';
  }
};

/**
 * Mengubah respons OSRM ke format yang konsisten
 * @param {Object} osrmResponse - Respons dari OSRM API
 * @param {Boolean} includeAlternatives - Apakah menyertakan rute alternatif
 * @returns {Object} - Data rute dalam format standar
 */
const transformOsrmResponse = (osrmResponse, includeAlternatives = false) => {
  if (!osrmResponse || !osrmResponse.routes || osrmResponse.routes.length === 0) {
    throw new Error('Invalid OSRM response');
  }
  
  console.log('Processing OSRM response with', osrmResponse.routes.length, 'routes');
  
  // Ambil rute utama
  const mainRoute = osrmResponse.routes[0];
  
  // Ambil waypoint
  const waypoints = osrmResponse.waypoints || [];
  
  // Ekstrak instruksi dari langkah-langkah
  const instructions = [];
  const legs = mainRoute.legs || [];
  
  for (const leg of legs) {
    const steps = leg.steps || [];
    
    for (const step of steps) {
      if (step.maneuver) {
        // Transformasi langkah OSRM ke format instruksi standar
        instructions.push({
          instruction: step.maneuver.instruction || step.name || '',
          distance: step.distance,
          duration: step.duration,
          name: step.name || '',
          type: step.maneuver.type || '',
          modifier: step.maneuver.modifier || '',
          exit: step.maneuver.exit || null,
          geometry: step.geometry || null
        });
      }
    }
  }
  
  console.log('Extracted', instructions.length, 'instructions from route');
  
  // Buat objek hasil
  const result = {
    // Format GeoJSON untuk konsistensi
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        segments: [{
          distance: mainRoute.distance,
          duration: mainRoute.duration,
          steps: instructions,
          summary: {
            distance: mainRoute.distance,
            duration: mainRoute.duration
          }
        }]
      },
      geometry: mainRoute.geometry
    }],
    metadata: {
      attribution: 'OSRM',
      service: 'routing',
      timestamp: Date.now(),
      query: {
        coordinates: waypoints.map(wp => [wp.location[0], wp.location[1]]),
        profile: osrmResponse.routeOptions?.profile || 'car',
        format: 'json'
      }
    },
    // Bounding box dari rute
    bbox: calculateBoundingBox(mainRoute.geometry.coordinates)
  };
  
  // Tambahkan rute alternatif jika diperlukan
  if (includeAlternatives && osrmResponse.routes.length > 1) {
    for (let i = 1; i < osrmResponse.routes.length; i++) {
      const altRoute = osrmResponse.routes[i];
      result.features.push({
        type: 'Feature',
        properties: {
          segments: [{
            distance: altRoute.distance,
            duration: altRoute.duration,
            summary: {
              distance: altRoute.distance,
              duration: altRoute.duration
            }
          }]
        },
        geometry: altRoute.geometry
      });
    }
    
    console.log('Added', osrmResponse.routes.length - 1, 'alternative routes');
  }
  
  return result;
};

/**
 * Menghitung bounding box dari kumpulan koordinat
 * @param {Array} coordinates - Array koordinat [lng, lat]
 * @returns {Array} - Bounding box [minLng, minLat, maxLng, maxLat]
 */
const calculateBoundingBox = (coordinates) => {
  if (!coordinates || coordinates.length === 0) {
    return [0, 0, 0, 0];
  }
  
  let minLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLng = coordinates[0][0];
  let maxLat = coordinates[0][1];
  
  for (const coord of coordinates) {
    minLng = Math.min(minLng, coord[0]);
    minLat = Math.min(minLat, coord[1]);
    maxLng = Math.max(maxLng, coord[0]);
    maxLat = Math.max(maxLat, coord[1]);
  }
  
  return [minLng, minLat, maxLng, maxLat];
};