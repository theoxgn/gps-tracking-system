import axios from 'axios';

// OSRM public API endpoint - bisa digunakan gratis dengan batasan
const OSRM_ENDPOINT = 'https://router.project-osrm.org/route/v1';

/**
 * Mendapatkan rute dari OSRM
 * @param {Array} startPoint - Koordinat titik awal [lat, lng]
 * @param {Array} endPoint - Koordinat titik akhir [lat, lng]
 * @param {String} transportMode - Mode transportasi (car, bike, foot)
 * @returns {Promise} - Promise yang menghasilkan data rute
 */
export const getOsrmRoute = async (startPoint, endPoint, transportMode = 'car') => {
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
    
    const response = await axios.get(url, { params });
    
    console.log('OSRM response received:', response.status);
    
    // Transformasi respons ke format standar
    return transformOsrmResponse(response.data);
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    throw error;
  }
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
const transportModeToProfile = (mode) => {
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