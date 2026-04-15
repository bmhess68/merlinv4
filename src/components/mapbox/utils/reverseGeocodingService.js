import { reverseGeocode } from '../../mobile/utils/geocodingUtils';
import { getSmartOverpassUrl, getOverpassUrl } from '../../../config/apiConfig';

/**
 * GeocodingService for Mapbox components
 * This service handles geocoding operations for the Mapbox mobile map
 * It encapsulates the logic for reverse geocoding (coordinates to address)
 */
class GeocodingService {
  constructor() {
    this.lastRequest = null;
    this.lastCoords = null;
    this.minDistanceChange = 10; // minimum distance in meters to trigger a new request
    this.debounceTime = 1000; // minimum time between requests in ms
    this.cachedResults = new Map(); // cache for geocoding results
    this.isGeocoding = false;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude of point 1
   * @param {number} lon1 - Longitude of point 1
   * @param {number} lat2 - Latitude of point 2
   * @param {number} lon2 - Longitude of point 2
   * @returns {number} Distance in meters
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check if we should make a new request based on time and distance thresholds
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude 
   * @returns {boolean} - Whether to make a new request
   */
  shouldMakeNewRequest(latitude, longitude) {
    console.log("[GEOCODING] shouldMakeNewRequest called with:", latitude, longitude);
    
    // No previous request, definitely make a new one
    if (!this.lastRequest || !this.lastCoords) {
      console.log("[GEOCODING] No previous request, making new request");
      return true;
    }
    
    // Calculate time since last request
    const timeSinceLastRequest = Date.now() - this.lastRequest;
    
    // If we've waited long enough, make a new request
    if (timeSinceLastRequest > this.debounceTime) {
      // Check distance from last coordinates
      if (this.lastCoords && this.lastCoords.latitude && this.lastCoords.longitude) {
        const distance = this.haversineDistance(
          this.lastCoords.latitude,
          this.lastCoords.longitude,
          latitude,
          longitude
        );
        
        // If we've moved enough, make a new request
        if (distance > this.minDistanceChange) {
          console.log(`[GEOCODING] Moved ${distance.toFixed(1)}m, exceeds threshold of ${this.minDistanceChange}m, making new request`);
          return true;
        } else {
          console.log(`[GEOCODING] Moved only ${distance.toFixed(1)}m, below threshold of ${this.minDistanceChange}m, using existing result`);
          return false;
        }
      }
      
      console.log("[GEOCODING] No valid last coordinates, making new request");
      return true;
    }
    
    console.log(`[GEOCODING] Only ${timeSinceLastRequest}ms since last request, below threshold of ${this.debounceTime}ms, using existing result`);
    return false;
  }

  /**
   * Generate a cache key from coordinates
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @returns {string} Cache key
   */
  getCacheKey(latitude, longitude) {
    // Round coordinates to reduce cache size and improve hit rate
    const precision = 5; // 5 decimal places is about 1 meter precision
    return `${latitude.toFixed(precision)},${longitude.toFixed(precision)}`;
  }

  /**
   * Extract street name from address components
   * @param {Object} address - OSM address components
   * @returns {string} Street name
   */
  extractStreetName(address) {
    if (!address) return 'Unknown street';
    
    // First try to get the road/street name with house number
    if (address.road) {
      const houseNumber = address.house_number ? `${address.house_number} ` : '';
      return `${houseNumber}${address.road}`;
    } 
    
    // Try alternative street types
    const streetTypes = ['street', 'highway', 'pedestrian', 'footway', 'path', 'cycleway', 'service'];
    for (const type of streetTypes) {
      if (address[type]) {
        return address.house_number ? `${address.house_number} ${address[type]}` : address[type];
      }
    }
    
    // If we have a place name, use that
    if (address.place) {
      return address.place;
    }
    
    // If we have a named feature or amenity, use that
    if (address.amenity) {
      return address.amenity;
    }
    
    // Fall back to available address parts
    if (address.suburb) {
      return address.suburb;
    }
    
    if (address.neighbourhood) {
      return address.neighbourhood;
    }
    
    return 'Unnamed road';
  }
  
  /**
   * Extract locality (city/town/village) from address components
   * @param {Object} address - OSM address components
   * @returns {string} Locality name
   */
  extractLocality(address) {
    if (!address) return '';
    
    // Try city/town/village in order of hierarchy
    if (address.city) {
      return address.city;
    }
    
    if (address.town) {
      return address.town;
    }
    
    if (address.village) {
      return address.village;
    }
    
    if (address.hamlet) {
      return address.hamlet;
    }
    
    if (address.suburb) {
      return address.suburb;
    }
    
    if (address.neighbourhood) {
      return address.neighbourhood;
    }
    
    // If we have county and state, combine them
    if (address.county && address.state) {
      return `${address.county}, ${address.state}`;
    }
    
    // If we have just county or state, use that
    if (address.county) {
      return address.county;
    }
    
    if (address.state) {
      return address.state;
    }
    
    return '';
  }

  /**
   * Extract location name (building, amenity, etc.) from address components
   * @param {Object} address - OSM address components
   * @returns {string|null} Location name or null if none found
   */
  extractLocationName(address) {
    if (!address) return null;
    
    // Check for named POIs - in order of priority
    const nameFields = [
      'name',              // Explicit name tag
      'building:name',     // Building name
      'amenity:name',      // Amenity name
      'building',          // Building type
      'amenity',           // Amenity type
      'shop',              // Shop type
      'tourism',           // Tourism type
      'historic',          // Historic site
      'healthcare',        // Healthcare facility
      'leisure',           // Leisure facility
      'office',            // Office type
      'public_building',   // Public building
      'place_of_worship',  // Religious building
      'landuse',           // Land use type
      'military',          // Military site
      'natural',           // Natural feature
      'man_made'           // Man-made feature
    ];
    
    // First check for the explicit name property
    if (address.name) {
      console.log("[GEOCODING] Found explicit name:", address.name);
      return address.name;
    }
    
    // Then check for other name fields
    for (const field of nameFields) {
      // Skip 'name' as we already checked it
      if (field === 'name') continue;
      
      if (address[field]) {
        console.log(`[GEOCODING] Found location name from ${field}:`, address[field]);
        return address[field];
      }
    }
    
    return null;
  }

  /**
   * Get address information for a given location
   * @param {number} latitude - Latitude
   * @param {number} longitude - Longitude
   * @param {number} heading - Optional vehicle heading (no longer used for intersection lookup)
   * @returns {Promise<Object>} Geocoded location data
   */
  async getAddressForLocation(latitude, longitude, heading) {
    console.log(`[GEOCODING] getAddressForLocation called with: lat=${latitude}, lon=${longitude}, heading=${heading}`);
    
    // Check if we should make a new request
    if (!this.shouldMakeNewRequest(latitude, longitude)) {
      console.log("[GEOCODING] Skipping geocoding request - using recent result");
      return null;
    }
    
    // Update last request time and coordinates
    this.lastRequest = Date.now();
    this.lastCoords = { latitude, longitude };
    
    // Check cache first
    const cacheKey = this.getCacheKey(latitude, longitude);
    if (this.cachedResults.has(cacheKey)) {
      console.log("[GEOCODING] Using cached geocoding result for:", cacheKey);
      return this.cachedResults.get(cacheKey);
    }
    
    // Set geocoding status
    this.isGeocoding = true;
    console.log("[GEOCODING] Starting geocoding request for:", latitude, longitude);
    
    // Track if we've attempted geocoding
    let geocodingAttempted = false;
    let geocodingError = null;
    
    try {
      // Create an AbortController for the request
      const controller = new AbortController();
      const signal = controller.signal;
      
      // Create a promise that will be resolved on timeout
      const timeoutPromise = new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          console.log("[GEOCODING] Request timeout reached after 12 seconds, aborting");
          controller.abort();
          reject(new Error("Geocoding timeout"));
        }, 12000); // 12 second timeout
        
        // Store the timeout ID on the controller so we can clear it later
        controller.timeoutId = timeoutId;
      });
      
      // Use the simplified reverseGeocode function (heading parameter is ignored now)
      console.log("[GEOCODING] Calling reverseGeocode function...");
      
      try {
        // Race between the geocoding request and the timeout
        geocodingAttempted = true;
        const result = await Promise.race([
          reverseGeocode(latitude, longitude, signal),
          timeoutPromise
        ]);
        
        // Clear the timeout since we got a result
        if (controller.timeoutId) {
          clearTimeout(controller.timeoutId);
        }
        
        console.log("[GEOCODING] Received result from reverseGeocode:", result ? "SUCCESS" : "NULL RESULT");
        
        if (result) {
          console.log("[GEOCODING] FULL RESULT:", JSON.stringify(result, null, 2));
          console.log("[GEOCODING] Address details:", result.address ? Object.keys(result.address).join(", ") : "No address data");
        } else {
          console.warn("[GEOCODING] reverseGeocode returned null or undefined");
          throw new Error("Empty result from geocoding");
        }
            
        // If we have a result, process it
        if (result && result.address) {
          // Extract street name and locality
          const streetName = this.extractStreetName(result.address);
          const locality = this.extractLocality(result.address);
          const locationName = this.extractLocationName(result.address);
          
          console.log("[GEOCODING] Extracted street name:", streetName);
          console.log("[GEOCODING] Extracted locality:", locality);
          console.log("[GEOCODING] Extracted location name:", locationName);
          
          // Create a formatted result with the relevant data
          const geocodedLocation = {
            // Legacy address format for compatibility
            address: result.display_name || result.displayName || this.formatAddress(result.address),
            displayName: result.display_name,
            
            // New address components for better display
            street: streetName,
            locality: locality,
            name: locationName,
            
            // Original address components for reference
            addressComponents: result.address,
            
            // Add raw data for debugging
            lat: latitude,
            lon: longitude,
            
            // Note if this is from a fallback source
            isFallback: false
          };
          
          // Cache the result
          this.cachedResults.set(cacheKey, geocodedLocation);
          
          // Set geocoding status
          this.isGeocoding = false;
          
          console.log("[GEOCODING] Geocoding successful:", streetName);
          return geocodedLocation;
        } else {
          throw new Error("Missing address data in geocoding result");
        }
      } catch (error) {
        // Clear timeout if it exists
        if (controller.timeoutId) {
          clearTimeout(controller.timeoutId);
        }
        
        console.error('[GEOCODING] Error in reverseGeocode call:', error);
        geocodingError = error;
        throw error;
      }
    } catch (error) {
      // Handle specific error types differently
      console.error('[GEOCODING] Error in reverse geocoding:', error);
      console.error('[GEOCODING] Error name:', error.name);
      console.error('[GEOCODING] Error message:', error.message);
      
      // Store the error for reference
      geocodingError = error;
      
      if (error.name === 'AbortError') {
        console.warn('[GEOCODING] Request was aborted (timeout or user navigation)');
      } else if (error.name === 'TypeError') {
        console.error('[GEOCODING] TypeError - likely network issue or malformed URL');
      } else if (error.message && error.message.includes('CORS')) {
        console.error('[GEOCODING] CORS error detected - check server configuration');
      }
      
      // Create a fallback only for actual errors, not when we have valid data
      const fallbackLocation = {
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        displayName: `Location at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        street: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        locality: '',
        name: null,
        addressComponents: null,
        lat: latitude,
        lon: longitude,
        isFallback: true,
        error: geocodingError ? geocodingError.message : 'Unknown error'
      };
      
      // Cache the fallback result - but with a shorter TTL
      this.cachedResults.set(cacheKey, fallbackLocation);
      
      // Set geocoding status
      this.isGeocoding = false;
      
      console.log("[GEOCODING] Using coordinates as fallback for location due to error");
      return fallbackLocation;
    } finally {
      // Reset geocoding status if needed
      this.isGeocoding = false;
    }
  }

  /**
   * Format address from OSM address components
   * @param {Object} addressComponents - OSM address components
   * @returns {string} Formatted address
   */
  formatAddress(addressComponents) {
    if (!addressComponents) return 'Unknown location';
    
    const components = [];
    
    // Add road/street name with house number if available
    if (addressComponents.road) {
      const houseNumber = addressComponents.house_number ? `${addressComponents.house_number} ` : '';
      components.push(`${houseNumber}${addressComponents.road}`);
    } else if (addressComponents.pedestrian) {
      components.push(addressComponents.pedestrian);
    } else if (addressComponents.footway) {
      components.push(addressComponents.footway);
    } else if (addressComponents.path) {
      components.push(addressComponents.path);
    }
    
    // Add suburb/neighborhood if available
    if (addressComponents.suburb) {
      components.push(addressComponents.suburb);
    } else if (addressComponents.neighbourhood) {
      components.push(addressComponents.neighbourhood);
    }
    
    // Add city/town/village
    if (addressComponents.city) {
      components.push(addressComponents.city);
    } else if (addressComponents.town) {
      components.push(addressComponents.town);
    } else if (addressComponents.village) {
      components.push(addressComponents.village);
    }
    
    // Add state/province and postal code
    if (addressComponents.state) {
      const postalCode = addressComponents.postcode ? ` ${addressComponents.postcode}` : '';
      components.push(`${addressComponents.state}${postalCode}`);
    }
    
    return components.join(', ');
  }

  /**
   * Get the current geocoding status
   * @returns {boolean} Whether geocoding is in progress
   */
  getGeocodingStatus() {
    return this.isGeocoding;
  }
}

// Create and export a singleton instance
const geocodingService = new GeocodingService();
export default geocodingService; 