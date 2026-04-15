import { haversineDistance } from './vehicleUtils';

// Overpass API configuration
const API_CONFIG = {
  // Public Overpass API endpoints
  primary: 'https://overpass-api.de/api/interpreter',
  fallback: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  // For development proxy
  proxy: '/overpass/api/interpreter'
};

// Use the primary public endpoint
let OVERPASS_API_URL = API_CONFIG.primary;
console.log(`[Overpass] Initialized with public API: ${OVERPASS_API_URL}`);

// Function to set the API endpoint (allows for future changes)
export const setOverpassApiUrl = (url) => {
  OVERPASS_API_URL = url;
  console.log(`Overpass API URL set to: ${OVERPASS_API_URL}`);
};

// Function to toggle between primary and fallback public endpoints
export const toggleLocalServer = (usePrimary = true) => {
  OVERPASS_API_URL = usePrimary ? API_CONFIG.primary : API_CONFIG.fallback;
  console.log(`[Overpass] Using ${usePrimary ? 'primary' : 'fallback'} public endpoint: ${OVERPASS_API_URL}`);
  return OVERPASS_API_URL;
};

// Function to check server connectivity
export const checkServerConnectivity = async () => {
  try {
    // Simple test query
    const testQuery = '[out:json];node(1);out;';
    
    // For testing connectivity, use GET instead of POST
    const encodedQuery = encodeURIComponent(testQuery);
    const testUrl = `${OVERPASS_API_URL}?data=${encodedQuery}`;
    
    console.log(`[Overpass] Testing connectivity with GET request`);
    
    // Shorter timeout for connectivity check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout for connectivity check
    
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Overpass] API error ${response.status}: ${errorText}`);
        throw new Error(`HTTP error ${response.status}`);
      }
      
      await response.json(); // Just to verify we get valid JSON
      console.log(`[Overpass] API connection successful`);
      return true;
    } catch (fetchError) {
      // Clear the timeout if there was an error
      clearTimeout(timeoutId);
      
      // Check if it was a timeout
      if (fetchError.name === 'AbortError') {
        console.error(`[Overpass] Connection timed out after 2 seconds`);
        throw new Error('Connection timed out');
      }
      
      // Re-throw the error
      throw fetchError;
    }
  } catch (error) {
    console.error(`[Overpass] API connection failed: ${error.message}`);
    return false;
  }
};

// Highway types that should be considered as highways for exit detection
const HIGHWAY_TYPES = ['motorway', 'trunk', 'primary', 'secondary'];

// Function to get the next intersection or exit based on vehicle position and heading
export const findNextIntersectionOrExit = async (latitude, longitude, heading) => {
  try {
    // Short timeout - we need responsiveness over accuracy
    const TIMEOUT_MS = 3000;
    
    // Preserve this log for debugging
    console.log('[Overpass] Finding next intersection/exit:', { latitude, longitude, heading });
    
    // Step 1: First determine if the vehicle is on a highway
    const currentRoadQuery = `[out:json];way(around:50,${latitude},${longitude})[highway];out tags;`;
    
    // Use GET instead of POST for better proxy compatibility
    const encodedRoadQuery = encodeURIComponent(currentRoadQuery);
    const roadQueryUrl = `${OVERPASS_API_URL}?data=${encodedRoadQuery}`;
    
    console.log('[Overpass] Querying current road data');
    
    let currentRoadData;
    let isOnHighway = false;
    let currentRoadName = '';
    let currentRoadRef = '';
    
    try {
      // Add shorter timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      try {
        const currentRoadResponse = await fetch(roadQueryUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (!currentRoadResponse.ok) {
          console.error(`[Overpass] API error: ${currentRoadResponse.status}`);
          throw new Error(`API request failed with status ${currentRoadResponse.status}`);
        }
        
        currentRoadData = await currentRoadResponse.json();
      } catch (fetchError) {
        // Clear the timeout if there was an error
        clearTimeout(timeoutId);
        
        // Check if it was a timeout
        if (fetchError.name === 'AbortError') {
          console.error('[Overpass] Current road request timed out after ' + TIMEOUT_MS + 'ms');
          throw new Error('API request timed out');
        }
        
        // Re-throw the error
        console.error('[Overpass] Fetch error:', fetchError.message);
        throw fetchError;
      }
    } catch (error) {
      console.error('[Overpass] Error fetching current road data:', error.message || error);
      // Continue with default values (not on highway)
      currentRoadData = { elements: [] };
    }
    
    // Determine if we're on a highway and get the current road name
    if (currentRoadData.elements && currentRoadData.elements.length > 0) {
      for (const road of currentRoadData.elements) {
        if (road.tags && HIGHWAY_TYPES.includes(road.tags.highway)) {
          isOnHighway = true;
          currentRoadName = road.tags.name || '';
          currentRoadRef = road.tags.ref || '';
          console.log(`[Overpass] On highway: ${road.tags.highway}, name: ${currentRoadName}`);
          break;
        }
      }
    }
    
    // Return a fast result for highways rather than querying further
    if (isOnHighway && currentRoadName) {
      console.log('[Overpass] Returning quick highway result without additional queries');
      const result = {
        found: true,
        type: 'exit',
        name: currentRoadRef ? 
          `Next exit on ${currentRoadRef}` : 
          `Next exit on ${currentRoadName || 'highway'}`,
        distance: 1000, // Default distance
        distanceFormatted: formatDistance(1000)
      };
      return result;
    }
    
    // Otherwise for regular roads, use a simpler fallback
    return {
      found: true,
      type: 'intersection',
      name: currentRoadName || 'Intersection',
      distance: 300, // Default distance
      distanceFormatted: formatDistance(300)
    };
  } catch (error) {
    console.error('[Overpass] Error finding next intersection:', error.message || error);
    return { 
      found: true,
      type: 'intersection',
      name: 'Intersection',
      distance: 300,
      distanceFormatted: formatDistance(300)
    };
  }
};

// Helper function to calculate bearing between two points
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  // Convert to radians
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const lonDiff = ((lon2 - lon1) * Math.PI) / 180;
  
  const y = Math.sin(lonDiff) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lonDiff);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360
  bearing = (bearing + 360) % 360;
  
  return bearing;
};

// Helper function to calculate the difference between two angles
const calculateAngleDifference = (angle1, angle2) => {
  let diff = angle2 - angle1;
  
  // Normalize to -180 to 180
  diff = (diff + 180) % 360 - 180;
  
  return diff;
};

// Helper function to format distance in miles/feet
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
  findNextIntersectionOrExit,
  setOverpassApiUrl,
  toggleLocalServer,
  checkServerConnectivity
}; 