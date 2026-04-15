import React, { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

// Component to handle map constraints (zoom/pan limits)
function MapConstraints({ followedVehicle, disablePan }) {
    const map = useMap();
    
    // Log the initial state when component mounts
    useEffect(() => {
        console.log('MapConstraints: Initialized with:');
        console.log('- Current zoom level:', map.getZoom());
        console.log('- Min zoom:', map.getMinZoom());
        console.log('- Max zoom:', map.getMaxZoom());
        console.log('- disablePan:', disablePan);
        console.log('- followedVehicle:', followedVehicle ? 'Yes' : 'No');
    }, [map, disablePan, followedVehicle]);
    
    // Disable panning based on prop
    useEffect(() => {
        if (disablePan || followedVehicle) {
            // Disable map interactions when following or when disablePan is true
            // BUT keep zoom-related interactions enabled
            console.log('MapConstraints: Disabling panning, but keeping zoom enabled');
            map.dragging.disable();
            map.keyboard.disable();
            
            // Explicitly ensure zoom interactions remain enabled
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
            map.scrollWheelZoom.enable();
            map.boxZoom.enable();
            
            // Verify zoom handlers are enabled
            console.log('MapConstraints: Zoom handlers status:');
            console.log('- touchZoom enabled:', map.touchZoom.enabled());
            console.log('- doubleClickZoom enabled:', map.doubleClickZoom.enabled());
            console.log('- scrollWheelZoom enabled:', map.scrollWheelZoom.enabled());
            console.log('- boxZoom enabled:', map.boxZoom.enabled());
            
            return () => {
                // Re-enable map interactions when not following and disablePan is false
                console.log('MapConstraints: Re-enabling all map interactions');
                map.dragging.enable();
                map.touchZoom.enable();
                map.doubleClickZoom.enable();
                map.scrollWheelZoom.enable();
                map.boxZoom.enable();
                map.keyboard.enable();
            };
        }
    }, [followedVehicle, map, disablePan]);
    
    useMapEvents({
        zoom: () => {
            // Enforce zoom constraints (15-18 as requested)
            const currentZoom = map.getZoom();
            console.log('MapConstraints: Zoom event detected, current zoom level:', currentZoom);
            
            if (currentZoom < 15) {
                console.log('MapConstraints: Zoom too low, enforcing minimum zoom of 15');
                map.setZoom(15);
            } else if (currentZoom > 18) {
                console.log('MapConstraints: Zoom too high, enforcing maximum zoom of 18');
                map.setZoom(18);
            }
        },
        zoomstart: () => {
            console.log('MapConstraints: Zoom operation starting. Current level:', map.getZoom());
        },
        zoomend: () => {
            console.log('MapConstraints: Zoom operation ended. New level:', map.getZoom());
        },
        dragstart: (e) => {
            // Prevent panning when following a vehicle or when disablePan is true
            if ((followedVehicle || disablePan) && e && e.originalEvent) {
                console.log('MapConstraints: Preventing map drag due to disablePan or followed vehicle');
                e.originalEvent.preventDefault();
            } else if (followedVehicle || disablePan) {
                // Alternative approach if originalEvent is not available
                console.log('MapConstraints: Disabling drag due to disablePan or followed vehicle');
                map.dragging.disable();
                
                // Re-enable dragging after a short delay to prevent getting stuck
                setTimeout(() => {
                    if (map && followedVehicle) {
                        console.log('MapConstraints: Re-centering map on followed vehicle');
                        map.panTo([followedVehicle.latitude, followedVehicle.longitude]);
                    }
                }, 100);
            }
        }
    });
    
    return null;
}

export default MapConstraints; 