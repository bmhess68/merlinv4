import { haversineDistance } from './vehicleUtils';

// OSRM API Configuration
const OSRM_CONFIG = {
  // Public OSRM servers
  primary: 'https://router.project-osrm.org',
  fallback: 'https://routing.openstreetmap.de/routed-car',
  // For development proxy
  proxy: '/osrm'
};

// Use the public endpoint
let OSRM_API_URL = OSRM_CONFIG.primary;
console.log(`[OSRM] Initialized with public API: ${OSRM_API_URL}`);

/**
 * Set the OSRM API endpoint URL
 * @param {string} url - The URL to set
 */
export const setOsrmApiUrl = (url) => {
  OSRM_API_URL = url;
  console.log(`OSRM API URL set to: ${OSRM_API_URL}`);
};

/**
 * Toggle between primary and fallback public OSRM endpoints
 * @param {boolean} usePrimary - Whether to use the primary public endpoint
 * @returns {string} The current OSRM API URL
 */
export const toggleLocalOsrmServer = (usePrimary = true) => {
  OSRM_API_URL = usePrimary ? OSRM_CONFIG.primary : OSRM_CONFIG.fallback;
  console.log(`[OSRM] Using ${usePrimary ? 'primary' : 'fallback'} public endpoint: ${OSRM_API_URL}`);
  return OSRM_API_URL;
};

/**
 * Check connectivity to the OSRM API server
 * @returns {Promise<boolean>} Whether the server is reachable
 */
