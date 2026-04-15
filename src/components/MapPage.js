import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapContainer, TileLayer, CircleMarker, Polygon,
    Polyline, Tooltip, useMap, useMapEvents, Marker, Popup
} from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-tooltip-layout';
import 'leaflet-draw';
import '../App.css';
import './MapPage.css';
import { useLocation } from 'react-router-dom';
import * as turf from '@turf/turf';
import { Modal } from 'react-bootstrap';
import DrawingTools from './DrawingTools';
import StyledIncidentForm from './StyledIncidentForm';
import IncidentModal from './IncidentModal';
import CloseIncidentModal from './CloseIncidentModal';
import EditMarkersModal from './EditMarkersModal';
import VehicleLayer from './VehicleLayer';
import VehicleTracker from './VehicleTracker';
import VehicleSearch from './VehicleSearch';
import LayerControlModal from './LayerControlModal';
import NameColorForm from './NameColorForm';
import logo from '../images/icons/logo.png';
import { PERMISSIONS, hasPermission } from '../utils/permissions';
import StarChaseLayer from './StarChaseLayer';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import WeatherOverlay from './WeatherOverlay';
import WeatherAlerts from './WeatherAlerts';
import CADAlerts from './CADAlerts';
import IncidentLayerManager from './IncidentLayerManager';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCar } from '@fortawesome/free-solid-svg-icons';
import io from 'socket.io-client';
import { Icon } from 'leaflet';
import SpecialResourcesModal from './mapbox/mobile/modals/SpecialResourcesModal';
import notificationService from '../services/notificationService';

// Import the marker images
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Import toolbar icons
import homeIcon from '../images/icons/home.png';
import layerIcon from '../images/icons/layer.png';
import plusIcon from '../images/icons/plus-symbol-button.png';
import editIcon from '../images/icons/edit.png';
import closeIcon from '../images/icons/close.png';
import rosterIcon from '../images/icons/people.png';
import adminIcon from '../images/icons/gear.png';

// Fix the default icon paths
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow
});

