import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { API_URL } from '../config';

const isValidLatLng = (coords) => {
    if (!coords || !Array.isArray(coords)) return false;
    const [lat, lng] = coords;
    return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const IncidentLayerManager = ({ selectedIncident, activeIncidents, drawnItems, isEditing }) => {
    const map = useMap();
    const incidentLayersRef = useRef({});
    const drawnLayersRef = useRef({});

    // Handle incident circles
    useEffect(() => {
        // Remove circles for incidents that are no longer active
        const currentActiveIds = activeIncidents
            .filter(incident => incident.active) // Only include active incidents
            .map(incident => incident.incident_id.toString());

        Object.keys(incidentLayersRef.current).forEach((id) => {
            if (!currentActiveIds.includes(id)) {
                incidentLayersRef.current[id].remove();
                delete incidentLayersRef.current[id];
            }
        });

        // Update existing circles or create new ones for active incidents only
        activeIncidents.forEach((incident) => {
            if (!incident.active) return; // Skip inactive incidents

            const { incident_id, location_lat, location_long, radius, name } = incident;
            if (!location_lat || !location_long) return;

            const latlng = [location_lat, location_long];
            const incidentRadius = radius * 1609.34; // Convert miles to meters

            if (incidentLayersRef.current[incident_id]) {
                // Update existing circle
                incidentLayersRef.current[incident_id]
                    .setLatLng(latlng)
                    .setRadius(incidentRadius)
                    .setStyle({
                        fillOpacity: 0.05,
                        opacity: 0.2
                    });
            } else {
                // Create new circle
                const circle = L.circle(latlng, {
                    radius: incidentRadius,
                    color: 'blue',
                    weight: 1,
                    fillColor: 'lightblue',
                    fillOpacity: 0.05,
                    opacity: 0.2
                }).addTo(map);

                incidentLayersRef.current[incident_id] = circle;
            }
        });
    }, [activeIncidents, map]);

    // Handle drawn items
    useEffect(() => {
        if (selectedIncident) {
            const fetchAndRenderDrawnItems = async () => {
                // Don't fetch if we're currently editing
                if (isEditing) {
                    console.log('Skipping refresh while editing');
                    return;
                }

                try {
                    const response = await fetch(
                        `${API_URL}/api/drawn-items?incident_id=${selectedIncident.incident_id}`,
                        { credentials: 'include' }
                    );
                    
                    if (!response.ok) throw new Error('Failed to fetch drawn items');
                    
                    const items = await response.json();
                    console.log('Fetched drawn items:', items);

                    // Clear existing drawn layers
                    Object.values(drawnLayersRef.current).forEach(layer => layer.remove());
                    drawnLayersRef.current = {};

                    items.forEach(item => {
                        if (item.active && item.geojson) {
                            try {
                                const layer = L.geoJSON(item.geojson, {
                                    style: (feature) => ({
                                        color: feature.properties.color || '#3388ff',
                                        weight: 2,       // Consistent with other shapes
                                        opacity: 0.6,    // More transparent borders
                                        fillOpacity: 0.1 // Very transparent fill
                                    }),
                                    pointToLayer: (feature, latlng) => {
                                        if (feature.properties.markerType === 'Circle' && feature.properties.radius) {
                                            return L.circle(latlng, {
                                                radius: feature.properties.radius * 1609.34,
                                                color: feature.properties.color || '#3388ff',
                                                weight: 2,       // Consistent with other shapes
                                                opacity: 0.6,    // More transparent borders
                                                fillOpacity: 0.1 // Very transparent fill
                                            });
                                        }
                                        return L.marker(latlng);
                                    }
                                }).addTo(map);

                                // Add labels if name exists
                                if (item.geojson.properties.name && item.geojson.geometry.coordinates) {
                                    try {
                                        const itemName = item.geojson.properties.name;
                                        // Check if this drawn item has the same name as any incident
                                        const hasMatchingIncident = activeIncidents.some(incident => 
                                            incident.name === itemName
                                        );
                                        
                                        // Only add label if it doesn't match an incident name
                                        if (!hasMatchingIncident) {
                                            const coords = item.geojson.geometry.coordinates;
                                            // Ensure coordinates are in [lat, lng] format
                                            const latlng = Array.isArray(coords[0]) ? 
                                                [coords[0][1], coords[0][0]] : // For polygons/lines
                                                [coords[1], coords[0]];  // For points

                                            if (isValidLatLng(latlng)) {
                                                const label = L.marker(latlng, {
                                                    icon: L.divIcon({
                                                        className: 'drawn-item-label',
                                                        html: itemName
                                                    }),
                                                    zIndexOffset: 1000 // Make labels appear on top
                                                }).addTo(map);
                                                drawnLayersRef.current[`label-${item.id}`] = label;
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Error creating label:', error);
                                    }
                                }

                                drawnLayersRef.current[item.id] = layer;
                            } catch (error) {
                                console.error('Error rendering drawn item:', item.id, error);
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error fetching drawn items:', error);
                }
            };

            // Initial fetch only
            fetchAndRenderDrawnItems();
            
            return () => {
                Object.values(drawnLayersRef.current).forEach(layer => layer.remove());
                drawnLayersRef.current = {};
            };
        }
    }, [selectedIncident, map, isEditing]);

    return null;
};

export default IncidentLayerManager; 