export const checkOsrmConnectivity = async () => {
  try {
    // Test with a simple route request - properly formatted for OSRM
    // The format should be /route/v1/driving/{lon1},{lat1};{lon2},{lat2}
    const testUrl = `${OSRM_API_URL}/route/v1/driving/-73.84768,41.01807;-73.84768,41.01907?overview=false`;
    
    console.log(`Testing connectivity to OSRM API at: ${OSRM_API_URL}`);
    
    // Use a shorter timeout for connectivity check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    try {
      const response = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OSRM API HTTP error ${response.status}: ${errorText}`);
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`OSRM API connection successful`);
      return true;
    } catch (fetchError) {
      // Clear the timeout if there was an error
      clearTimeout(timeoutId);
      
      // Check if it was a timeout
      if (fetchError.name === 'AbortError') {
        console.error(`OSRM API connection timed out after 3 seconds`);
        throw new Error('Connection timed out');
      }
      
      // Re-throw the error
      throw fetchError;
    }
  } catch (error) {
    console.error(`OSRM API connection failed: ${error.message}`);
    return false;
  }
};

/**
 * Get routing information for a vehicle's current position and heading
 * Used to find exits, intersections, and next maneuvers
 * 
 * @param {number} latitude - Current latitude
 * @param {number} longitude - Current longitude
 * @param {number} heading - Current heading in degrees
 * @returns {Promise<object>} - Routing information including next maneuver
 */
export const getNextManeuver = async (latitude, longitude, heading) => {
  try {
    // Short timeout - we need responsiveness over accuracy
    const TIMEOUT_MS = 3000;
    
    // Calculate destination point based on heading and distance (2km forward)
    const earthRadius = 6371000; // Earth radius in meters
    const distance = 2000; // 2km ahead
    
    // Convert heading to radians
    const headingRad = (heading * Math.PI) / 180;
    
    // Calculate destination point
    const destLat = Math.asin(
      Math.sin(latitude * Math.PI / 180) * Math.cos(distance / earthRadius) +
      Math.cos(latitude * Math.PI / 180) * Math.sin(distance / earthRadius) * Math.cos(headingRad)
    ) * 180 / Math.PI;
    
    const destLng = longitude + Math.atan2(
      Math.sin(headingRad) * Math.sin(distance / earthRadius) * Math.cos(latitude * Math.PI / 180),
      Math.cos(distance / earthRadius) - Math.sin(latitude * Math.PI / 180) * Math.sin(destLat * Math.PI / 180)
    ) * 180 / Math.PI;
    
    // Ensure consistent coordinate precision
    const coordsStart = `${longitude.toFixed(6)},${latitude.toFixed(6)}`;
    const coordsEnd = `${destLng.toFixed(6)},${destLat.toFixed(6)}`;
    
    // Create URL for OSRM route request - careful with the formatting
    const routeUrl = `${OSRM_API_URL}/route/v1/driving/${coordsStart};${coordsEnd}?overview=false&steps=true`;
    
    console.log('[OSRM] Sending request to:', routeUrl);
    
    // Fetch with timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
      // Fetch the route
      const response = await fetch(routeUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OSRM] HTTP error ${response.status}:`, errorText);
        throw new Error(`OSRM API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        console.error('[OSRM] Could not generate a route. Response:', data);
        return {
          found: false,
          message: 'No route found'
        };
      }
      
      // Process the route
      const route = data.routes[0];
      console.log('[OSRM] Route summary:', route.summary, 'Distance:', route.distance);
      
      const legs = route.legs;
      
      if (!legs || legs.length === 0 || !legs[0].steps || legs[0].steps.length === 0) {
        console.error('[OSRM] No route steps found in response');
        return {
          found: false,
          message: 'No route steps found'
        };
      }
      
      // Get current and next steps
      const steps = legs[0].steps;
      
      // Format and check for intersections/exits
      const result = processRouteSteps(steps, latitude, longitude);
      
      return result;
    } catch (fetchError) {
      // Clear the timeout if there was an error
      clearTimeout(timeoutId);
      
      // Check if it was a timeout
      if (fetchError.name === 'AbortError') {
        console.error('[OSRM] Request timed out after ' + TIMEOUT_MS + 'ms');
        throw new Error('OSRM API request timed out');
      }
      
      // Re-throw the error
      throw fetchError;
    }
  } catch (error) {
    console.error('[OSRM] Error getting route information:', error);
    return {
      found: false,
      error: error.message || 'Unknown error'
    };
  }
};

/**
 * Process route steps to extract next maneuver information
 * 
 * @param {Array} steps - OSRM route steps
 * @param {number} currentLat - Current latitude
 * @param {number} currentLng - Current longitude
 * @returns {object} Intersection or exit information
 */
const processRouteSteps = (steps, currentLat, currentLng) => {
  console.log('[OSRM] Processing route steps...');
  
  if (steps.length < 2) {
    console.log('[OSRM] Not enough steps to determine next maneuver, using fallback');
    // In case we don't have enough steps, return a simple result
    return {
      found: true,
      type: 'intersection',
      name: 'Unknown road ahead',
      distance: 300,
      distanceFormatted: '984ft'
    };
  }
  
  // Skip the initial step (current location)
  const nextStep = steps[1];
  const maneuver = nextStep.maneuver;
  
  console.log('[OSRM] Next maneuver data:', maneuver);
  
  if (!maneuver) {
    console.log('[OSRM] No maneuver information available in step, using fallback');
    // Even if we don't have maneuver info, try to extract a road name
    const fallbackName = nextStep.name || 'Unknown road';
    return {
      found: true,
      type: 'intersection',
      name: fallbackName,
      distance: 300,
      distanceFormatted: '984ft'
    };
  }
  
  // Check the maneuver type
  const { type, modifier } = maneuver;
  console.log(`[OSRM] Maneuver type: ${type}, modifier: ${modifier}`);
  
  // Extract useful road info from OSRM response
  const roadName = nextStep.name || '';
  const roadRef = nextStep.ref || '';
  const isHighway = nextStep.highway === 'motorway' || roadRef.includes('-') || roadName.includes('Highway') || roadName.includes('Freeway');
  
  console.log(`[OSRM] Road info - Name: "${roadName}", Ref: "${roadRef}", isHighway: ${isHighway}`);
  
  // Calculate distance to the maneuver
  const maneuverLat = maneuver.location[1];
  const maneuverLng = maneuver.location[0];
  const distance = haversineDistance(currentLat, currentLng, maneuverLat, maneuverLng);
  
  // Format distance in imperial
  const distanceFormatted = formatDistance(distance);
  console.log(`[OSRM] Distance to maneuver: ${distance}m (${distanceFormatted})`);
  
  // Determine if this is an exit based on maneuver type
  const isExit = type === 'off ramp' || type === 'fork' || type === 'exit' || 
                (isHighway && (type === 'turn' || type === 'continue'));
  
  const maneuverType = isExit ? 'exit' : 'intersection';
  console.log(`[OSRM] Maneuver classified as: ${maneuverType}`);
  
  // Format the maneuver name - simplified for cleaner display
  let maneuverName = '';
  
  if (isExit) {
    // Format highway exit - focus on destination only
    if (roadRef) {
      maneuverName = `${roadRef}`;
      if (roadName) {
        maneuverName += ` (${roadName})`;
      }
    } else if (roadName) {
      maneuverName = roadName;
    } else {
      maneuverName = 'Highway exit';
    }
  } else {
    // Format intersection - just use the road name
    if (roadName) {
      maneuverName = roadName;
    } else if (type === 'roundabout') {
      maneuverName = 'Roundabout';
    } else {
      maneuverName = 'Intersection';
    }
  }
  
  // Make sure we always have a valid name and distance
  if (!maneuverName || maneuverName.trim() === '') {
    maneuverName = maneuverType === 'exit' ? 'Exit' : 'Intersection';
  }
  
  // Return the formatted result with simplified information
  return {
    found: true,
    type: maneuverType,
    name: maneuverName,
    distance: distance || 300, // Default to 300m if calculation failed
    distanceFormatted: distanceFormatted || '984ft', // Default if formatting failed
    rawManeuver: maneuver,
    rawStep: nextStep
  };
};

/**
 * Format distance in feet/miles
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance
 */
const formatDistance = (meters) => {
  if (meters === undefined || meters === null) return '';
  
  const feet = meters * 3.28084;
  
  if (feet < 1000) {
    // Less than 1000 feet, show in feet
    return `${Math.round(feet)}ft`;
  } else {
    // More than 1000 feet, show in miles with one decimal
    const miles = feet / 5280;
    return `${miles.toFixed(1)}mi`;
  }
};

export default {
  getNextManeuver,
  setOsrmApiUrl,
  toggleLocalOsrmServer,
  checkOsrmConnectivity
}; 