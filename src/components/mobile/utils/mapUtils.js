import { useMapEvents } from 'react-leaflet';
import React from 'react';

// Define MAP_URLS for export throughout the application
export const MAP_URLS = {
    openStreetMap: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    googleMaps: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`,
    googleSatellite: `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`,
    googleHybrid: `https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`,
    // Try these alternative dark mode maps
    cartoDBDark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    stamenToner: "https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png",
    // Keep ESRI as an option but with corrected URL format
    esriDarkGray: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
};

// Extract user from URL parameters
export const getUserFromUrl = () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user');
        
        if (userParam) {
            return JSON.parse(decodeURIComponent(userParam));
        }
        return null;
    } catch (error) {
        console.error('Error parsing user from URL:', error);
        return null;
    }
};

// Function to handle tile attribution
export const getTileAttribution = (currentMapProvider) => {
    const attributions = {
        openStreetMap: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        googleMaps: '&copy; Google',
        googleSatellite: '&copy; Google',
        googleHybrid: '&copy; Google',
        cartoDBDark: '&copy; <a href="https://carto.com/attributions">CARTO</a>',
        stamenToner: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
        esriDarkGray: '&copy; <a href="https://www.esri.com/">Esri</a>'
    };
    return attributions[currentMapProvider] || attributions.openStreetMap;
};

// Add a ZoomHandler component
export function ZoomHandler({ onZoomChange }) {
    const map = useMapEvents({
        zoomstart: () => {
            const zoom = map.getZoom();
            console.log('ZoomHandler: Zoom operation starting at level:', zoom);
        },
        zoom: () => {
            const zoom = map.getZoom();
            console.log('ZoomHandler: Zoom in progress, current level:', zoom);
        },
        zoomend: () => {
            const zoom = map.getZoom();
            console.log('ZoomHandler: Zoom operation completed. Final level:', zoom);
            onZoomChange(zoom);
        },
        zoomanim: (e) => {
            console.log('ZoomHandler: Zoom animation in progress:', e.zoom);
        }
    });
    
    // Log initial zoom when component mounts
    React.useEffect(() => {
        const currentZoom = map.getZoom();
        console.log('ZoomHandler: Component mounted. Initial zoom level:', currentZoom);
        
        // Check if zoom handlers are enabled
        console.log('ZoomHandler: Zoom interactions status:');
        console.log('- touchZoom enabled:', map.touchZoom.enabled());
        console.log('- doubleClickZoom enabled:', map.doubleClickZoom.enabled());
        console.log('- scrollWheelZoom enabled:', map.scrollWheelZoom.enabled());
        console.log('- boxZoom enabled:', map.boxZoom.enabled());
        
        // Force enable zoom handlers to ensure they're working
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
    }, [map]);
    
    return null;
} 