/**
 * API Configuration for mapping services
 * Centralizes URLs for OSRM and Overpass API
 */

// Check if we should use local services based on environment variables
const useLocalOSRM = process.env.REACT_APP_USE_LOCAL_OSRM === 'true';
const useLocalOverpass = process.env.REACT_APP_USE_LOCAL_OVERPASS === 'true';

// Define API URLs
const OSRM_API = {
  LOCAL: process.env.REACT_APP_OSRM_API_URL || 'http://localhost:6000',
  REMOTE: 'http://192.168.2.109:5000'
};

const OVERPASS_API = {
  LOCAL: process.env.REACT_APP_OVERPASS_API_URL || 'http://localhost:8001/api/interpreter',
  REMOTE: 'https://overpass-api.de/api/interpreter',
  FALLBACK1: 'https://overpass.kumi.systems/api/interpreter',
  FALLBACK2: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
};

// Define a list of fallback APIs in order of preference
const OVERPASS_FALLBACKS = [
  OVERPASS_API.REMOTE,
  OVERPASS_API.FALLBACK1,
  OVERPASS_API.FALLBACK2
];

/**
 * Get the appropriate URL for a service based on configuration
 * @param {Object} serviceConfig - The service configuration object
 * @param {boolean} useLocal - Whether to use the local service
 * @returns {string} The service URL
 */
const getServiceUrl = (serviceConfig, useLocal) => {
  return useLocal ? serviceConfig.LOCAL : serviceConfig.REMOTE;
};

/**
 * Get the OSRM API URL based on configuration
 * @returns {string} The OSRM API URL
 */
const getOSRMUrl = () => getServiceUrl(OSRM_API, useLocalOSRM);

/**
 * Get the Overpass API URL based on configuration
 * @returns {string} The Overpass API URL
 */
const getOverpassUrl = () => getServiceUrl(OVERPASS_API, useLocalOverpass);

/**
 * Check if a service is available
 * @param {string} url - The URL to check
 * @returns {Promise<boolean>} Whether the service is available
 */
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

/**
 * Try each URL in the list until one works or we run out of options
 * @param {Array<string>} urls - List of URLs to try
 * @returns {Promise<string|null>} The first working URL or null if none work
 */
const findWorkingService = async (urls) => {
  for (const url of urls) {
    const available = await isServiceAvailable(url);
    if (available) {
      return url;
    }
  }
  return null;
};

/**
 * Smart URL selection that falls back to remote if local is not available
 * @param {Object} serviceConfig - The service configuration object
 * @param {boolean} useLocal - Whether to prefer the local service
 * @returns {Promise<string>} The best available service URL
 */
const getSmartServiceUrl = async (serviceConfig, useLocal) => {
  if (!useLocal) return serviceConfig.REMOTE;
  
  const isLocalAvailable = await isServiceAvailable(serviceConfig.LOCAL);
  return isLocalAvailable ? serviceConfig.LOCAL : serviceConfig.REMOTE;
};

/**
 * Get the best available OSRM API URL with fallback
 * @returns {Promise<string>} The best available OSRM API URL
 */
const getSmartOSRMUrl = async () => getSmartServiceUrl(OSRM_API, useLocalOSRM);

/**
 * Get the best available Overpass API URL with fallback
 * @returns {Promise<string>} The best available Overpass API URL
 */
const getSmartOverpassUrl = async () => {
  // First try the local or remote based on settings
  const preferredUrl = getOverpassUrl();
  
  // Test if the preferred URL is available
  const isPreferredAvailable = await isServiceAvailable(preferredUrl);
  if (isPreferredAvailable) {
    return preferredUrl;
  }
  
  // If not, try the fallbacks
  console.warn(`Preferred Overpass API (${preferredUrl}) is not available. Trying fallbacks...`);
  const fallbacks = [...OVERPASS_FALLBACKS];
  
  // Remove the one we already tried
  const preferredIndex = fallbacks.indexOf(preferredUrl);
  if (preferredIndex > -1) {
    fallbacks.splice(preferredIndex, 1);
  }
  
  // Try the remaining fallbacks
  const workingUrl = await findWorkingService(fallbacks);
  
  if (workingUrl) {
    console.log(`Using fallback Overpass API: ${workingUrl}`);
    return workingUrl;
  }
  
  // If all fails, return the original one and let the caller handle the failure
  console.warn('All Overpass API alternatives failed. Using the preferred URL as a last resort.');
  return preferredUrl;
};

export {
  getOSRMUrl,
  getOverpassUrl,
  getSmartOSRMUrl,
  getSmartOverpassUrl,
  useLocalOSRM,
  useLocalOverpass
}; 