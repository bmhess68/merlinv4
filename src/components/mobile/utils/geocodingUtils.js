// Import the API configuration
import { getOverpassUrl, getSmartOverpassUrl } from '../../../config/apiConfig';

// Add API configuration at the top of the file
const API_CONFIG = {
  nominatim: {
    // Only use the public OSM endpoint instead of local server
    url: 'https://nominatim.openstreetmap.org',
    // No API key needed for public service
    apiKey: null,
    // Same fallback as the primary URL now
    fallback: 'https://nominatim.openstreetmap.org'
  }
};

// Create a rate limiting mechanism for API calls
const apiRateLimiter = {
  overpassLastCall: 0,
  nominatimLastCall: 0,
  minDelayBetweenCalls: 1000, // 1 second between calls
  overpassDelay: 2000, // 2 seconds between Overpass calls (more strict)

  canCallOverpass() {
    const now = Date.now();
    return now - this.overpassLastCall >= this.overpassDelay;
  },

  canCallNominatim() {
    const now = Date.now();
    return now - this.nominatimLastCall >= this.minDelayBetweenCalls;
  },

  registerOverpassCall() {
    this.overpassLastCall = Date.now();
  },

  registerNominatimCall() {
    this.nominatimLastCall = Date.now();
  },

  async waitForOverpassSlot(abortSignal) {
    const now = Date.now();
    const waitTime = Math.max(0, this.overpassDelay - (now - this.overpassLastCall));
    
    if (waitTime > 0) {
      console.log(`Rate limiting: waiting ${waitTime}ms before Overpass API call`);
      
      // Check if signal is already aborted before creating a promise
      if (abortSignal && abortSignal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, waitTime);
        
        // Only add the abort listener if signal exists
        let abortHandler;
        if (abortSignal) {
          abortHandler = () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          };
          abortSignal.addEventListener('abort', abortHandler);
        }
        
        // Clean up the timer and listeners when done
        Promise.prototype.finally.call(Promise.resolve(), () => {
          clearTimeout(timeoutId);
          if (abortSignal && abortHandler) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
        });
      });
    }
    
    this.registerOverpassCall();
  },

  async waitForNominatimSlot(abortSignal) {
    const now = Date.now();
    const waitTime = Math.max(0, this.minDelayBetweenCalls - (now - this.nominatimLastCall));
    
    if (waitTime > 0) {
      console.log(`Rate limiting: waiting ${waitTime}ms before Nominatim API call`);
      
      // Check if signal is already aborted before creating a promise
      if (abortSignal && abortSignal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, waitTime);
        
        // Only add the abort listener if signal exists
        let abortHandler;
        if (abortSignal) {
          abortHandler = () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          };
          abortSignal.addEventListener('abort', abortHandler);
        }
        
        // Clean up the timer and listeners when done
        Promise.prototype.finally.call(Promise.resolve(), () => {
          clearTimeout(timeoutId);
          if (abortSignal && abortHandler) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
        });
      });
    }
    
    this.registerNominatimCall();
  }
};

