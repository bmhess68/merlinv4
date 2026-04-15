// This file re-exports the MapBox version of MobileMap component
// This can be imported in App.js to replace the Leaflet version

import MapboxMobileMap from './mapbox/MapboxMobileMap';
import './mapbox/mapbox-styles.css';

// Export the MapBox version as the default export
export default MapboxMobileMap;

// Also re-export any named exports if needed
export * from './mapbox/MapboxMobileMap'; 