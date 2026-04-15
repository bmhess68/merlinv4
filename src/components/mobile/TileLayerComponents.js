import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { debounce } from 'lodash';
import { MAP_URLS } from './utils/mapUtils';

// Component to manage tile styles
export function TileLoadingHandler({ darkMode, getCurrentTileUrl }) {
    const map = useMap();
    
    useEffect(() => {
        // Check if the style element already exists
        let styleElement = document.getElementById('map-tile-styles');
        
        if (!styleElement) {
            // Create it if it doesn't exist
            styleElement = document.createElement('style');
            styleElement.id = 'map-tile-styles';
            document.head.appendChild(styleElement);
        }
        
        // Update the content
        styleElement.textContent = `
            .leaflet-tile {
                transition: opacity 0.25s ease-in-out;
            }
            .leaflet-container {
                background-color: ${darkMode ? '#121212' : '#f8f8f8'} !important;
            }
        `;
        
        return () => {
            // Only remove if this is the last instance
            if (document.getElementById('map-tile-styles')) {
                document.head.removeChild(styleElement);
            }
        };
    }, [darkMode]);
    
    return null;
}

// Dynamic tile layer switcher based on zoom
export function TileLayerSwitcher() {
    const map = useMap();
    const [currentZoom, setCurrentZoom] = useState(map.getZoom());
    const googleApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    
    // Create a debounced function
    const debouncedSetZoom = useRef(
        debounce((newZoom) => {
            setCurrentZoom(newZoom);
        }, 100)
    ).current;

    // Use the debounced function
    useMapEvents({
        zoomend: () => {
            const zoom = map.getZoom();
            console.log('Current zoom level:', zoom);
            debouncedSetZoom(zoom);
        }
    });

    // Clean up the debounced function
    useEffect(() => {
        return () => {
            debouncedSetZoom.cancel();
        };
    }, [debouncedSetZoom]);
    
    // Determine which tile layer to use based on zoom level
    const tileUrl = useMemo(() => {
        // Use Google Hybrid for zoom levels 19-21
        if (currentZoom >= 19) {
            return `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${googleApiKey}`;
        }
        // Use OpenStreetMap for zoom levels below 19
        return MAP_URLS.openStreetMap;
    }, [currentZoom, googleApiKey]);
    
    return (
        <TileLayer 
            key={`tile-layer-${currentZoom >= 19 ? 'google-hybrid' : 'osm'}`}
            url={tileUrl} 
            attribution={currentZoom >= 19 ? '© Google' : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
        />
    );
} 