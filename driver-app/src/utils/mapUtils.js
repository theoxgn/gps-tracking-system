/**
 * Create a custom marker icon for the map
 * @param {string} color - Hex color for the marker
 * @returns {L.DivIcon} Leaflet div icon
 */
export const createCustomIcon = (color) => {
  // This function should be imported from mapUtils.js
  return window.L.divIcon({
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

/**
 * Calculate distance between two points using Haversine formula
 * @param {Array} point1 - [lat, lng]
 * @param {Array} point2 - [lat, lng]
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (point1, point2) => {
  if (!point1 || !point2) return 0;
  
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
 * Format a distance in meters to a human-readable string
 * @param {number} distance - Distance in meters
 * @returns {string} Formatted distance
 */
export const formatDistance = (distance) => {
  if (distance < 1000) {
    return `${Math.round(distance)} m`;
  } else {
    return `${(distance / 1000).toFixed(1)} km`;
  }
};

/**
 * Format a duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) {
    return '< 1 menit';
  } else if (minutes < 60) {
    return `${minutes} menit`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours} jam${remainingMinutes > 0 ? ` ${remainingMinutes} menit` : ''}`;
  }
};

/**
 * Get the heading direction between two points
 * @param {Array} start - [lat, lng]
 * @param {Array} end - [lat, lng]
 * @returns {string} Cardinal direction (e.g., "utara", "tenggara", etc.)
 */
export const getHeadingDirection = (start, end) => {
  const y = Math.sin((end[1] - start[1]) * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180);
  const x = Math.cos(start[0] * Math.PI / 180) * Math.sin(end[0] * Math.PI / 180) -
            Math.sin(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) * 
            Math.cos((end[1] - start[1]) * Math.PI / 180);
  const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  
  if (bearing >= 337.5 || bearing < 22.5) return "utara";
  else if (bearing >= 22.5 && bearing < 67.5) return "timur laut";
  else if (bearing >= 67.5 && bearing < 112.5) return "timur";
  else if (bearing >= 112.5 && bearing < 157.5) return "tenggara";
  else if (bearing >= 157.5 && bearing < 202.5) return "selatan";
  else if (bearing >= 202.5 && bearing < 247.5) return "barat daya";
  else if (bearing >= 247.5 && bearing < 292.5) return "barat";
  else return "barat laut";
};

/**
 * Convert a transport mode to OSRM profile
 * @param {string} mode - Transport mode from the UI
 * @returns {string} OSRM profile
 */
export const transportModeToOsrmProfile = (mode) => {
  switch (mode) {
    case 'driving-car':
    case 'car':
      return 'car';
    case 'driving-hgv':
    case 'truck':
      return 'car'; // OSRM public doesn't have a truck profile
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
 * Generate basic instructions for a direct route
 * @param {Array} startPoint - [lat, lng]
 * @param {Array} endPoint - [lat, lng]
 * @returns {Array} Array of instruction objects
 */
export const generateBasicInstructions = (startPoint, endPoint) => {
  const distance = calculateDistance(startPoint, endPoint);
  const direction = getHeadingDirection(startPoint, endPoint);
  
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
      distance: distance * 1000, // Convert to meters
      duration: (distance / 50) * 3600, // Estimated seconds at 50 km/h
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