// Create a custom red marker icon
const redMarkerIcon = new Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const API_URL = process.env.REACT_APP_API_URL || 'https://merlin.westchesterrtc.com';
const googleApiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const MAP_URLS = {
    openStreetMap: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    googleMaps: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${googleApiKey}`,
    googleSatellite: `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&key=${googleApiKey}`,
    googleHybrid: `https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}&key=${googleApiKey}`
};

// Custom toast configuration for better visibility
const toastConfig = {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    style: {
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        fontSize: '16px',
        fontWeight: 'bold',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
    }
};

function ZoomToIncident({ incident }) {
    const map = useMap();

    useEffect(() => {
        if (incident) {
            map.setView([incident.location_lat, incident.location_long], 14);
        }
    }, [incident, map]);

    return null;
}

function MapClickHandler({ setIncidentLocation, setMarkerPosition }) {
    const map = useMapEvents({
        click(e) {
            setIncidentLocation(e.latlng);
            setMarkerPosition(e.latlng);
        },
    });

    useEffect(() => {
        const handleLocationFound = (e) => {
            setMarkerPosition(e.latlng);
        };

        map.on('locationfound', handleLocationFound);

        return () => {
            map.off('locationfound', handleLocationFound);
        };
    }, [map, setMarkerPosition]);

    return null;
}

function VehicleSearchHandler({ vehicles, onVehicleSelect }) {
    const map = useMap();

    const handleVehicleSelect = useCallback((vehicle) => {
        const { latitude, longitude } = vehicle;
        map.setView([latitude, longitude], 14);
        onVehicleSelect(vehicle);
    }, [map, onVehicleSelect]);

    return <VehicleSearch vehicles={vehicles} onVehicleSelect={handleVehicleSelect} />;
}

// Custom SVG icon for the special resources button
const EmergencyLightIcon = () => (
  <svg 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2C12.5523 2 13 2.44772 13 3V5C13 5.55228 12.5523 6 12 6C11.4477 6 11 5.55228 11 5V3C11 2.44772 11.4477 2 12 2Z" fill="currentColor"/>
    <path d="M6.34315 4.92893C6.73367 4.53841 7.36683 4.53841 7.75736 4.92893L9.17157 6.34315C9.56209 6.73367 9.56209 7.36683 9.17157 7.75736C8.78105 8.14788 8.14788 8.14788 7.75736 7.75736L6.34315 6.34315C5.95262 5.95262 5.95262 5.31946 6.34315 4.92893Z" fill="currentColor"/>
    <path d="M17.6569 4.92893C18.0474 5.31946 18.0474 5.95262 17.6569 6.34315L16.2426 7.75736C15.8521 8.14788 15.2189 8.14788 14.8284 7.75736C14.4379 7.36683 14.4379 6.73367 14.8284 6.34315L16.2426 4.92893C16.6332 4.53841 17.2663 4.53841 17.6569 4.92893Z" fill="currentColor"/>
    <path d="M4 12C4 8.68629 6.68629 6 10 6H14C17.3137 6 20 8.68629 20 12V17H4V12Z" fill="currentColor"/>
    <path d="M2 19C2 18.4477 2.44772 18 3 18H21C21.5523 18 22 18.4477 22 19C22 19.5523 21.5523 20 21 20H3C2.44772 20 2 19.5523 2 19Z" fill="currentColor"/>
  </svg>
);

const CustomCrossHairs = () => {
    const map = useMap();
    const [center, setCenter] = useState(map.getCenter());

    useEffect(() => {
        const updateCenter = () => {
            setCenter(map.getCenter());
        };

        map.on('move', updateCenter);
        return () => {
            map.off('move', updateCenter);
        };
    }, [map]);

    return (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid red', pointerEvents: 'none' }}></div>
            <div style={{ position: 'absolute', top: '50%', left: 0, width: '20px', height: '2px', backgroundColor: 'red', transform: 'translateY(-50%)', pointerEvents: 'none' }}></div>
            <div style={{ position: 'absolute', top: 0, left: '50%', width: '2px', height: '20px', backgroundColor: 'red', transform: 'translateX(-50%)', pointerEvents: 'none' }}></div>
        </div>
    );
};

const Toolbar = ({ homePosition, setShowLayerModal, setShowForm, setShowEditMarkersModal, setShowCloseModal, user, toggleMobileMode, setShowSpecialResourcesModal }) => {
    const map = useMap();
    const navigate = useNavigate(); 

    const handleHomeClick = () => {
        if (map.resetVehicleFollowing) {
            map.resetVehicleFollowing();
        }
        
        map.setView(homePosition, 13);
    };

    const handleRosterClick = (event) => {
        event.preventDefault();
        window.open('/roster', '_blank');
    };

    const handleSpecialResourcesClick = () => {
        setShowSpecialResourcesModal(true);
    };

    const handleAdminClick = (event) => {
        event.preventDefault();
        const userData = {
            userId: user.userId,
            userName: user.name,
            userAvatar: user.avatar,
            permissions: user.permissions,
            userEmail: user.email
        };
        const encodedUser = encodeURIComponent(JSON.stringify(userData));
        window.open(`${window.location.origin}/admin?user=${encodedUser}`, '_blank');
    };

    return (
        <div className="overlay-left">
            <button onClick={handleHomeClick} className="toolbar-button" title="Home">
                <img src={homeIcon} alt="Home" />
            </button>
            <button onClick={() => setShowLayerModal(true)} className="toolbar-button" title="Layer Control">
                <img src={layerIcon} alt="Layer Control" />
            </button>
            {setShowForm && (
                <button onClick={() => setShowForm(true)} className="toolbar-button" title="New Incident">
                    <img src={plusIcon} alt="New Incident" />
                </button>
            )}
            <button onClick={() => setShowEditMarkersModal(true)} className="toolbar-button" title="Edit Markers">
                <img src={editIcon} alt="Edit Markers" />
            </button>
            <button onClick={() => setShowCloseModal(true)} className="toolbar-button" title="Close Incident">
                <img src={closeIcon} alt="Close Incident" />
            </button>
            <button onClick={handleRosterClick} className="toolbar-button" title="Roster">
                <img src={rosterIcon} alt="Roster" />
            </button>
            {hasPermission(user, PERMISSIONS.ADMIN) && (
                <button onClick={handleAdminClick} className="toolbar-button" title="Admin">
                    <img src={adminIcon} alt="Admin" />
                </button>
            )}
            <button onClick={toggleMobileMode} className="toolbar-button" title="Mobile Mode">
                <FontAwesomeIcon 
                    icon={faCar} 
                    style={{ 
                        fontSize: '20px',  // Increase the size to fill more of the button
                        width: '24px',     // Set a specific width
                        height: '24px',    // Set a specific height
                        display: 'block',  // Ensure it takes up the full space
                        margin: '0 auto'   // Center it in the button
                    }} 
                />
            </button>
            <button onClick={handleSpecialResourcesClick} className="toolbar-button" title="Special Resources">
                <EmergencyLightIcon />
            </button>
        </div>
    );
};

function ZoomHandler({ onZoomChange }) {
    const map = useMapEvents({
        zoomend: () => {
            const zoom = map.getZoom();
            console.log('Current zoom level:', zoom);
            onZoomChange(zoom);
        },
    });
    return null;
}

function DrawnItemsLayer({ selectedIncident, drawnItems }) {
    const map = useMap(); // Get the map instance from react-leaflet
    
    useEffect(() => {
        if (selectedIncident && drawnItems) {
            // Clear existing layers
            drawnItems.clearLayers();

            const fetchAndRenderDrawnItems = async () => {
                try {
                    const response = await fetch(
                        `${API_URL}/api/drawn-items?incident_id=${selectedIncident.incident_id}`,
                        { credentials: 'include' }
                    );
                    
                    if (!response.ok) throw new Error('Failed to fetch drawn items');
                    
                    const items = await response.json();
                    console.log('Fetched drawn items:', items);

                    // Get all active incidents to check for name conflicts
                    const incidentsResponse = await fetch(`${API_URL}/api/incidents`, { 
                        credentials: 'include' 
                    });
                    
                    if (!incidentsResponse.ok) throw new Error('Failed to fetch incidents');
                    
                    const incidentsData = await incidentsResponse.json();
                    const activeIncidents = incidentsData.filter(incident => incident.active);
                    const incidentNames = activeIncidents.map(incident => incident.name);

                    items.forEach(item => {
                        if (item.active && item.geojson) {
                            const layer = L.geoJSON(item.geojson, {
                                style: (feature) => ({
                                    color: feature.properties.color || '#3388ff',
                                    weight: 3,
                                    opacity: 1,
                                    fillOpacity: 0.2
                                }),
                                pointToLayer: (feature, latlng) => {
                                    if (feature.properties.markerType === 'Circle' && feature.properties.radius) {
                                        return L.circle(latlng, {
                                            radius: feature.properties.radius * 1609.34, // Convert miles to meters
                                            color: feature.properties.color || '#3388ff'
                                        });
                                    }
                                    return L.marker(latlng);
                                }
                            }).addTo(map);

                            // Add labels if name exists AND it's not the same as an incident name
                            if (item.geojson.properties.name) {
                                const itemName = item.geojson.properties.name;
                                // Check if this drawn item has the same name as any incident
                                const hasMatchingIncident = incidentNames.includes(itemName);
                                
                                // Only show label if it doesn't match an incident name
                                if (!hasMatchingIncident) {
                                    L.marker(L.GeoJSON.coordsToLatLng(item.geojson.geometry.coordinates), {
                                        icon: L.divIcon({
                                            className: 'drawn-item-label',
                                            html: itemName
                                        })
                                    }).addTo(map);
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error fetching drawn items:', error);
                }
            };

            fetchAndRenderDrawnItems();
            
            return () => {
                if (drawnItems) {
                    drawnItems.clearLayers();
                }
            };
        }
    }, [selectedIncident, drawnItems, map]);

    return null;
}

// Create a new component for temporary markers
function TempMarkersLayer({ user }) {
    const [tempMarkers, setTempMarkers] = useState([]);
    
    // Use Socket.IO to listen for marker updates
    useEffect(() => {
        // Connect to Socket.IO server
        const socket = io();
        
        // Listen for temp marker updates
        socket.on('tempMarkerUpdate', (data) => {
            console.log('Received temp marker update:', data);
            
            if (data.action === 'add') {
                // Add new marker to state
                setTempMarkers(prev => {
                    // Avoid duplicates
                    if (!prev.some(m => m.id === data.marker.id)) {
                        return [...prev, data.marker];
                    }
                    return prev;
                });
            } else if (data.action === 'delete') {
                // Remove marker from state
                setTempMarkers(prev => prev.filter(marker => marker.id !== data.markerId));
            } else if (data.action === 'sync') {
                // Replace all markers
                setTempMarkers(data.markers);
            }
        });
        
        // Initial fetch of temp markers
        const fetchTempMarkers = async () => {
            try {
                const response = await fetch('/api/tempmarkers', {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                setTempMarkers(data);
            } catch (error) {
                console.error('Error fetching temp markers:', error);
            }
        };
        
        fetchTempMarkers();
        
        // Clean up on unmount
        return () => {
            socket.disconnect();
        };
    }, []);
    
    // Format date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };
    
    // Check if user can delete this marker
    const canDeleteMarker = (marker) => {
        return marker.createdBy === user.name || hasPermission(user, PERMISSIONS.ADMIN);
    };
    
    return (
        <>
            {tempMarkers.map((marker) => (
                <Marker
                    key={marker.id}
                    position={[marker.latitude, marker.longitude]}
                    icon={redMarkerIcon}
                    eventHandlers={{
                        dblclick: async (e) => {
                            // Prevent the click from propagating to the map
                            L.DomEvent.stopPropagation(e);
                            
                            // Only allow deletion if the user created the marker or is an admin
                            if (canDeleteMarker(marker)) {
                                try {
                                    const response = await fetch(`/api/tempmarkers/${marker.id}`, {
                                        method: 'DELETE',
                                        credentials: 'include'
                                    });
                                    
                                    if (!response.ok) {
                                        throw new Error(`HTTP error! status: ${response.status}`);
                                    }
                                    
                                    // The socket will handle updating the UI
                                    toast.success('Marker deleted successfully', toastConfig);
                                } catch (error) {
                                    console.error('Error deleting temp marker:', error);
                                    toast.error('Failed to delete marker', toastConfig);
                                }
                            } else {
                                toast.warning('You can only delete markers you created', toastConfig);
                            }
                        }
                    }}
                >
                    {/* Popup will show on single click */}
                    <Popup>
                        <div style={{ padding: '5px' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{marker.name}</h4>
                            <p style={{ margin: '5px 0' }}><strong>Created by:</strong> {marker.createdBy}</p>
                            <p style={{ margin: '5px 0' }}><strong>Created at:</strong> {formatDate(marker.createdAt)}</p>
                            <p style={{ margin: '5px 0' }}><strong>Coordinates:</strong> {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}</p>
                            {canDeleteMarker(marker) && (
                                <div style={{ marginTop: '10px', color: '#d9534f', fontSize: '12px' }}>
                                    Double-click marker to delete
                                </div>
                            )}
                        </div>
                    </Popup>
                    
                    {/* Keep the permanent tooltip */}
                    <Tooltip permanent direction="top" offset={[0, -30]}>
                        <span style={{ fontWeight: 'bold' }}>{marker.name}</span>
                    </Tooltip>
                </Marker>
            ))}
        </>
    );
}

const MapPage = ({ setSelectedIncident, toggleMobileMode }) => {
    const [user, setUser] = useState({});
    const position = [41.0340, -73.7629];
    const homePosition = position;
    const [showForm, setShowForm] = useState(false);
    const [incidentLocation, setIncidentLocation] = useState(null);
    const [markerPosition, setMarkerPosition] = useState(null);
    const [incidents, setIncidents] = useState([]);
    const [activeIncidents, setActiveIncidents] = useState([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showEditMarkersModal, setShowEditMarkersModal] = useState(false);
    const [selectedIncident, setSelectedIncidentState] = useState(null); // <-- Define selectedIncident here
    const selectedIncidentRef = useRef(null);
    const [drawnItems, setDrawnItems] = useState(new L.FeatureGroup());
    const [markers, setMarkers] = useState([]);
    const [showNameColorForm, setShowNameColorForm] = useState(false);
    const [currentLayer, setCurrentLayer] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [showLayerModal, setShowLayerModal] = useState(false);
    const [csvFiles, setCsvFiles] = useState([]);
    const [selectedLayers, setSelectedLayers] = useState([]);
    const [layerData, setLayerData] = useState({});
    const [selectedMapType, setSelectedMapType] = useState('openStreetMap');
    const [showPoliceGPS, setShowPoliceGPS] = useState(() => {
        return hasPermission(user, PERMISSIONS.POLICE_GPS) || hasPermission(user, PERMISSIONS.ADMIN);
    });
    const [showFireGPS, setShowFireGPS] = useState(() => {
        return hasPermission(user, PERMISSIONS.FIRE_GPS) || hasPermission(user, PERMISSIONS.ADMIN);
    });
    const [showStarChase, setShowStarChase] = useState(false);
    const [showTooltips, setShowTooltips] = useState(true);
    const [currentZoom, setCurrentZoom] = useState(13);
    const [tooltipFontSize, setTooltipFontSize] = useState('9'); // Default to medium (9px)
    const [weatherEnabled, setWeatherEnabled] = useState(false);
    const [weatherLayerType, setWeatherLayerType] = useState('precipitation_new');
    const [weatherPreferences, setWeatherPreferences] = useState({
        enabled: false,
        layerType: 'temperature'
    });
    const [isLayerEditing, setIsLayerEditing] = useState(false);
    const [followedVehicle, setFollowedVehicle] = useState(null);
    const [tempMarkers, setTempMarkers] = useState([]);
    const [showSpecialResourcesModal, setShowSpecialResourcesModal] = useState(false);
    const [slackNotificationsEnabled, setSlackNotificationsEnabled] = useState(true); // Default to enabled

    const location = useLocation();

    useEffect(() => {
        const query = new URLSearchParams(location.search);
        const userData = JSON.parse(decodeURIComponent(query.get('user')));

        if (userData) {
            setUser({
                name: userData.userName,
                userId: userData.userId,
                avatar: userData.userAvatar,
                permissions: userData.permissions
            });
        }
    }, [location, setUser]);

    useEffect(() => {
        if (user && user.permissions) {
            setShowPoliceGPS(hasPermission(user, PERMISSIONS.POLICE_GPS) || hasPermission(user, PERMISSIONS.ADMIN));
            setShowFireGPS(hasPermission(user, PERMISSIONS.FIRE_GPS) || hasPermission(user, PERMISSIONS.ADMIN));
        }
    }, [user]);

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        
        const fetchActiveIncidents = async () => {
            try {
                const incidentResponse = await fetch(`${API_URL}/api/incidents`, {
                    signal: controller.signal
                });
                
                if (!isMounted) return;
                
                const incidentData = await incidentResponse.json();
                const activeIncidents = incidentData.filter(incident => incident.active);
                setActiveIncidents(activeIncidents);
            } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Failed to load active incidents:', error);
            }
        };
        
        fetchActiveIncidents();
        const intervalId = setInterval(fetchActiveIncidents, 5000); // Keep at 5 seconds as requested

        return () => {
            isMounted = false;
            clearInterval(intervalId);
            controller.abort();
        };
    }, []);

    const fetchMarkers = useCallback(async (incidentId, signal) => {
        if (!incidentId) {
            setMarkers([]);
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/api/drawn-items?incident_id=${incidentId}`, {
                credentials: 'include',
                signal
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch markers');
            }
            
            const markerData = await response.json();
            
            // Filter active markers with valid geojson
            const validMarkers = markerData.filter(marker => 
                marker.active && 
                marker.geojson && 
                marker.geojson.geometry && 
                marker.geojson.geometry.coordinates
            );
            
            setMarkers(validMarkers);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Failed to load markers:', error);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let intervalId = null;
        
        if (selectedIncident && selectedIncident.incident_id) {
            // Initial fetch
            fetchMarkers(selectedIncident.incident_id, controller.signal);

            // Set interval to 5 seconds as requested
            intervalId = setInterval(() => {
                fetchMarkers(selectedIncident.incident_id, controller.signal);
            }, 5000);
        } else {
            setMarkers([]);
        }
        
        return () => {
            if (intervalId) clearInterval(intervalId);
            controller.abort();
        };
    }, [selectedIncident, fetchMarkers]);

    useEffect(() => {
        const controller = new AbortController();
        let intervalId = null;
        
        const fetchCSVFiles = async () => {
            try {
                const response = await fetch(`${API_URL}/api/csv/files`, {
                    credentials: 'include',
                    signal: controller.signal
                });
                
                if (!response.ok) throw new Error('Failed to fetch CSV files');
                const files = await response.json();
                setCsvFiles(files);
            } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Error fetching CSV files:', error);
                setCsvFiles([]);
            }
        };

        fetchCSVFiles();
        // Poll every 2 minutes instead of 1 minute to reduce load
        intervalId = setInterval(fetchCSVFiles, 120000);

        return () => {
            if (intervalId) clearInterval(intervalId);
            controller.abort();
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        
        const fetchLayerData = async () => {
            // Skip if no layers selected
            if (!selectedLayers.length) return;
            
            const newLayerData = {};
            
            for (const filename of selectedLayers) {
                // Skip if component unmounted
                if (!isMounted) break;
                
                try {
                    const response = await fetch(`${API_URL}/api/csv/data/${filename}`, {
                        credentials: 'include',
                        signal: controller.signal
                    });
                    
                    if (!isMounted) break;
                    
                    if (!response.ok) throw new Error(`Failed to fetch CSV data for ${filename}`);
                    const geoJSONData = await response.json();
                    newLayerData[filename] = geoJSONData;
                } catch (error) {
                    if (error.name === 'AbortError') return;
                    console.error(`Error loading CSV data for ${filename}:`, error);
                }
            }
            
            if (isMounted && Object.keys(newLayerData).length > 0) {
                setLayerData(newLayerData);
            }
        };

        fetchLayerData();
        
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [selectedLayers]);

    useEffect(() => {
        // Skip if no layer data
        if (!layerData || Object.keys(layerData).length === 0) {
            return;
        }
        
        // Single timeout reference
        let timeoutId = null;
        let isMounted = true;
        
        // Process everything in one go to avoid cascading timeouts
        const processAllLayers = () => {
            // Collect all features from all layers
            const allFeatures = [];
            
            for (const [filename, data] of Object.entries(layerData)) {
                if (!data || !data.features) continue;
                
                // Add filename to each feature for reference
                data.features.forEach((feature, index) => {
                    allFeatures.push({
                        feature,
                        index: allFeatures.length + index,
                        filename
                    });
                });
            }
            
            // If too many features, limit to first 1000 to avoid hanging the browser
            const maxFeatures = Math.min(allFeatures.length, 1000);
            if (allFeatures.length > 1000) {
                console.warn(`Too many CSV features (${allFeatures.length}), limiting to 1000`);
            }
            
            // Process in chunks of 100
            const chunkSize = 100;
            let processedCount = 0;
            
            const processNextChunk = () => {
                if (!isMounted) return;
                
                const end = Math.min(processedCount + chunkSize, maxFeatures);
                const chunk = allFeatures.slice(processedCount, end);
                
                // Render this chunk
                chunk.forEach(({ feature, index }) => {
                    renderGeoJSONLayer(feature, index, 'csv-marker-tooltip');
                });
                
                processedCount = end;
                
                // If more to process, schedule next chunk
                if (processedCount < maxFeatures && isMounted) {
                    timeoutId = setTimeout(processNextChunk, 100);
                }
            };
            
            // Start processing
            processNextChunk();
        };
        
        // Run once
        processAllLayers();
        
        // Cleanup timeout on unmount
        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [layerData]);

    useEffect(() => {
        selectedIncidentRef.current = selectedIncident;
    }, [selectedIncident]);

    useEffect(() => {
        const toolbar = document.querySelector('.leaflet-draw-toolbar');
        if (toolbar) {
            if (!selectedIncident) {
                toolbar.classList.add('no-selected-incident');
            } else {
                toolbar.classList.remove('no-selected-incident');
            }
        }
    }, [selectedIncident]);

    const handleFormSubmit = async (newIncidentData) => {
        if (!hasPermission(user, PERMISSIONS.MAKE_INCIDENTS)) {
            alert('You do not have permission to create incidents');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/incidents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newIncidentData)
            });

            if (!response.ok) {
                throw new Error('Failed to create incident');
            }

            const createdIncident = await response.json();

            const newMarker = {
                incident_id: createdIncident.incident_id,
                geojson: {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [createdIncident.location_long, createdIncident.location_lat]
                    },
                    properties: {
                        name: createdIncident.name,
                        color: '#3388ff'
                    }
                }
            };

            const radiusInMeters = createdIncident.radius * 1609.34;
            const circleGeoJSON = {
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [Array.from({ length: 64 }, (_, i) => {
                        const angle = (i * 360) / 64;
                        const latitudeOffset = (radiusInMeters / 111320) * Math.cos(angle * (Math.PI / 180));
                        const longitudeOffset = (radiusInMeters / (111320 * Math.cos(createdIncident.location_lat * (Math.PI / 180)))) * Math.sin(angle * (Math.PI / 180));
                        return [createdIncident.location_long + longitudeOffset, createdIncident.location_lat + latitudeOffset];
                    })]
                },
                properties: {
                    name: `${createdIncident.name} `,
                    color: 'rgba(0, 0, 255, 0.2)'
                }
            };

            setMarkers((prevMarkers) => [...prevMarkers, newMarker, { incident_id: createdIncident.incident_id, geojson: circleGeoJSON, name: createdIncident.name, color: 'rgba(0, 0, 255, 0.1)' }]);

            const drawnItemData = {
                type: circleGeoJSON.geometry.type,
                coordinates: circleGeoJSON.geometry.coordinates,
                properties: circleGeoJSON.properties,
                incident_id: createdIncident.incident_id
            };
            console.log('Submitting drawn item data:', drawnItemData); 
            saveDrawnItem(drawnItemData);

            setSelectedIncidentState(createdIncident); // <-- Update state

            toast.success('Incident entered in database', toastConfig);

            setShowForm(false);

        } catch (error) {
            console.error('Error creating incident:', error);
        }
    };

    const handleIncidentClick = (incident) => {
        setSelectedIncidentState(incident); // <-- Update state
        setSelectedIncident(incident); // <-- Call setSelectedIncident prop
    };

    const metersToFeet = (meters) => meters * 3.28084;

    const onCreated = (e) => {
        const { layerType, layer } = e;
        setCurrentLayer(layer);
        setShowNameColorForm(true);
    };

    const handleNameColorSubmit = (data) => {
        setShowNameColorForm(false);
        if (!selectedIncidentRef.current) {
            alert('Please select an active incident first.');
            return;
        }

        const { name, color } = data;

        if (currentLayer) {
            if (currentLayer.setStyle) {
                currentLayer.setStyle({ color });
            }
            currentLayer.bindTooltip(name, { permanent: true, direction: 'top', offset: [0, -20] });
        }

        let geojsonData;
        const layerType = currentLayer.feature ? currentLayer.feature.geometry.type : currentLayer instanceof L.Marker ? 'Point' : '';

        if (currentLayer instanceof L.Circle) {
            const circle = currentLayer;
            const latLng = circle.getLatLng();
            const radius = circle.getRadius();

            if (radius <= 10) {
                geojsonData = {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [latLng.lng, latLng.lat]
                    },
                    properties: {
                        name: name,
                        color: color,
                        radius: radius,
                        markerType: 'CircleMarker'
                    }
                };
            } else {
                const options = { steps: 64, units: 'meters' };
                const turfCircle = turf.circle([latLng.lng, latLng.lat], radius, options);
                turfCircle.properties = {
                    name: name,
                    color: color,
                    radius: radius,
                    markerType: 'ComplexCircle'
                };
                geojsonData = turfCircle;
            }
        } else {
            geojsonData = currentLayer.toGeoJSON();
            geojsonData.properties = { name, color, markerType: layerType };
        }

        const drawnItemData = {
            type: geojsonData.geometry.type,
            coordinates: geojsonData.geometry.coordinates,
            properties: geojsonData.properties,
            incident_id: selectedIncidentRef.current.incident_id
        };
        console.log('Submitting drawn item data:', drawnItemData); 
        saveDrawnItem(drawnItemData);
    };

    const saveDrawnItem = async (drawnItemData) => {
        try {
            if (!selectedIncidentRef.current) {
                toast.error('Please select an incident first', toastConfig);
                return;
            }

            // Ensure markerType is not empty
            if (!drawnItemData.properties.markerType) {
                drawnItemData.properties.markerType = drawnItemData.type;
            }

            console.log('Attempting to save drawn item:', drawnItemData);
            
            const response = await fetch(`${API_URL}/api/drawn-items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    type: drawnItemData.type,
                    coordinates: drawnItemData.coordinates,
                    properties: {
                        name: drawnItemData.properties.name,
                        color: drawnItemData.properties.color,
                        markerType: drawnItemData.properties.markerType
                    },
                    incident_id: selectedIncidentRef.current.incident_id
                })
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error('Server error response:', responseData);
                throw new Error(responseData.error || 'Failed to save drawn item');
            }

            // Refresh markers after successful save
            await fetchMarkers(selectedIncidentRef.current.incident_id, null);
            
            console.log('Successfully saved drawn item:', responseData);
            return responseData;
        } catch (error) {
            console.error('Error saving drawn item:', error);
            toast.error(`Failed to save drawn item: ${error.message}`, toastConfig);
            throw error;
        }
    };

    const handleDeleteMarkers = async (selectedMarkerIds) => {
        try {
            if (!selectedIncidentRef.current) {
                toast.error('No incident selected', toastConfig);
                return;
            }

            // Make DELETE request for each drawn item
            const deletePromises = selectedMarkerIds.map(itemId =>
                fetch(`${API_URL}/api/drawn-items/${itemId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                })
            );

            await Promise.all(deletePromises);

            // Refresh drawn items after deletion
            const response = await fetch(
                `${API_URL}/api/drawn-items?incident_id=${selectedIncidentRef.current.incident_id}`,
                { credentials: 'include' }
            );
            
            if (!response.ok) throw new Error('Failed to fetch updated items');
            
            const updatedItems = await response.json();
            setMarkers(updatedItems.filter(item => item.active));

            toast.success('Items deleted successfully', toastConfig);
        } catch (error) {
            console.error('Error deleting items:', error);
            toast.error('Failed to delete items', toastConfig);
        }
    };

    const handleCloseIncident = async (formData) => {
        try {
            if (!selectedIncidentRef.current) {
                toast.error('No incident selected', toastConfig);
                return;
            }

            const response = await fetch(`${API_URL}/api/incidents/close-incident`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    incident_id: selectedIncidentRef.current.incident_id,
                    disposition: formData.disposition,
                    notes: formData.notes,
                    email_requested: formData.emailRequested,
                    email_address: formData.emailAddress,
                    created_by_name: user.name,
                    created_by_userid: user.userId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                toast.success('Incident closed successfully', toastConfig);
                setShowCloseModal(false);
                
                // Refresh active incidents
                try {
                    const incidentResponse = await fetch(`${API_URL}/api/incidents`);
                    const incidentData = await incidentResponse.json();
                    const activeIncidents = incidentData.filter(incident => incident.active);
                    setActiveIncidents(activeIncidents);
                    
                    // Clear selected incident
                    setSelectedIncident(null);
                } catch (error) {
                    console.error('Failed to refresh incidents:', error);
                }
            } else {
                throw new Error(data.error || 'Failed to close incident');
            }
        } catch (error) {
            console.error('Error closing incident:', error);
            toast.error(`Failed to close incident: ${error.message}`, toastConfig);
        }
    };

    const renderGeoJSONLayer = (geojson, index, customClass = '') => {
        const { type, coordinates } = geojson.geometry;
        const { name, color, radius, markerType } = geojson.properties;
        const uniqueKey = `${name}-${index}`;

        if (!type) {
            console.error('Unsupported GeoJSON type or markerType:', type, markerType);
            return null;
        }

        const tooltipClass = customClass || 'special-tooltip';

        switch (type) {
            case 'Point':
                if (markerType === 'CircleMarker') {
                    return (
                        <CircleMarker
                            key={uniqueKey}
                            center={[coordinates[1], coordinates[0]]}
                            color={color || 'darkblue'}
                            fillColor={color || 'lightblue'}
                            radius={radius || 5}
                            className={customClass}
                        >
                            <Tooltip permanent className={tooltipClass}>{name}</Tooltip>
                        </CircleMarker>
                    );
                } else {
                    const latLng = L.latLng(coordinates[1], coordinates[0]);
                    const radiusInMeters = metersToFeet(radius || 5);
                    const turfCircle = turf.circle([latLng.lng, latLng.lat], radiusInMeters, { steps: 64, units: 'meters' });
                    const latlngs = turfCircle.geometry.coordinates[0].map(coord => L.latLng(coord[1], coord[0]));
                    return (
                        <Polygon
                            key={uniqueKey}
                            positions={latlngs}
                            color={color || 'darkblue'}
                            fillColor={color || 'lightblue'}
                            fillOpacity={0.4}
                            className={customClass}
                        >
                            <Tooltip permanent className={tooltipClass}>{name}</Tooltip>
                        </Polygon>
                    );
                }
            case 'Polygon':
                return (
                    <Polygon
                        key={uniqueKey}
                        positions={coordinates[0].map(coord => [coord[1], coord[0]])}
                        color={color || 'darkblue'}
                        fillColor={color || 'lightblue'}
                        fillOpacity={0.4}
                        className={customClass}
                    >
                        <Tooltip permanent className={tooltipClass}>{name}</Tooltip>
                    </Polygon>
                );
            case 'LineString':
                return (
                    <Polyline
                        key={uniqueKey}
                        positions={coordinates.map(coord => [coord[1], coord[0]])}
                        color={color || 'darkblue'}
                        className={customClass}
                    >
                        <Tooltip permanent className={tooltipClass}>{name}</Tooltip>
                    </Polyline>
                );
            default:
                console.error('Unsupported GeoJSON type or markerType:', type, markerType);
                return null;
        }
    };

    const handleLogout = async () => {
        try {
            // Clear local storage first
            localStorage.removeItem('user');
            localStorage.removeItem('authToken');
            
            // Call server logout endpoint with proper headers
            await fetch('/logout', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            // Always redirect to login page, even if the logout request fails
            window.location.href = '/login';
            
            // If the above doesn't work, try forcing a full page reload to /login
            if (window.location.pathname !== '/login') {
                window.location.replace('/login');
            }
        }
    };

    // Add a ref to track the current map type
    const currentMapTypeRef = useRef(null);

    const getActiveMapUrl = useCallback(() => {
        const shouldUseGoogleMaps = currentZoom >= 19;
        const mapUrl = shouldUseGoogleMaps 
            ? `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=${googleApiKey}`
            : MAP_URLS[selectedMapType];

        if (currentMapTypeRef.current !== mapUrl) {
            currentMapTypeRef.current = mapUrl;
        }

        return mapUrl;
    }, [currentZoom, selectedMapType, googleApiKey]);

    const getMapAttribution = () => {
        if (currentZoom >= 19) {
            return '© Google';
        }
        return selectedMapType === 'openStreetMap'
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            : '© Google';
    };

    // Add console log to track selectedMapType changes
    useEffect(() => {
        console.log('selectedMapType changed to:', selectedMapType);
    }, [selectedMapType]);

    /*Add console log to track currentZoom changes
    useEffect(() => {
        console.log('currentZoom changed to:', currentZoom);
    }, [currentZoom]);
*/

    // Add this effect to load user preferences
    useEffect(() => {
        const controller = new AbortController();
        let isMounted = true;
        
        const fetchWeatherPreferences = async () => {
            try {
                const response = await fetch(`${API_URL}/api/weather/preferences`, {
                    credentials: 'include',
                    signal: controller.signal
                });
                
                if (!isMounted) return;
                
                if (!response.ok) {
                    console.warn('Weather preferences not found, using defaults');
                    return;
                }
                
                const data = await response.json();
                setWeatherPreferences(data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    // Request was aborted, no need to handle
                    return;
                }
                console.warn('Error loading weather preferences, using defaults:', error);
            }
        };

        fetchWeatherPreferences();
        
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    // Add this handler
    const handleWeatherToggle = (enabled) => {
        console.log('Weather toggle:', enabled);
        setWeatherEnabled(enabled);
    };

    const handleWeatherLayerChange = (type) => {
        console.log('Weather layer change:', type);
        setWeatherLayerType(type);
    };

    // Handler for Slack notifications toggle
    const handleSlackNotificationsToggle = (enabled) => {
        console.log('Slack notifications toggle:', enabled);
        setSlackNotificationsEnabled(enabled);
        notificationService.setSlackNotificationsEnabled(enabled);
    };

    // Layer control modal state
    const [isLayerControlOpen, setLayerControlOpen] = useState(false);

    // Font size options
    const fontSizeOptions = ['8', '10', '12', '14', '16', '18', '20'];

    // Handlers
    const handleMapTypeChange = (type) => {
        setSelectedMapType(type);
    };

    const handleLayerToggle = (layer) => {
        setSelectedLayers(prev => {
            if (prev.includes(layer)) {
                return prev.filter(l => l !== layer);
            } else {
                return [...prev, layer];
            }
        });
    };

    // Add this effect to fetch markers when selected incident changes
    useEffect(() => {
        const fetchMarkers = async () => {
            if (selectedIncidentRef.current) {
                try {
                    const response = await fetch(
                        `${API_URL}/api/drawn-items?incident_id=${selectedIncidentRef.current.incident_id}`,
                        { credentials: 'include' }
                    );
                    
                    if (!response.ok) throw new Error('Failed to fetch markers');
                    
                    const data = await response.json();
                    setMarkers(data.filter(item => item.active));
                } catch (error) {
                    console.error('Error fetching markers:', error);
                    setMarkers([]);
                }
            }
        };

        fetchMarkers();
    }, [selectedIncidentRef.current]);

    useEffect(() => {
        const controller = new AbortController();
        let isActive = true;
        
        const handleRefresh = async () => {
            if (!isActive) return;
            
            const incidentId = selectedIncidentRef.current?.incident_id;
            if (!incidentId) return;
            
            try {
                const response = await fetch(
                    `${API_URL}/api/drawn-items?incident_id=${incidentId}`,
                    { 
                        credentials: 'include',
                        signal: controller.signal
                    }
                );
                
                if (!isActive) return;
                
                if (!response.ok) throw new Error('Failed to fetch updated items');
                
                const updatedItems = await response.json();
                setMarkers(updatedItems.filter(item => item.active));
            } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Error refreshing markers:', error);
            }
        };

        // Add event listener
        window.addEventListener('refreshMarkers', handleRefresh);
        
        return () => {
            isActive = false;
            controller.abort();
            window.removeEventListener('refreshMarkers', handleRefresh);
        };
    }, []);

    return (
        <>
            <div className="overlay-top">
                <div className="user-info">
                    {user.avatar && <img src={user.avatar} alt="User Avatar" className="user-avatar" />}
                    <span 
                        className="user-name" 
                        onClick={handleLogout}
                        style={{
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            userSelect: 'none'
                        }}
                        title="Click to logout"
                    >
                        Welcome, {user.name}
                    </span>
                </div>
            </div>
            <div className={activeIncidents.length === 0 ? 'overlay-right-no-inc' : 'overlay-right'}>
                {activeIncidents.map((incident) => (
                    <IncidentModal
                        key={incident.incident_id}
                        incident={incident}
                        isActive={selectedIncident ? selectedIncident.incident_id === incident.incident_id : false}
                        onClick={handleIncidentClick}
                    />
                ))}
            </div>
            <div className="logo-box">
                <img src={logo} alt="Logo" className="logo" />
            </div>
            <MapContainer center={position} zoom={13} maxZoom={20} style={{ height: '100vh', width: '100%' }}>
                <ZoomHandler onZoomChange={setCurrentZoom} />
                <TileLayer
                    key={`tile-layer-${currentZoom >= 19 ? 'google' : selectedMapType}`}
                    url={getActiveMapUrl()}
                    attribution={getMapAttribution()}
                    maxZoom={20}
                    tileSize={256}
                    zoomOffset={0}
                />
                <MapClickHandler setIncidentLocation={setIncidentLocation} setMarkerPosition={setMarkerPosition} />
                <ZoomToIncident incident={selectedIncident} />
                <IncidentLayerManager 
                    selectedIncident={selectedIncident}
                    activeIncidents={activeIncidents}
                    drawnItems={drawnItems}
                    isEditing={isLayerEditing}
                />
                <NameColorForm
                    show={showNameColorForm}
                    onClose={() => setShowNameColorForm(false)}
                    onSubmit={handleNameColorSubmit}
                />
                {markerPosition && (
                    <CircleMarker
                        key={`marker-${markerPosition.lat}-${markerPosition.lng}`}
                        center={markerPosition}
                        color="darkblue"
                        fillColor="lightblue"
                        radius={10}
                        fillOpacity={0.5}
                    >
                        <Tooltip permanent direction="top" offset={[0, -20]}>
                            Selected Location: {markerPosition.lat.toFixed(3)}, {markerPosition.lng.toFixed(3)}
                        </Tooltip>
                    </CircleMarker>
                )}
                {markers.map((marker, markerIndex) => {
                    const geojson = marker.geojson;
                    if (geojson && geojson.geometry) {
                        return renderGeoJSONLayer(geojson, markerIndex);
                    } else {
                        console.error('Invalid marker position:', marker);
                        return null;
                    }
                })}
                <DrawingTools onCreated={onCreated} />
                {(showPoliceGPS || showFireGPS) && (
                    <VehicleLayer 
                        setVehicles={setVehicles} 
                        showPoliceGPS={showPoliceGPS}
                        showFireGPS={showFireGPS}
                        showTooltips={showTooltips}
                        tooltipFontSize={tooltipFontSize}
                        followedVehicle={followedVehicle}
                        setFollowedVehicle={setFollowedVehicle}
                    />
                )}
                {(showPoliceGPS || showFireGPS) && vehicles.length > 0 && activeIncidents.length > 0 && (
                    <VehicleTracker 
                        vehicles={vehicles.filter(v => 
                            (showPoliceGPS && v.type === 'police') || 
                            (showFireGPS && (v.type === 'fire' || v.type === 'ems'))
                        )} 
                        incidents={activeIncidents} 
                    />
                )}
                <VehicleSearchHandler vehicles={vehicles} onVehicleSelect={() => { }} />
                {Object.entries(layerData).map(([filename, layerDataItem], index) => (
                    <React.Fragment key={index}>
                        {layerDataItem.features.map((feature, featureIndex) => 
                            renderGeoJSONLayer(feature, featureIndex, 'csv-marker')
                        )}
                    </React.Fragment>
                ))}
                <Toolbar
                    homePosition={homePosition}
                    setShowLayerModal={setLayerControlOpen}
                    setShowForm={hasPermission(user, PERMISSIONS.MAKE_INCIDENTS) ? setShowForm : null}
                    setShowEditMarkersModal={setShowEditMarkersModal}
                    setShowCloseModal={setShowCloseModal}
                    user={user}
                    toggleMobileMode={toggleMobileMode}
                    setShowSpecialResourcesModal={setShowSpecialResourcesModal}
                />
                {showStarChase && hasPermission(user, PERMISSIONS.STARCHASE) && (
                    <StarChaseLayer />
                )}
                <WeatherOverlay 
                    enabled={weatherEnabled} 
                    layerType={weatherLayerType}
                />
                
                <CADAlerts />
                <TempMarkersLayer user={user} />
            </MapContainer>

            {showForm && <StyledIncidentForm onClose={() => setShowForm(false)} onSubmit={handleFormSubmit} location={incidentLocation} />}
            <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
                <Modal.Body className="modal-success">{successMessage}</Modal.Body>
            </Modal>
            <CloseIncidentModal
                show={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                onSubmit={handleCloseIncident}
                incidentId={selectedIncidentRef.current ? selectedIncidentRef.current.incident_id : null}
            />
            <EditMarkersModal
                show={showEditMarkersModal}
                onClose={() => setShowEditMarkersModal(false)}
                markers={markers}
                setLayerEditing={setIsLayerEditing}
            />
            <LayerControlModal
                isOpen={isLayerControlOpen}
                onClose={() => setLayerControlOpen(false)}
                selectedMapType={selectedMapType}
                onMapTypeChange={handleMapTypeChange}
                user={user}
                showPoliceGPS={showPoliceGPS}
                setShowPoliceGPS={setShowPoliceGPS}
                showFireGPS={showFireGPS}
                setShowFireGPS={setShowFireGPS}
                showStarChase={showStarChase}
                setShowStarChase={setShowStarChase}
                csvFiles={csvFiles}
                selectedLayers={selectedLayers}
                handleLayerToggle={handleLayerToggle}
                showTooltips={showTooltips}
                setShowTooltips={setShowTooltips}
                tooltipFontSize={tooltipFontSize}
                setTooltipFontSize={setTooltipFontSize}
                fontSizeOptions={fontSizeOptions}
                weatherEnabled={weatherEnabled}
                onWeatherToggle={handleWeatherToggle}
                weatherLayerType={weatherLayerType}
                onWeatherLayerChange={handleWeatherLayerChange}
                slackNotificationsEnabled={slackNotificationsEnabled}
                onSlackNotificationsToggle={handleSlackNotificationsToggle}
            />
            <WeatherAlerts />
            {followedVehicle && (
                <div className="following-indicator">
                    Following: {typeof followedVehicle === 'string' ? followedVehicle : followedVehicle.displayName}
                    <button onClick={() => setFollowedVehicle(null)}>Stop Following</button>
                </div>
            )}
            
            {/* Special Resources Modal - Always rendered to prevent flashing during updates */}
            <SpecialResourcesModal 
                show={showSpecialResourcesModal}
                onClose={() => setShowSpecialResourcesModal(false)}
                user={{
                    userEmail: user.email,
                    userName: user.name,
                    userId: user.userId,
                    department: user.department
                }}
            />
        </>
    );
};

export default MapPage;