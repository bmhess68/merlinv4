const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// API URLs configuration
const OVERPASS_API = {
    LOCAL: process.env.OVERPASS_API_URL || 'http://localhost:8001/api/interpreter',
    REMOTE: 'https://overpass-api.de/api/interpreter'
};

// Add rate limiting and caching at the top of the file
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
  
  async waitForOverpassSlot() {
    const now = Date.now();
    const waitTime = Math.max(0, this.overpassDelay - (now - this.overpassLastCall));
    
    if (waitTime > 0) {
      console.log(`Rate limiting: waiting ${waitTime}ms before Overpass API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.registerOverpassCall();
  },
  
  async waitForNominatimSlot() {
    const now = Date.now();
    const waitTime = Math.max(0, this.minDelayBetweenCalls - (now - this.nominatimLastCall));
    
    if (waitTime > 0) {
      console.log(`Rate limiting: waiting ${waitTime}ms before Nominatim API call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.registerNominatimCall();
  }
};

// Add a cache for geocoding results
const geocodeCache = {
  cache: new Map(),
  cacheTTL: 60 * 60 * 1000, // 1 hour cache TTL
  
  getLocationCacheKey(lat, lon, heading) {
    // Round to 5 decimal places (~1 meter precision) to ensure nearby positions 
    // use the same cache entry and avoid micro-movements causing new requests
    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLon = Math.round(lon * 100000) / 100000;
    const roundedHeading = Math.round(heading / 5) * 5; // Round to nearest 5 degrees
    return `${roundedLat},${roundedLon},${roundedHeading}`;
  },
  
  get(lat, lon, heading) {
    const key = this.getLocationCacheKey(lat, lon, heading);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`Using cached geocode result for ${key}`);
    return entry.data;
  },
  
  set(lat, lon, heading, data) {
    const key = this.getLocationCacheKey(lat, lon, heading);
    this.cache.set(key, {
      timestamp: Date.now(),
      data
    });
    
    // Limit cache size to prevent memory leaks (keep up to 100 locations)
    if (this.cache.size > 100) {
      // Delete oldest entry
      let oldestKey = null;
      let oldestTime = Infinity;
      
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }
};

// Helper to determine which service URL to use
const getOverpassUrl = () => {
    return process.env.USE_LOCAL_OVERPASS === 'true' ? OVERPASS_API.LOCAL : OVERPASS_API.REMOTE;
};

// Utility function to format distances in US units (feet/miles)
const formatImperialDistance = (meters) => {
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

// Check if a service is available
const isServiceAvailable = async (url) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, { 
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.warn(`Service at ${url} is not available:`, error.message);
        return false;
    }
};

// Smart URL selection that falls back to remote if local is not available
const getSmartOverpassUrl = async () => {
    if (process.env.USE_LOCAL_OVERPASS !== 'true') return OVERPASS_API.REMOTE;
    
    const isLocalAvailable = await isServiceAvailable(OVERPASS_API.LOCAL);
    return isLocalAvailable ? OVERPASS_API.LOCAL : OVERPASS_API.REMOTE;
};

/**
 * Enhanced reverse geocoding that includes nearby intersections and highway exits
 * Uses Nominatim for basic address data and Overpass API for highway/intersection data
 */
router.get('/enhanced', async (req, res) => {
    try {
        const { lat, lon, radius = 500, heading = 0 } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
        }
        
        // Use Promise.all to run both requests concurrently
        const [nominatimData, overpassData] = await Promise.all([
            getNominatimData(lat, lon),
            getOverpassData(lat, lon, radius, parseFloat(heading))
        ]);
        
        // Combine the results
        const result = {
            ...nominatimData,
            nearby: overpassData,
            heading: parseFloat(heading) // Include the heading in the response
        };
        
        res.json(result);
    } catch (error) {
        console.error('Enhanced reverse geocoding error:', error);
        res.status(500).json({ 
            error: 'Error performing reverse geocoding',
            message: error.message
        });
    }
});

/**
 * Get basic address data from Nominatim
 */
async function getNominatimData(lat, lon) {
    try {
        const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse`, {
                params: {
                    lat,
                    lon,
                    format: 'json',
                    addressdetails: 1
                },
                headers: {
                    'Accept-Language': 'en',
                    'User-Agent': 'MerlinMobileApp/1.0'
                }
            }
        );
        
        return {
            display_name: response.data.display_name,
            addressDetails: response.data.address
        };
    } catch (error) {
        console.error('Nominatim error:', error);
        return {
            display_name: 'Unknown location',
            addressDetails: {}
        };
    }
}

/**
 * Get nearby intersections and highway exits using Overpass API
 */
async function getOverpassData(lat, lon, radius, heading = 0) {
    try {
        // Check cache first
        const cachedResult = geocodeCache.get(lat, lon, heading);
        if (cachedResult) {
            return cachedResult;
        }
        
        // Wait for rate limiter slot
        await apiRateLimiter.waitForOverpassSlot();
        
        // Convert radius from meters to degrees (approximate)
        const radiusDeg = radius / 111000;  // rough conversion
        
        // Create a bounding box around the point
        const bbox = {
            minLat: lat - radiusDeg,
            minLon: lon - radiusDeg,
            maxLat: lat + radiusDeg,
            maxLon: lon + radiusDeg
        };
        
        // Fixed Overpass query with explicit JSON output format and proper semicolons
        const query = `
            [out:json];
            (
                // Highway exits and junctions with detailed data
                node["highway"="motorway_junction"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                
                // Specifically capture exits with ref numbers (exit numbers)
                node["highway"="motorway_junction"]["ref"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                
                // Also get exit destinations (to where the exit leads)
                node["highway"="motorway_junction"]["exit_to"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                
                // All road intersections (more comprehensive than just traffic signals)
                way["highway"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                node(w) -> .highway_nodes;
                
                // Find actual intersections (where multiple ways meet)
                node.highway_nodes -> .potential_intersections;
                way["highway"]["name"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}) -> .named_roads;
                node.potential_intersections < .named_roads -> .real_nodes;
                
                // Include stop signs and traffic signals as they often mark intersections
                node["highway"="stop"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                node["highway"="traffic_signals"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                
                // Capture on/off ramps which often indicate upcoming exits
                way["highway"="motorway_link"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
                
                // Get named nodes and points of interest
                node["name"](${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon});
            );
            out body;
            
            // Get additional way data for the exits and intersections
            way(bn);
            out tags;
        `;
        
        // Get appropriate Overpass URL
        const overpassUrl = getSmartOverpassUrl();
        console.log(`Using Overpass API endpoint: ${overpassUrl}`);
        
        const response = await axios.post(overpassUrl, 
            `data=${encodeURIComponent(query)}`, 
            { 
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            }
        );
        
        if (response.status !== 200) {
            throw new Error(`Overpass API returned status: ${response.status}`);
        }
        
        // Store in cache
        geocodeCache.set(lat, lon, heading, response.data);
        
        return response.data;
    } catch (error) {
        // Handle rate limiting errors specifically
        if (error.response && error.response.status === 429) {
            console.log("Rate limited by Overpass API - increasing delay time");
            apiRateLimiter.overpassDelay = Math.min(apiRateLimiter.overpassDelay * 2, 30000); // Up to 30 seconds
        }
        
        console.error('Overpass API error:', error);
        throw error;
    }
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

module.exports = router; 