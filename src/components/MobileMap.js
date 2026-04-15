/*
 * This file provides a compatibility layer for existing code that imports from the
 * original MobileMap location. All functionality is now in MapboxMobileMap.
 */

import MapboxMobileMap from './mapbox/MapboxMobileMap';

// Re-export the new implementation with the original name
export default MapboxMobileMap; 