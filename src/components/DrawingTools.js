import React, { useEffect } from 'react';
import { FeatureGroup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
//import './DrawingTools.css';

// Import toolbar icons
import circleIcon from '../images/icons/circle.png';
import squareIcon from '../images/icons/square.png';
import polygonIcon from '../images/icons/polygon.png';
import markerIconImg from '../images/icons/marker.png';
import lineIcon from '../images/icons/line.png';
import fillIcon from '../images/icons/fill.png';

const DrawingTools = ({ onCreated, onDeleted }) => {
    const map = useMap();

    useEffect(() => {
        const drawnItems = new L.FeatureGroup();
        map.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems,
            },
            draw: {
                polyline: {
                    shapeOptions: {
                        color: '#f357a1',
                        weight: 10
                    }
                },
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#e1e100',
                        message: '<strong>Oh snap!<strong> you can\'t draw that!'
                    },
                    shapeOptions: {
                        color: '#bada55'
                    }
                },
                circle: true, // Assuming you are using circles to represent incident radii
                rectangle: {
                    shapeOptions: {
                        clickable: false
                    }
                },
                marker: true,
            }
        });

        map.addControl(drawControl);

        const handleCreated = (event) => {
            const { layer } = event;
            drawnItems.addLayer(layer);

            if (layer instanceof L.Marker) {
                // Find the incident circle (assuming there's only one, for simplicity)
                const incidentCircle = drawnItems.getLayers().find(l => l instanceof L.Circle);

                if (incidentCircle) {
                    const markerLatLng = layer.getLatLng();
                    const circleLatLng = incidentCircle.getLatLng();
                    const radius = incidentCircle.getRadius();

                    // Calculate the position for the tooltip outside the incident radius
                    const distance = radius + 50; // Tooltip 50 meters outside the radius
                    const angle = Math.atan2(markerLatLng.lat - circleLatLng.lat, markerLatLng.lng - circleLatLng.lng);

                    const tooltipLatLng = L.latlng(
                        circleLatLng.lat + (distance / 111320) * Math.sin(angle),
                        circleLatLng.lng + (distance / (111320 * Math.cos(circleLatLng.lat * Math.PI / 180))) * Math.cos(angle)
                    );

                    // Create the tooltip marker at the calculated position
                    const tooltipMarker = L.marker(tooltipLatLng, {
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div class="custom-tooltip">Custom Tooltip</div>`,
                            iconSize: [100, 30],
                            iconAnchor: [50, 15] // Center the tooltip icon
                        })
                    }).addTo(map);

                    // Draw a line connecting the original marker to the tooltip marker
                    const line = L.polyline([markerLatLng, tooltipLatLng], {
                        color: 'blue',
                        weight: 1
                    }).addTo(map);

                    // Store references in the original marker for later use
                    layer.tooltipMarker = tooltipMarker;
                    layer.tooltipLine = line;
                }
            }

            if (onCreated) {
                onCreated(event);
            }
        };

        const handleDeleted = (event) => {
            event.layers.eachLayer((layer) => {
                if (layer.tooltipMarker) {
                    map.removeLayer(layer.tooltipMarker);
                }
                if (layer.tooltipLine) {
                    map.removeLayer(layer.tooltipLine);
                }
            });

            if (onDeleted) {
                onDeleted(event);
            }
        };

        map.on(L.Draw.Event.CREATED, handleCreated);
        map.on(L.Draw.Event.DELETED, handleDeleted);

        return () => {
            map.off(L.Draw.Event.CREATED, handleCreated);
            map.off(L.Draw.Event.DELETED, handleDeleted);
            drawnItems.eachLayer(layer => {
                drawnItems.removeLayer(layer);
            });
            map.removeLayer(drawnItems);
            map.removeControl(drawControl);
        };
    }, [map, onCreated, onDeleted]);

    const startDrawing = (type) => {
        let drawer;
        switch (type) {
            case 'marker':
                drawer = new L.Draw.Marker(map);
                break;
            case 'circle':
                drawer = new L.Draw.Circle(map);
                break;
            case 'polygon':
                drawer = new L.Draw.Polygon(map);
                break;
            case 'rectangle':
                drawer = new L.Draw.Rectangle(map);
                break;
            case 'circlemarker':
                drawer = new L.Draw.CircleMarker(map);
                break;
            case 'polyline':
                drawer = new L.Draw.Polyline(map);
                break;
            default:
                console.error('Unsupported drawing type:', type);
                return;
        }
        if (drawer) {
            drawer.enable();
        }
    };

    return (
        <div className="custom-draw-toolbar">
            <button className="custom-draw-button" onClick={() => startDrawing('marker')} title="Marker">
                <img src={markerIconImg} alt="Marker" />
            </button>
            <button className="custom-draw-button" onClick={() => startDrawing('circlemarker')} title="Circle Marker">
                <img src={circleIcon} alt="Circle Marker" />
            </button>
            <button className="custom-draw-button" onClick={() => startDrawing('polygon')} title="Polygon">
                <img src={polygonIcon} alt="Polygon" />
            </button>
            <button className="custom-draw-button" onClick={() => startDrawing('rectangle')} title="Rectangle">
                <img src={squareIcon} alt="Rectangle" />
            </button>
            <button className="custom-draw-button" onClick={() => startDrawing('circle')} title="Circle">
                <img src={fillIcon} alt="Circle" />
            </button>
            <button className="custom-draw-button" onClick={() => startDrawing('polyline')} title="Polyline">
                <img src={lineIcon} alt="Polyline" />
            </button>
        </div>
    );
};

export default DrawingTools;
