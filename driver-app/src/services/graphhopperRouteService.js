import axios from 'axios';

// GraphHopper API configuration
const GRAPHHOPPER_API_URL = 'https://graphhopper.com/api/1/route';
const GRAPHHOPPER_API_KEY = process.env.REACT_APP_GRAPHHOPPER_API_KEY;
// console.log('GraphHopper API Key:', GRAPHHOPPER_API_KEY);

/**
 * Get a route using GraphHopper API
 * @param {Array} startPoint - Start coordinates [lat, lng]
 * @param {Array} endPoint - End coordinates [lat, lng]
 * @param {String} transportMode - Transport mode (driving-hgv, etc)
 * @param {Object} truckSpecs - Vehicle specifications for truck routing
 * @param {Boolean} preferTollRoads - Whether to prefer toll roads
 * @returns {Promise} - Promise with route data
 */
export const getGraphhopperRoute = async (startPoint, endPoint, transportMode, truckSpecs = null, preferTollRoads = true) => {
    try {
      console.log('Requesting GraphHopper route for:', transportMode);
      
      if (!GRAPHHOPPER_API_KEY) {
        throw new Error('GraphHopper API key not found. Please check your .env file');
      }
  
      // Map transport mode to GraphHopper profile
      const profile = mapTransportModeToGraphHopper(transportMode);
      
      // Prepare POST request body according to OpenAPI spec
      const requestBody = {
        profile: profile,
        points: [
          [startPoint[1], startPoint[0]], // Note: GraphHopper POST expects [longitude, latitude]
          [endPoint[1], endPoint[0]]
        ],
        details: ['road_class', 'toll', 'surface'],
        instructions: true,
        calc_points: true,
        points_encoded: false,
        locale: 'id'
      };
      
      // Add custom parameters for truck mode
      if (transportMode === 'driving-hgv' && truckSpecs) {
        requestBody['ch.disable'] = true;
        
        // Create custom model for truck routing
        const customModel = {
          speed: [
            {
              if: "road_class == MOTORWAY",
              limit_to: "90"
            },
            {
              if: "road_class == RESIDENTIAL || road_class == LIVING_STREET",
              limit_to: "30"
            }
          ]
        };
        
        // Add toll avoidance if needed
        if (!preferTollRoads) {
          customModel.priority = [
            {
                if: "toll == ALL || toll == HGV", // Fixed line
                multiply_by: "0.1"
            }
          ];
        }
        
        requestBody.custom_model = customModel;
        
        // Add truck dimensions
        if (truckSpecs.height) requestBody.height = truckSpecs.height;
        if (truckSpecs.weight) requestBody.weight = truckSpecs.weight;
        if (truckSpecs.width) requestBody.width = truckSpecs.width;
        if (truckSpecs.length) requestBody.length = truckSpecs.length;
        if (truckSpecs.axles) requestBody.axles = truckSpecs.axles;
      } else if (!preferTollRoads) {
        // For non-truck modes, avoid toll roads if not preferred
        requestBody['ch.disable'] = true;
        requestBody.custom_model = {
          priority: [
            {
              if: "toll == true",
              multiply_by: "0.1"
            }
          ]
        };
      }
      
      console.log('GraphHopper request body:', requestBody);
      
      // Make the POST request
      const response = await axios.post(`${GRAPHHOPPER_API_URL}?key=${GRAPHHOPPER_API_KEY}`, requestBody);
      
      if (!response.data || !response.data.paths || response.data.paths.length === 0) {
        throw new Error('GraphHopper returned invalid response');
      }
      
      return transformGraphhopperResponse(response.data, transportMode, truckSpecs, preferTollRoads);
    } catch (error) {
      console.error('Error fetching GraphHopper route:', error);
      
      // Enhanced error logging
      if (error.response) {
        console.error('Error status:', error.response.status);
        console.error('Error data:', error.response.data);
      }
      
      throw error;
    }
  };

/**
 * Map our transport modes to GraphHopper profiles
 */
const mapTransportModeToGraphHopper = (mode) => {
  switch (mode) {
    case 'driving-car':
      return 'car';
    case 'driving-hgv':
      return 'truck'; // Use truck profile for HGV
    case 'cycling-regular':
      return 'bike';
    case 'foot-walking':
      return 'foot';
    default:
      return 'car';
  }
};

/**
 * Transform GraphHopper response to match our app's expected format
 */
