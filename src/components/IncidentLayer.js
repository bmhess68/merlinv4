import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const IncidentLayer = ({ incidents }) => {
  const map = useMap();
  const incidentLayersRef = useRef({});

  useEffect(() => {
    // Remove circles for incidents that no longer exist
    const currentIds = incidents.map(incident => incident.incident_id.toString());
    Object.keys(incidentLayersRef.current).forEach((id) => {
      if (!currentIds.includes(id)) {
        incidentLayersRef.current[id].remove();
        delete incidentLayersRef.current[id];
      }
    });

    // Update existing circles or create new ones
    incidents.forEach((incident) => {
      const { incident_id, location_lat, location_long, radius } = incident;
      const latlng = [location_lat, location_long];
      const incidentRadius = radius * 1609.34; // Convert miles to meters

      if (incidentLayersRef.current[incident_id]) {
        // Update existing circle
        incidentLayersRef.current[incident_id].setLatLng(latlng).setRadius(incidentRadius);
      } else {
        // Create new circle
        const circle = L.circle(latlng, {
          radius: incidentRadius,
          color: 'blue',
          fillColor: 'lightblue',
          fillOpacity: 0.5,
        }).addTo(map);

        incidentLayersRef.current[incident_id] = circle;
      }
    });

    // Cleanup function
    return () => {
      Object.values(incidentLayersRef.current).forEach((circle) => {
        circle.remove();
      });
      incidentLayersRef.current = {}; // Clear the ref object after removing layers
    };
  }, [incidents, map]); // Depend on incidents and map

  return null;
};

export default IncidentLayer;
