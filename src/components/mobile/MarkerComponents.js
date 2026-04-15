import React, { useEffect } from 'react';
import { Marker, Popup, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';

// Create a red pin marker using emoji (simpler approach)
export const redPinMarkerIcon = divIcon({
    html: `<div style="font-size: 36px; text-align: center; line-height: 1;">📍</div>`,
    className: 'emoji-pin-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],  // Bottom center of the icon
    popupAnchor: [0, -36]  // Top center of the icon
});

// Create a component to handle marker styles
export function MarkerStyles() {
    useEffect(() => {
        // Check if the style element already exists
        let styleElement = document.getElementById('marker-styles');
        
        if (!styleElement) {
            // Create it if it doesn't exist
            styleElement = document.createElement('style');
            styleElement.id = 'marker-styles';
            document.head.appendChild(styleElement);
        }
        
        // Update the content
        styleElement.textContent = `
            .emoji-pin-marker {
                filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3));
            }
            
            .emoji-pin-marker div {
                transform: translateY(-4px);
            }
            
            /* Make sure the tooltip is visible */
            .leaflet-tooltip {
                background-color: rgba(25, 25, 25, 0.8);
                color: white;
                border: none;
                border-radius: 10px;
                padding: 5px 10px;
                font-weight: bold;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            
            .leaflet-tooltip-top:before {
                border-top-color: rgba(25, 25, 25, 0.8);
            }
        `;
        
        return () => {
            // Only remove if this is the last instance
            if (document.getElementById('marker-styles')) {
                document.head.removeChild(styleElement);
            }
        };
    }, []);
    
    return null;
}

// Component to get user's current location and initialize the map
export function LocationFinder() {
    const map = useMap();
    
    useEffect(() => {
        // Get current location
        map.locate({ setView: true, maxZoom: 16 });
        
        // Add event handler for when location is found
        function onLocationFound(e) {
            console.log("Location found:", e.latlng);
            map.setView(e.latlng, 17);
            
            // Force map invalidation after a slight delay
            setTimeout(() => {
                console.log("Invalidating map size");
                map.invalidateSize(true);
            }, 200);
        }
        
        map.on('locationfound', onLocationFound);
        
        return () => {
            map.off('locationfound', onLocationFound);
        };
    }, [map]);
    
    return null;
}

// Create a component to handle map clicks for marking
export function MapMarker({ isMarkingMode, setIsMarkingMode, setShowNameModal, setTempMarkerPosition }) {
    const map = useMapEvents({
        click: (e) => {
            if (isMarkingMode) {
                console.log('Map clicked at:', e.latlng);
                setTempMarkerPosition([e.latlng.lat, e.latlng.lng]);
                setShowNameModal(true);
                setIsMarkingMode(false); // Exit marking mode after placing marker
            }
        }
    });
    
    return null;
}

// Create a component to display all markers
export function MarkersLayer({ markers, onMarkerDelete, user }) {
    return (
        <>
            {markers.map((marker) => (
                <Marker
                    key={marker.id}
                    position={[marker.latitude, marker.longitude]}
                    icon={redPinMarkerIcon}  // Using the new pin marker icon
                    eventHandlers={{
                        dblclick: () => {
                            // Only allow deletion if the user created the marker or is an admin
                            if (marker.createdBy === user.userName || (user.permissions && user.permissions.admin)) {
                                onMarkerDelete(marker.id);
                            }
                        }
                    }}
                >
                    <Popup>
                        <div>
                            <strong>{marker.name}</strong>
                            <p>Created by: {marker.createdBy}</p>
                            <p>
                                {marker.createdBy === user.userName || (user.permissions && user.permissions.admin) ? 
                                    "Double-click marker to delete" : ""}
                            </p>
                        </div>
                    </Popup>
                    {/* Add permanent tooltip */}
                    <Tooltip permanent direction="top" offset={[0, -30]}>
                        <span style={{ fontWeight: 'bold' }}>{marker.name}</span>
                    </Tooltip>
                </Marker>
            ))}
        </>
    );
} 