const transformGraphhopperResponse = (response, transportMode, truckSpecs, preferTollRoads) => {
  if (!response || !response.paths || response.paths.length === 0) {
    throw new Error('Invalid GraphHopper response');
  }
  
  const path = response.paths[0];
  
  // Convert GraphHopper coordinates to our format [lat, lng]
  const routeGeometry = path.points.coordinates.map(coord => [coord[1], coord[0]]);
  
  // Check if route includes toll roads
  let usesToll = false;
  if (path.details && path.details.toll) {
    // GraphHopper returns toll details as array of segments [fromIndex, toIndex, value]
    usesToll = path.details.toll.some(segment => segment[2] === true || segment[2] === "yes");
  }
  
  // Estimate toll costs (simplified approach)
  let tollInfo = null;
  if (usesToll) {
    // Estimate toll distance (simplified)
    const tollDistance = path.distance / 1000 * 0.6; // Assume 60% of route is toll roads
    
    // Determine vehicle class for toll calculation
    let vehicleClass = 1; // Default for cars
    if (transportMode === 'driving-hgv' && truckSpecs) {
      // Map truck specs to toll vehicle class
      if (truckSpecs.axles >= 5) vehicleClass = 5;
      else if (truckSpecs.axles === 4) vehicleClass = 4;
      else if (truckSpecs.axles === 3) vehicleClass = 3;
      else vehicleClass = 2; // Default for trucks with 2 axles
    }
    
    // Estimate toll cost based on vehicle class and distance
    const ratePerKm = tollRateForClass(vehicleClass);
    const estimatedCost = Math.round(tollDistance * ratePerKm);
    
    tollInfo = {
      usesToll: true,
      vehicleClass: vehicleClass,
      estimatedCost: estimatedCost,
      tollDistance: tollDistance,
      isEstimated: true
    };
  }
  
  // Extract instructions
  const instructions = [];
  if (path.instructions) {
    path.instructions.forEach((instr, idx) => {
      instructions.push({
        instruction: instr.text,
        distance: instr.distance,
        time: instr.time,
        type: mapInstructionType(instr.sign),
        modifier: instr.modifier || 'straight',
        interval: instr.interval,
        street_name: instr.street_name || ''
      });
    });
  }
  
  // Generate truck warnings if needed
  const truckWarnings = [];
  if (transportMode === 'driving-hgv') {
    // Add info about using GraphHopper truck profile
    truckWarnings.push({
      type: 'info',
      message: 'Rute dihitung menggunakan profil truk GraphHopper untuk akurasi yang lebih baik.',
      severity: 'info'
    });
    
    // Add toll road warning if applicable
    if (usesToll) {
      truckWarnings.push({
        type: 'toll',
        message: `Rute ini menggunakan jalan tol. Estimasi biaya: Rp ${tollInfo.estimatedCost.toLocaleString('id-ID')} (Golongan ${vehicleClassToLabel(tollInfo.vehicleClass)})`,
        severity: 'info'
      });
    }
    
    // Add general truck warnings
    truckWarnings.push({
      type: 'dimensions',
      message: `Verifikasi batasan tinggi, berat, dan lebar di sepanjang rute`,
      severity: 'medium'
    });
  }
  
  // Create the final route data object
  const routeData = {
    distance: path.distance / 1000, // Convert to km
    duration: Math.round(path.time / 1000 / 60), // Convert to minutes
    instructions: instructions,
    routeGeometry: routeGeometry,
    usesToll: usesToll,
    tollInfo: tollInfo,
    truckWarnings: truckWarnings,
    // Include vehicle specs if in truck mode
    ...(transportMode === 'driving-hgv' ? { vehicleSpecs: truckSpecs } : {})
  };
  
  console.log('GraphHopper route processed:', {
    distance: routeData.distance.toFixed(2) + 'km',
    duration: routeData.duration + 'min',
    usesToll: routeData.usesToll,
    points: routeData.routeGeometry.length
  });
  
  return routeData;
};

/**
 * Map GraphHopper instruction sign to our format
 */
const mapInstructionType = (sign) => {
  // GraphHopper uses different instruction codes than OSRM
  switch (sign) {
    case -98: return '-98'; // Unknown direction
    case -8: return '-8';   // Left U-turn
    case -7: return '-7';   // Keep left
    case -6: return '-6';   // Leave roundabout
    case -3: return '-3';   // Sharp left
    case -2: return '-2';   // Left
    case -1: return '-1';   // Slight left
    case 0: return '0';     // Continue
    case 1: return '1';     // Slight right
    case 2: return '2';     // Right
    case 3: return '3';     // Sharp right
    case 4: return '4';     // Finish
    case 5: return '5';     // Via point
    case 6: return '6';     // Roundabout
    default: return '0';    // Default: continue
  }
};

/**
 * Get toll rate per kilometer based on vehicle class
 */
const tollRateForClass = (vehicleClass) => {
  // Tarif rata-rata per km di jalan tol Indonesia (Rp)
  switch (vehicleClass) {
    case 1: return 900;   // Golongan I: sedan, jip, pick up, truk kecil
    case 2: return 1350;  // Golongan II: truk dengan 2 gandar
    case 3: return 1800;  // Golongan III: truk dengan 3 gandar
    case 4: return 2250;  // Golongan IV: truk dengan 4 gandar
    case 5: return 2700;  // Golongan V: truk dengan 5 gandar atau lebih
    default: return 900;
  }
};

/**
 * Convert vehicle class to label
 */
const vehicleClassToLabel = (vehicleClass) => {
  switch(vehicleClass) {
    case 1: return "I";
    case 2: return "II";
    case 3: return "III";
    case 4: return "IV";
    case 5: return "V";
    default: return vehicleClass.toString();
  }
};