// Retry logic for API calls with exponential backoff
const withRetry = async (fn, maxRetries = 3, initialDelay = 1000) => {
  // Convert maxRetries to a number to ensure it's valid
  maxRetries = parseInt(maxRetries, 10) || 3;
  
  for (let retries = 0; retries <= maxRetries; retries++) {
    try {
      // On first attempt, just call the function
      return await fn();
    } catch (error) {
      // On AbortError, immediately stop retry loop
      if (error.name === 'AbortError') {
        throw error;
      }
      
      // If we've used all retries, throw the last error
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = initialDelay * Math.pow(1.5, retries) + Math.random() * 1000;
      console.log(`Retry ${retries + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Create a function to create a cache with size limits
const createCache = (maxSize = 100, ttlMs = 24 * 60 * 60 * 1000) => { // Default TTL: 24 hours
  const cache = new Map();
  
  return {
    get(key) {
      const item = cache.get(key);
      if (!item) return null;
      
      // Check if the item has expired
      if (ttlMs > 0 && Date.now() - item.timestamp > ttlMs) {
        cache.delete(key);
        return null;
      }
      
      return item.value;
    },
    
    has(key) {
      const item = cache.get(key);
      if (!item) return false;
      
      // Check if the item has expired
      if (ttlMs > 0 && Date.now() - item.timestamp > ttlMs) {
        cache.delete(key);
        return false;
      }
      
      return true;
    },
    
    set(key, value) {
      // If cache is full, remove oldest item
      if (cache.size >= maxSize) {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [k, v] of cache.entries()) {
          if (v.timestamp < oldestTime) {
            oldestTime = v.timestamp;
            oldestKey = k;
          }
        }
        
        if (oldestKey) {
          cache.delete(oldestKey);
        }
      }
      
      cache.set(key, {
        value,
        timestamp: Date.now()
      });
    },
    
    delete(key) {
      cache.delete(key);
    },
    
    clear() {
      cache.clear();
    },
    
    get size() {
      return cache.size;
    }
  };
};

// Create global caches for different services
const geocodeCache = createCache(500, 7 * 24 * 60 * 60 * 1000); // 500 entries, 7 day TTL
const intersectionCache = createCache(100, 24 * 60 * 60 * 1000); // 100 entries, 1 day TTL

// Convert meters to imperial measurements (feet or miles)
const metersToImperial = (meters) => {
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

// Ensure heading is always a valid number to avoid issues with Overpass API
export const sanitizeHeading = (heading) => {
    if (heading === undefined || heading === null || isNaN(heading)) {
        return 0;
    }
    
    // Normalize heading to the range 0-359
    return (Math.round(heading) % 360 + 360) % 360;
};

// Get the next intersection ahead using Overpass API
const getNextIntersectionFromOverpass = async (lat, lon, heading, radius = 250, abortSignal) => {
  try {
    // Round coordinates for cache key (4 decimal places is ~11 meters precision - sufficient for intersection data)
    const headingRounded = Math.round(heading / 10) * 10; // Round to nearest 10 degrees
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)},${headingRounded},${radius}`;
    
    // Check cache first
    if (intersectionCache.has(cacheKey)) {
      console.log(`Using cached intersection data for ${cacheKey}`);
      return intersectionCache.get(cacheKey);
    }
    
    // Wait for rate limiter slot
    await apiRateLimiter.waitForOverpassSlot(abortSignal);
    
    // Instead of creating the bounding box from current position + heading,
    // use a simple radius approach to get all nearby features first
    const boundingBoxRadius = radius / 111000; // Convert meters to rough degrees
    
    // Create a bounding box
    const boundingBox = {
      minLat: lat - boundingBoxRadius,
      minLon: lon - boundingBoxRadius,
      maxLat: lat + boundingBoxRadius,
      maxLon: lon + boundingBoxRadius
    };
    
    // Build the Overpass query - completely rewrote with proper syntax for the arrow operators
    const overpassQuery = `
[out:json];
(
  // Highway exits and junctions with detailed data
  node["highway"="motorway_junction"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  
  // Specifically capture exits with ref numbers (exit numbers)
  node["highway"="motorway_junction"]["ref"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  
  // Also get exit destinations (to where the exit leads)
  node["highway"="motorway_junction"]["exit_to"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  
  // All road intersections (more comprehensive than just traffic signals)
  way["highway"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  node(w)->.highway_nodes;
  
  // Find actual intersections (where multiple ways meet)
  .highway_nodes->.potential_intersections;
  way["highway"]["name"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon})->.named_roads;
  node.potential_intersections->.potential_intersections_filtered;
  .potential_intersections_filtered>.named_roads->.real_nodes;
  
  // Include stop signs and traffic signals as they often mark intersections
  node["highway"="stop"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  node["highway"="traffic_signals"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  
  // Capture on/off ramps which often indicate upcoming exits
  way["highway"="motorway_link"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
  
  // Get named nodes and points of interest
  node["name"](${boundingBox.minLat},${boundingBox.minLon},${boundingBox.maxLat},${boundingBox.maxLon});
);
out body;
way(bn);
out tags;`;
    
    // Get proper Overpass API URL - resolve Promise before using
    let apiUrl;
    try {
      apiUrl = await getSmartOverpassUrl();
      console.log(`Using Overpass API endpoint: ${apiUrl}`);
    } catch (error) {
      console.error("Error getting smart Overpass URL, falling back to default:", error);
      apiUrl = getOverpassUrl(); // Fallback to synchronous version
    }
    
    // Wrap the API call in retry logic
    const data = await withRetry(async () => {
      try {
        // Check if the abort signal is already aborted
        if (abortSignal && abortSignal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        
        console.log(`Querying Overpass API for intersections near ${lat}, ${lon} with heading ${heading}`);
        
        // Create a controller for timeout
        const timeoutController = new AbortController();
        
        // Create a combined signal that aborts if either the user signal or timeout signal aborts
        let combinedSignal = timeoutController.signal;
        
        // Set up abort forwarding from user signal to our controller if user signal exists
        let abortHandler;
        if (abortSignal) {
          abortHandler = () => timeoutController.abort();
          abortSignal.addEventListener('abort', abortHandler);
        }
        
        let timeoutId;
        
        try {
          // Set timeout for 5 seconds
          timeoutId = setTimeout(() => {
            timeoutController.abort();
          }, 5000);
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            body: `data=${encodeURIComponent(overpassQuery)}`,
            signal: combinedSignal
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Overpass API error (${response.status}):`, errorText);
            
            // Special handling for rate limiting
            if (response.status === 429) {
              console.log("Rate limited by Overpass API, increasing delay");
              apiRateLimiter.overpassDelay = Math.min(apiRateLimiter.overpassDelay * 2, 30000); // Up to 30 seconds
              throw new Error('Rate limited by Overpass API');
            }
            
            throw new Error(`Overpass API returned ${response.status}: ${errorText}`);
          }
          
          const data = await response.json();
          
          // If request succeeded, gradually reduce the delay back to normal
          if (apiRateLimiter.overpassDelay > 2000) {
            apiRateLimiter.overpassDelay = Math.max(2000, apiRateLimiter.overpassDelay * 0.8);
          }
          
          // Cache the result before returning
          intersectionCache.set(cacheKey, data);
          
          return data;
        } finally {
          // Clean up timeout and abort handler
          clearTimeout(timeoutId);
          if (abortSignal && abortHandler) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Overpass API request was aborted');
          throw error;
        }
        
        console.error('Error fetching from Overpass API:', error);
        throw error;
      }
    });
    
    return data;
  } catch (error) {
    console.error('Error in getNextIntersectionFromOverpass:', error);
    throw error;
  }
};

// Reverse geocode a coordinate to an address
export const reverseGeocode = async (latitude, longitude, abortSignal) => {
  // Round coordinates for cache key (5 decimal places is ~1 meter precision)
  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  
  // Check cache first to avoid unnecessary API calls
  if (geocodeCache.has(cacheKey)) {
    console.log(`[GEOCODING-UTILS] Using cached geocoding result for ${cacheKey}`);
    return geocodeCache.get(cacheKey);
  }
  
  console.log(`[GEOCODING-UTILS] Starting reverse geocoding for ${latitude}, ${longitude}`);
  
  try {
    // OSM usage policy: at most 1 request per second
    await apiRateLimiter.waitForNominatimSlot(abortSignal);
    
    // Create options for the fetch request with required User-Agent
    const options = {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MerlinMobileApp/1.0 (westchesterrtc.com)',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      mode: 'cors',
      signal: abortSignal,
      cache: 'no-store',
      credentials: 'omit'
    };
    
    // Simplify the URL construction
    const apiUrl = `${API_CONFIG.nominatim.url}/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
    console.log(`[GEOCODING-UTILS] Using Nominatim API URL: ${apiUrl}`);
    
    // Use a simpler fetch approach
    try {
      console.log(`[GEOCODING-UTILS] Making request to: ${apiUrl}`);
      let response;
      
      // First attempt
      try {
        response = await fetch(apiUrl, options);
        console.log(`[GEOCODING-UTILS] Response status: ${response.status}`);
      } catch (error) {
        console.error(`[GEOCODING-UTILS] First fetch attempt failed: ${error.message}`);
        
        // Wait and retry once
        console.log(`[GEOCODING-UTILS] Waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`[GEOCODING-UTILS] Retrying request`);
        
        // Second attempt
        response = await fetch(apiUrl, options);
        console.log(`[GEOCODING-UTILS] Retry response status: ${response.status}`);
      }
      
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      
      // Parse the JSON response
      const data = await response.json();
      console.log(`[GEOCODING-UTILS] Successfully parsed JSON`);
      
      // Create result and cache it
      const result = {
        ...data,
        addressComponents: data.address,
        isFallback: false
      };
      
      geocodeCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`[GEOCODING-UTILS] Error in geocoding request:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`[GEOCODING-UTILS] Error in reverseGeocode:`, error);
    
    if (error.message && error.message.includes('CORS')) {
      console.error(`[GEOCODING-UTILS] CORS issue detected - check server configuration`);
    }
    
    throw error;
  }
};

// Process the Overpass data to extract relevant information
const processOverpassData = (data, lat, lon, heading) => {
  if (!data || !data.elements || data.elements.length === 0) {
    console.log("No elements found in Overpass data");
    return null;
  }
  
  try {
    console.log(`Processing Overpass data with ${data.elements.length} elements`);
    
    // Filter to only node elements and calculate distance for each
    const nodes = data.elements
      .filter(element => element.type === 'node')
      .map(node => {
        // Calculate distance from the original point in meters
        const distance = calculateDistance(
          lat, lon, 
          node.lat, node.lon
        ) * 1000; // Convert km to meters
        
        // Calculate angle and heading difference to determine if it's ahead
        const angle = calculateBearing(lat, lon, node.lat, node.lon);
        const headingDifference = calculateHeadingDifference(heading, angle);
        
        // Consider a node ahead if it's within 90 degrees of our heading
        const isAhead = headingDifference <= 90;
        
        return {
          ...node,
          distance,
          formattedDistance: metersToImperial(distance),
          angle,
          headingDifference,
          isAhead
        };
      })
      // Sort by distance
      .sort((a, b) => a.distance - b.distance);
    
    console.log(`Found ${nodes.length} nodes after filtering and sorting`);
    
    // Extract intersections (traffic lights, stop signs, or named intersections)
    const intersections = nodes.filter(node => {
      // Check if it's a traffic light or stop sign
      if (node.tags && (
          node.tags.highway === 'traffic_signals' || 
          node.tags.highway === 'stop' ||
          node.tags.highway === 'crossing'
        )) {
        return true;
      }
      
      // Check if it has a name (might be a named intersection)
      if (node.tags && node.tags.name) {
        return true;
      }
      
      return false;
    });
    
    // Extract highway exits (motorway junctions)
    const exits = nodes.filter(node => 
      node.tags && node.tags.highway === 'motorway_junction'
    );
    
    console.log(`Found ${intersections.length} intersections and ${exits.length} exits`);
    
    // Find nearest intersection ahead (in the direction we're traveling)
    const nextIntersection = intersections
      .filter(node => node.isAhead)
      .sort((a, b) => a.distance - b.distance)[0];
    
    // Find nearest exit ahead
    const nearestExit = exits
      .filter(node => node.isAhead)
      .sort((a, b) => a.distance - b.distance)[0];
    
    // Find closest intersection regardless of direction
    const nearestIntersection = intersections
      .sort((a, b) => a.distance - b.distance)[0];
    
    // Build the result
    const result = {};
    
    // Format the next intersection information
    if (nextIntersection) {
      const name = nextIntersection.tags.name || 
                   (nextIntersection.tags.highway === 'traffic_signals' ? 'Traffic Light' : 
                   (nextIntersection.tags.highway === 'stop' ? 'Stop Sign' : 'Intersection'));
      result.nextIntersection = `${name} (${nextIntersection.formattedDistance} ahead)`;
    }
    
    // Format the nearest exit information
    if (nearestExit) {
      const exitRef = nearestExit.tags.ref ? `Exit ${nearestExit.tags.ref}` : 'Exit';
      const exitTo = nearestExit.tags.exit_to ? ` to ${nearestExit.tags.exit_to}` : '';
      result.nearestExit = `${exitRef}${exitTo} (${nearestExit.formattedDistance} ahead)`;
    }
    
    // Format the nearest intersection information if we don't have one ahead
    if (nearestIntersection && !nextIntersection) {
      const name = nearestIntersection.tags.name || 
                   (nearestIntersection.tags.highway === 'traffic_signals' ? 'Traffic Light' : 
                   (nearestIntersection.tags.highway === 'stop' ? 'Stop Sign' : 'Intersection'));
      const direction = nearestIntersection.isAhead ? 'ahead' : 'nearby';
      result.nearestIntersection = `${name} (${nearestIntersection.formattedDistance} ${direction})`;
    }
    
    console.log('Processed intersection data:', result);
    
    return result;
  } catch (error) {
    console.error('Error processing Overpass data:', error);
    return null;
  }
};

// Function to fetch a vehicle's location
export const fetchVehicleLocation = async (displayName) => {
  if (!displayName) return null;
  
  try {
    // Fetch the latest locations from the endpoint
    const response = await fetch('/api/update-locations', {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched location data:', data);
    
    // Find the vehicle with the matching displayName
    const vehicle = data.find(v => v.displayName === displayName);
    
    if (vehicle) {
      console.log('Found vehicle data:', vehicle);
      return {
        displayName: vehicle.displayName,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        heading: vehicle.heading || 0,
        // Add any other properties needed for reverse geocoding
        address: null // Will be filled by reverse geocoding
      };
    } else {
      console.warn(`Vehicle with displayName "${displayName}" not found in location data`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching vehicle location:', error);
    return null;
  }
};

// Calculate the distance between two points in kilometers
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Calculate the bearing/heading from point 1 to point 2
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  // Convert to radians
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lonDiff = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(lonDiff) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
          Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lonDiff);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) {
    bearing += 360;
  }
  
  return bearing;
};

// Calculate the difference between two headings (0-359 degrees)
const calculateHeadingDifference = (heading1, heading2) => {
  // Normalize inputs to 0-359 range
  heading1 = ((heading1 % 360) + 360) % 360;
  heading2 = ((heading2 % 360) + 360) % 360;
  
  // Calculate absolute difference
  let diff = Math.abs(heading1 - heading2);
  
  // Take the smaller angle (never more than 180 degrees)
  if (diff > 180) {
    diff = 360 - diff;
  }
  
  return diff;
};

// Export the functions
export {
  getNextIntersectionFromOverpass,
  apiRateLimiter, // Export for testing and monitoring
  processOverpassData,
  calculateDistance,
  calculateBearing,
  calculateHeadingDifference,
  metersToImperial
};