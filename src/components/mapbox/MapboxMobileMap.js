import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Map } from 'react-map-gl/mapbox';
import {
  Source,
  Layer,
  Marker,
  Popup,
  Tooltip,
  NavigationControl
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import '../../App.css';

// Import Mapbox-specific components 
import MapboxHeader from './mobile/MapboxHeader';
import MapboxStatusBar from './mobile/MapboxStatusBar';
import MapboxMarkerNameModal from './mobile/modals/MapboxMarkerNameModal';
import MapboxZoomControls from './MapboxZoomControls';
import MapboxVehicleSearch from './MapboxVehicleSearch';
import SpecialResourcesModal from './mobile/modals/SpecialResourcesModal';
import ApiControl from './ApiControl';

// Import refactored components
import VehicleMarker from './VehicleMarker';
import TempMarker from './TempMarker';
import ContinuousVehicleTracker from './ContinuousVehicleTracker';
import DrivingModeHandler from './DrivingModeHandler';
import SearchAreaBox from './SearchAreaBox';

// Import utilities
import { getVehicleIconUrl, haversineDistance } from './utils/vehicleUtils';
import geocodingService from './utils/reverseGeocodingService';
import { darkenColor } from './utils';

// Import services 
import { 
  createViewStateChangeHandler, 
  createMapClickHandler, 
  createMapLoadHandler 
} from './services/mapInteractionService';
import { 
  followVehicle, 
  updateVehicleLocationInfo 
} from './services/vehicleService';
import { 
  saveMarker, 
  deleteMarker, 
  fetchMarkers 
} from './services/markerService';

// Import constants
import { MAPBOX_ACCESS_TOKEN, MAP_STYLES } from './constants/mapStyles';

// Add custom styles for the MapboxMobileMap component
// This ensures the vehicle search displays correctly
const mapboxMobileStyles = `
  .map-vehicle-search-wrapper .search-container {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    z-index: auto;
  }
  
  .map-vehicle-search-wrapper .search-results {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .driving-mode-indicator {
    position: fixed;
    top: 45px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(41, 117, 247, 0.9);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: bold;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }
  
  .search-loading {
    text-align: center;
    padding: 10px;
    font-style: italic;
    color: #666;
  }
  
  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.05);
      opacity: 0.9;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  /* Add padding to the bottom of the map to account for the status bar */
  .mapboxgl-map {
    padding-bottom: 200px !important;
  }
  
  /* Adjust position of map controls to account for status bar */
  .mapboxgl-ctrl-bottom-right {
    bottom: 210px !important;
  }
  
  .mapboxgl-ctrl-bottom-left {
    bottom: 210px !important;
  }
`;

// Main MapBox Mobile Map Component
const MapboxMobileMap = ({ user, toggleMobileMode }) => {
  // State from the original MobileMap, adapted for MapBox
  const [vehicles, setVehicles] = useState([]);
  const [followedVehicle, setFollowedVehicle] = useState(null);
  const [darkMode, setDarkMode] = useState(true); // Start in dark mode
  const [markers, setMarkers] = useState([]);
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempMarkerPosition, setTempMarkerPosition] = useState(null);
  const [isDrivingMode, setIsDrivingMode] = useState(true); // Always in driving mode
  const [expandedNotifications, setExpandedNotifications] = useState({});
  const [showVehicleSearch, setShowVehicleSearch] = useState(true); // Control visibility of vehicle search
  
  // Add state for ambulance vehicles
  const [ambulanceVehicles, setAmbulanceVehicles] = useState([]);
  
  // Add state for incidents and drawn items
  const [incidents, setIncidents] = useState([]);
  const [activeIncidents, setActiveIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [drawnItems, setDrawnItems] = useState([]);
  const [showIncidents, setShowIncidents] = useState(true); // Start with incidents visible
  
  // Add state for geocoded location
  const [geocodedLocation, setGeocodedLocation] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Update movement stats state to be simpler
  const [movementStats, setMovementStats] = useState({
    totalVehicles: 0,
    movingVehicles: 0,
    lastUpdate: null
  });
  
  // Use a ref for initial positions to avoid state updates
  const initialPositionsRef = useRef({});
  
  // Add ref for the SSE connection
  const vehicleSourceRef = useRef(null);
  const mapRef = useRef(null);
  const viewStateRef = useRef(null);
  
  // Add a ref for the style element
  const styleRef = useRef(null);
  
  // Inject custom styles for the mobile map
  useEffect(() => {
    // Create a style element if it doesn't exist
    if (!styleRef.current) {
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        /* Add padding to the top of the map to account for the header */
        .mapboxgl-map { 
          padding-top: 50px !important; /* Match header height */
        }
        
        /* Make sure controls stay visible with the padding */
        .mapboxgl-ctrl-top-right,
        .mapboxgl-ctrl-top-left {
          top: 60px !important; /* Header height + additional spacing */
        }
      `;
      document.head.appendChild(styleElement);
      styleRef.current = styleElement;
    }
    
    // Clean up on unmount
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);
  
  // MapBox specific state with White Plains, NY coordinates
  const [viewState, setViewState] = useState({
    longitude: -73.7629, // White Plains, NY coordinates
    latitude: 41.0340,
    zoom: 14,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }
  });
  
  // Determine current map style based on dark mode
  const [useMapboxStyles, setUseMapboxStyles] = useState(true);
  
  const getCurrentMapStyle = useCallback(() => {
    if (!useMapboxStyles) {
      return darkMode ? MAP_STYLES.fallbackDark : MAP_STYLES.fallbackLight;
    }
    return darkMode ? MAP_STYLES.navigationNight : MAP_STYLES.navigation;
  }, [darkMode, useMapboxStyles]);
  
  // Handle style loading errors (switches to fallback if Mapbox styles fail)
  const handleStyleLoadError = useCallback((error) => {
    console.error("Map style load error:", error);
    // If we get an authorization error, switch to fallback styles
    if (error.status === 401 || error.status === 403) {
      console.log("Switching to fallback map styles due to authorization error");
      setUseMapboxStyles(false);
    }
  }, []);
  
  // Toggle function for dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };
  
  // Function to handle when a vehicle is selected for following
  const handleVehicleFollow = useCallback(async (vehicle) => {
    setShowVehicleSearch(false); // Hide the vehicle search after selection
    
    // Log the follow action to database and console
    try {
      // First try to extract user info from URL if it exists (enriched user)
      let userInfo = null;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user');
        if (userParam) {
          userInfo = JSON.parse(decodeURIComponent(userParam));
          console.log("Got user from URL params:", userInfo);
        }
      } catch (err) {
        console.error("Failed to parse user from URL:", err);
      }
      
      // If URL parsing failed, fall back to the user prop
      if (!userInfo) {
        userInfo = user;
      }
      
      // Ensure we have email and name
      const userEmail = userInfo?.userEmail || userInfo?.email;
      // Make sure we have a name - use email prefix if no name is available
      let userName = userInfo?.userName || userInfo?.name;
      if (!userName && userEmail) {
        userName = userEmail.split('@')[0]; // Use part before @ as fallback name
      }
      
      if (userEmail) {
        const baseUrl = process.env.REACT_APP_API_URL || '';
        const vehicleName = vehicle?.displayName || 'unknown vehicle';
        
        // Log to console with more details
        console.log(`User ${userName} (${userEmail}) is now following ${vehicleName} in mobile mode at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
        
        // Send to server for database logging with verified fields
        const response = await fetch(`${baseUrl}/api/logs/mobile-follows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userEmail
          },
          body: JSON.stringify({
            follower_email: userEmail,
            follower_name: userName || userEmail.split('@')[0], // Never send "Unknown User"
            followed_vehicle: vehicleName,
            timestamp: new Date().toISOString()
          })
        }).catch(err => {
          console.error("Error logging follow action:", err);
          // Continue even if logging fails
        });
        
        if (response && !response.ok) {
          console.warn("Failed to log follow action to server:", await response.text());
        }
      } else {
        console.warn("Unable to log follow action - no user email available");
      }
    } catch (error) {
      console.error("Error in follow logging:", error);
      // Don't let logging errors prevent the actual follow action
    }
    
    await followVehicle(
      vehicle,
      user,
      setFollowedVehicle,
      setViewState,
      viewState,
      mapRef,
      15 // MIN_ZOOM_LEVEL
    );
  }, [user, viewState, mapRef]);
  
  // Function to handle marker creation
  const handleCreateMarker = () => {
    setIsMarkingMode(true);
  };
  
  // Function to save a marker
  const handleSaveMarker = async (markerName) => {
    if (!tempMarkerPosition) return;
    await saveMarker(
      tempMarkerPosition,
      markerName,
      user,
      setMarkers,
      setTempMarkerPosition,
      setShowNameModal
    );
  };
  
  // Function to delete a marker
  const handleDeleteMarker = async (markerId) => {
    await deleteMarker(markerId, user, setMarkers);
  };
  
  // Fetch markers when component mounts
  useEffect(() => {
    if (user?.userEmail) {
      fetchMarkers(user, setMarkers);
    } else {
      console.log('No user data, skipping marker fetch');
    }
  }, [user]);
  
  // Add useEffect to track vehicle movements - optimize to reduce memory usage
  useEffect(() => {
    if (vehicles.length === 0) return;
    
    const currentTime = new Date();
    let movingCount = 0;
    
    // Loop through all vehicles to check if they've moved
    vehicles.forEach(vehicle => {
      const vehicleKey = vehicle.displayName || vehicle.id;
      
      // Store initial position if not already stored
      if (!initialPositionsRef.current[vehicleKey]) {
        initialPositionsRef.current[vehicleKey] = {
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
          timestamp: currentTime
        };
      } else {
        // Check if vehicle has moved from initial position
        const initialPos = initialPositionsRef.current[vehicleKey];
        const movedSignificantly = 
          Math.abs(initialPos.latitude - vehicle.latitude) > 0.00001 || 
          Math.abs(initialPos.longitude - vehicle.longitude) > 0.00001;
          
        if (movedSignificantly) {
          movingCount++;
        }
      }
    });
    
    // Only update state if values actually changed
    setMovementStats(prev => {
      // Skip update if nothing changed to prevent unnecessary rerenders
      if (prev.totalVehicles === vehicles.length && 
          prev.movingVehicles === movingCount) {
        return prev;
      }
      
      return {
        totalVehicles: vehicles.length,
        movingVehicles: movingCount,
        lastUpdate: currentTime
      };
    });
    
    // Clean up the initialPositions ref when component unmounts
    return () => {
      // Remove entries for vehicles that no longer exist
      const currentVehicleKeys = new Set(
        vehicles.map(v => v.displayName || v.id)
      );
      
      Object.keys(initialPositionsRef.current).forEach(key => {
        if (!currentVehicleKeys.has(key)) {
          delete initialPositionsRef.current[key];
        }
      });
    };
  }, [vehicles]); // Only update when the vehicles array changes
  
  // Keep a reference to the current viewState for debugging
  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);
  
  // Custom view state handler that respects following
  const handleViewStateChange = useCallback(
    createViewStateChangeHandler(setViewState, followedVehicle, 15),
    [followedVehicle]
  );
  
  // Update the SSE effect for vehicle data fetching
  useEffect(() => {
    // Track component mounted state to prevent state updates after unmount
    let isMounted = true;
    
    // Cleanup function for SSE connection
    const cleanupSSE = () => {
      if (vehicleSourceRef.current) {
        console.log("Closing SSE connection");
        // Clear any pending reconnection timeout
        if (vehicleSourceRef.current.reconnectTimeoutId) {
          clearTimeout(vehicleSourceRef.current.reconnectTimeoutId);
        }
        vehicleSourceRef.current.close();
        vehicleSourceRef.current = null;
      }
    };
    
    // Setup SSE connection with proper cleanup
    const setupSSEConnection = () => {
      try {
        // Skip if we already have a connection
        if (vehicleSourceRef.current) {
          console.log("SSE connection already exists, skipping setup");
          return;
        }
        
        // Get user email from props
        const userEmail = user?.userEmail;
        
        if (!userEmail) {
          console.error("Cannot connect to SSE: No user email available");
          return;
        }
        
        // Clean up any existing connection
        cleanupSSE();
        
        // Use the environment variable base URL if available
        const baseUrl = process.env.REACT_APP_API_URL || '';
        // Connect to the SSE endpoint with mobileMode flag
        const url = `${baseUrl}/sse/vehicles?userEmail=${encodeURIComponent(userEmail)}&mobileMode=true`;
        console.log(`Connecting to SSE for vehicles: ${url}`);
        
        vehicleSourceRef.current = new EventSource(url, { withCredentials: true });
        
        vehicleSourceRef.current.onmessage = (event) => {
          try {
            if (!isMounted) return; // Don't process events if component unmounted

            const data = JSON.parse(event.data);
            if (data && data.features) {
              console.log(`Received SSE vehicle update with ${data.features.length} features`);
              
              // Extract vehicle data from GeoJSON format
              const vehicleData = data.features.map(feature => {
                // Extract coords from GeoJSON Point geometry
                const [longitude, latitude] = feature.geometry?.coordinates || [-73.8803, 41.0793];
                return {
                  ...feature.properties,
                  id: feature.id || feature.properties?.id || Math.random().toString(36).substring(2, 9),
                  longitude,
                  latitude,
                  // Try to extract heading from properties
                  heading: feature.properties?.heading || feature.properties?.direction || 0
                };
              });
              
              // Check for ambulance vehicles in the main stream
              const ambulanceVehicles = vehicleData.filter(v => {
                // Identify ambulances based on properties or display name
                const displayName = (v.displayName || '').toLowerCase();
                const type = (v.type || '').toLowerCase();
                
                return type.includes('ems') || 
                       type.includes('ambulance') || 
                       displayName.includes('ambulance') || 
                       displayName.includes('ems') || 
                       displayName.includes('medic') ||
                       displayName.includes('als') ||
                       displayName.includes('bls');
              });
              
              // If we found ambulances, set them in state
              if (ambulanceVehicles.length > 0 && isMounted) {
                console.log(`Found ${ambulanceVehicles.length} ambulances in main vehicle stream`);
                
                // Mark these as ambulances for styling
                const formattedAmbulances = ambulanceVehicles.map(v => ({
                  ...v,
                  isAmbulance: true
                }));
                
                setAmbulanceVehicles(prev => {
                  // Only update if the data is actually different to prevent unnecessary rerenders
                  const prevIds = new Set(prev.map(v => v.id));
                  const newIds = new Set(formattedAmbulances.map(v => v.id));
                  
                  // Compare IDs to see if the collections are different
                  const hasChanged = 
                    prev.length !== formattedAmbulances.length || 
                    formattedAmbulances.some(v => !prevIds.has(v.id)) ||
                    prev.some(v => !newIds.has(v.id));
                  
                  return hasChanged ? formattedAmbulances : prev;
                });
              }
              
              // We got valid data, filter for police vehicles or use all if we have no police
              const policeVehicles = vehicleData.filter(v => {
                // Adapt this filter based on your data structure
                const type = (v.type || '').toLowerCase();
                return type.includes('police') || type.includes('sheriff');
              });
              
              // If we have police vehicles, use them, otherwise use all vehicles
              const vehiclesToUse = policeVehicles.length > 0 ? policeVehicles : vehicleData;
              
              if (isMounted) {
                setVehicles(prev => {
                  // Only update if the data is actually different to prevent unnecessary rerenders
                  const prevIds = new Set(prev.map(v => v.id));
                  const newIds = new Set(vehiclesToUse.map(v => v.id));
                  
                  // Compare IDs to see if the collections are different
                  const hasChanged = 
                    prev.length !== vehiclesToUse.length || 
                    vehiclesToUse.some(v => !prevIds.has(v.id)) ||
                    prev.some(v => !newIds.has(v.id));
                  
                  return hasChanged ? vehiclesToUse : prev;
                });
              }
              
              // If we're following a vehicle, update its data without recreating the SSE connection
              if (isMounted) {
                setFollowedVehicle(prev => {
                  if (!prev) return prev;
                  
                  const updatedFollowedVehicle = vehicleData.find(v => 
                    v.displayName === prev.displayName
                  );
                  
                  if (updatedFollowedVehicle && 
                      (updatedFollowedVehicle.latitude !== prev.latitude || 
                       updatedFollowedVehicle.longitude !== prev.longitude || 
                       updatedFollowedVehicle.heading !== prev.heading)) {
                    console.log("Updating followed vehicle data:", updatedFollowedVehicle);
                    return updatedFollowedVehicle;
                  }
                  
                  return prev;
                });
              }
            }
          } catch (error) {
            console.error("Error parsing SSE data:", error);
          }
        };
        
        vehicleSourceRef.current.onerror = (error) => {
          console.error("SSE connection error:", error);
          // Try to reconnect after a delay
          const timeoutId = setTimeout(() => {
            if (vehicleSourceRef.current && isMounted) {
              cleanupSSE();
              setupSSEConnection(); // Try to reconnect
            }
          }, 5000);
          
          // Store the timeout ID so we can clear it during cleanup
          if (vehicleSourceRef.current) {
            vehicleSourceRef.current.reconnectTimeoutId = timeoutId;
          }
        };
      } catch (error) {
        console.error("Error setting up SSE connection:", error);
      }
    };
    
    // Set up SSE connection
    setupSSEConnection();
    
    // Clean up on unmount
    return () => {
      isMounted = false;
      cleanupSSE();
    };
  // Only depend on user, not followedVehicle
  }, [user]);
  
  // Function to toggle driving mode
  const toggleDrivingMode = () => {
    // Minimum zoom level for driving mode
    const MIN_ZOOM_LEVEL = 15;
    
    // If enabling driving mode, make sure we follow a vehicle
    if (!isDrivingMode && !followedVehicle) {
      toast.info("Select a vehicle to follow first", {
        position: "top-center",
        autoClose: 3000
      });
      return;
    }
    
    // Log the vehicle heading and direction info
    if (followedVehicle) {
      console.log(`--- Driving Mode Toggle Info ---`);
      console.log(`Current vehicle heading: ${followedVehicle.heading || 0}°`);
      console.log(`Map bearing before toggle: ${viewState.bearing}°`);
      console.log(`Current zoom level: ${viewState.zoom}`);
      console.log(`Driving mode changing from ${isDrivingMode ? 'ON to OFF' : 'OFF to ON'}`);
    }
    
    // Toggle driving mode state
    setIsDrivingMode(prev => !prev);
    
    // When enabling driving mode, adjust view to match vehicle heading
    if (!isDrivingMode && followedVehicle) {
      // Determine appropriate zoom level - ensure it's at least MIN_ZOOM_LEVEL
      // but preserve the user's current zoom if it's already higher than minimum
      const newZoom = Math.max(viewState.zoom, MIN_ZOOM_LEVEL);
      console.log('toggleDrivingMode: Preserving zoom level at:', newZoom);
      
      // Apply map rotation to match vehicle heading
      setViewState({
        ...viewState,
        longitude: followedVehicle.longitude,
        latitude: followedVehicle.latitude,
        bearing: followedVehicle.heading || 0, // Set bearing to match vehicle heading
        pitch: 0, // Keep a flat view without pitch
        zoom: newZoom, // Preserve current zoom level
        transitionDuration: 500 // Smooth transition into driving mode
      });
      
      // In driving mode, only disable pan and rotate, but keep zoom enabled
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        map.dragPan.disable(); // Disable panning
        map.dragRotate.disable(); // Disable rotation
        
        // Ensure zoom controls remain enabled
        if (map.scrollZoom.isEnabled() === false) {
          console.log('toggleDrivingMode: Enabling scroll zoom');
          map.scrollZoom.enable();
        }
        if (map.doubleClickZoom.isEnabled() === false) {
          console.log('toggleDrivingMode: Enabling double click zoom');
          map.doubleClickZoom.enable();
        }
        if (map.touchZoomRotate.isEnabled() === false) {
          // Enable zoom but disable rotate
          console.log('toggleDrivingMode: Enabling touch zoom');
          map.touchZoomRotate.enable();
          map.touchZoomRotate.disableRotation();
        }
        
        // Limit the minimum zoom level to prevent zooming out too far
        map.setMinZoom(MIN_ZOOM_LEVEL);
        
        // Add a CSS class to the map container for driving mode styling
        map.getContainer().classList.add('driving-mode');
        
        // Log zoom capabilities
        console.log('toggleDrivingMode: Zoom capabilities after enabling driving mode:');
        console.log('- scrollZoom enabled:', map.scrollZoom.isEnabled());
        console.log('- doubleClickZoom enabled:', map.doubleClickZoom.isEnabled());
        console.log('- touchZoomRotate enabled:', map.touchZoomRotate.isEnabled());
      }
      
      // Notify the user
      toast.info(`Now in driving mode with ${followedVehicle.displayName || 'vehicle'}`, {
        position: "top-center",
        autoClose: 2000
      });
      
    } else {
      // Reset view when exiting driving mode
      setViewState({
        ...viewState,
        pitch: 0,
        bearing: 0, // Reset bearing to north
        transitionDuration: 500, // Smooth transition out of driving mode
        // Keep zoom at the same level - don't reset zoom when leaving driving mode
        zoom: viewState.zoom
      });
      
      // Re-enable all map interactions when exiting driving mode
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        map.dragPan.enable();
        map.dragRotate.enable();
        
        // Reset the minimum zoom restriction when exiting driving mode
        map.setMinZoom(0); // Default minimum zoom
        
        // Remove the driving mode class
        map.getContainer().classList.remove('driving-mode');
        
        // Log zoom capabilities
        console.log('toggleDrivingMode: Zoom capabilities after disabling driving mode:');
        console.log('- scrollZoom enabled:', map.scrollZoom.isEnabled());
        console.log('- doubleClickZoom enabled:', map.doubleClickZoom.isEnabled());
        console.log('- touchZoomRotate enabled:', map.touchZoomRotate.isEnabled());
      }
      
      // Notify the user
      toast.info('Exited driving mode', {
        position: "top-center",
        autoClose: 2000
      });
    }
  };
  
  // Function to handle showing the vehicle search dropdown
  const showVehicleSearchDropdown = () => {
    setShowVehicleSearch(true);
  };

  // Update geocoding whenever followed vehicle position changes
  useEffect(() => {
    if (!followedVehicle || !followedVehicle.latitude || !followedVehicle.longitude) {
      return;
    }
    
    // Debounce geocoding requests to reduce API calls
    const timeoutId = setTimeout(() => {
      updateVehicleLocationInfo(
        followedVehicle, 
        setIsGeocoding, 
        setGeocodedLocation,
        geocodingService
      );
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [followedVehicle?.latitude, followedVehicle?.longitude, followedVehicle?.heading]);

  // Create a ref at component level to store the fetch function
  const fetchDrawnItemsRef = useRef(null);

  // Fetch incidents when component mounts
  useEffect(() => {
    // Create a function to fetch drawn items for a specific incident
    const fetchDrawnItemsForIncident = async (incidentId) => {
      if (!user?.userEmail || !incidentId) {
        console.log(`Cannot fetch drawn items: ${!user?.userEmail ? 'No user email' : 'No incident ID'}`);
        return [];
      }
      
      console.log(`Fetching drawn items for incident ${incidentId}...`);
      
      try {
        const baseUrl = process.env.REACT_APP_API_URL || '';
        const response = await fetch(
          `${baseUrl}/api/drawn-items?incident_id=${incidentId}`,
          {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'X-User-Email': user?.userEmail
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const activeItems = data.filter(item => item.active);
        console.log(`Got ${activeItems.length}/${data.length} active drawn items for incident ${incidentId}`);
        
        // Log what types of items we got
        const itemTypes = {};
        activeItems.forEach(item => {
          if (item.geojson && item.geojson.geometry) {
            const type = item.geojson.geometry.type;
            const markerType = item.geojson.properties?.markerType;
            const key = `${type}${markerType ? `-${markerType}` : ''}`;
            itemTypes[key] = (itemTypes[key] || 0) + 1;
          }
        });
        console.log(`Item types found:`, itemTypes);
        
        return activeItems;
      } catch (error) {
        console.error(`Error fetching drawn items for incident ${incidentId}:`, error);
        return [];
      }
    };
    
    // Update the ref's current value with the latest version of the function
    fetchDrawnItemsRef.current = fetchDrawnItemsForIncident;
    
    const fetchIncidents = async () => {
      if (!user?.userEmail) {
        console.log('Cannot fetch incidents: No user email');
        return;
      }
      
      console.log('Fetching all incidents...');
      
      try {
        const baseUrl = process.env.REACT_APP_API_URL || '';
        const response = await fetch(`${baseUrl}/api/incidents`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-User-Email': user?.userEmail
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setIncidents(data);
        
        // Filter active incidents
        const active = data.filter(incident => incident.active);
        setActiveIncidents(active);
        
        console.log(`Fetched ${data.length} total incidents, ${active.length} active`);
        
        if (active.length === 0) {
          console.log('No active incidents found, not fetching drawn items');
          setDrawnItems([]);
          return;
        }
        
        console.log(`Fetching drawn items for ${active.length} active incidents...`);
        
        // Fetch drawn items for ALL active incidents
        let allDrawnItems = [];
        for (const incident of active) {
          console.log(`Processing incident ${incident.incident_id}: ${incident.name}`);
          const itemsForIncident = await fetchDrawnItemsForIncident(incident.incident_id);
          allDrawnItems = [...allDrawnItems, ...itemsForIncident];
        }
        
        console.log(`Total drawn items from all incidents: ${allDrawnItems.length}`);
        setDrawnItems(allDrawnItems);
        
        // Automatically select the most recent active incident if none are selected
        if (active.length > 0 && !selectedIncident) {
          // Sort by created_at date (most recent first) and select the first one
          const mostRecent = [...active].sort((a, b) => 
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
          )[0];
          
          console.log(`Auto-selecting most recent incident: ${mostRecent.incident_id} (${mostRecent.name})`);
          setSelectedIncident(mostRecent);
        }
      } catch (error) {
        console.error('Error fetching incidents:', error);
      }
    };
    
    let isMounted = true;
    let intervalId = null;
    
    // Initial fetch
    fetchIncidents();
    
    // Set up polling if the component is still mounted
    if (isMounted && user?.userEmail) {
      intervalId = setInterval(fetchIncidents, 30000);
    }
    
    // Clean up function
    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [user, selectedIncident]);
  
  // Optimize handleIncidentClick to reuse the fetchDrawnItemsForIncident function
  const handleIncidentClick = useCallback((incident) => {
    if (!incident) return;
    
    setSelectedIncident(incident);
    
    // Center map on incident
    setViewState(prev => ({
      ...prev,
      longitude: incident.location_long,
      latitude: incident.location_lat,
      zoom: 16,
      transitionDuration: 500
    }));
  }, [setViewState]);

  // Function to convert Leaflet circle to Mapbox circle
  const createCircleLayer = (incident) => {
    // Return empty layer config - circles now hidden
    return {
      type: 'circle',
      paint: {
        'circle-radius': 0,
        'circle-opacity': 0,
        'circle-stroke-width': 0,
        'circle-stroke-opacity': 0
      },
      filter: ['==', 'incident_id', incident.incident_id]
    };
  };

  // Function to handle map click event
  const handleMapClick = useCallback(
    createMapClickHandler(isMarkingMode, setTempMarkerPosition, setShowNameModal, setIsMarkingMode),
    [isMarkingMode]
  );
  
  // Function to handle map load event
  const onMapLoad = useCallback(
    createMapLoadHandler(setViewState, mapRef),
    []
  );

  // Memoize the rendered markers to prevent re-creation on each render
  const renderedMarkers = useMemo(() => {
    return markers.map(marker => (
      <TempMarker
        key={marker.id}
        marker={marker}
        onDelete={handleDeleteMarker}
        user={user}
      />
    ));
  }, [markers, handleDeleteMarker, user]);
  
  // Memoize active incidents to prevent re-creation on each render
  const renderedIncidents = useMemo(() => {
    if (!showIncidents) return [];
    
    return activeIncidents.map(incident => {
      if (!incident.location_lat || !incident.location_long) return null;
      
      // Check if this is the currently selected incident
      const isSelected = selectedIncident?.incident_id === incident.incident_id;
      
      return (
        <React.Fragment key={`incident-${incident.incident_id}`}>
          {/* Incident Name Label - Always shown */}
          <Marker
            longitude={incident.location_long}
            latitude={incident.location_lat}
            anchor="center"
            onClick={() => handleIncidentClick(incident)}
          >
            <div style={{
              backgroundColor: isSelected ? 'rgba(0, 123, 255, 0.9)' : 'rgba(73, 80, 87, 0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              {incident.name}
            </div>
          </Marker>
        </React.Fragment>
      );
    }).filter(Boolean);
  }, [activeIncidents, selectedIncident, showIncidents, handleIncidentClick]);
  
  // Memoize vehicle markers to prevent re-creation on each render
  const renderedVehicles = useMemo(() => {
    return vehicles.map(vehicle => (
      <VehicleMarker
        key={vehicle.displayName || vehicle.id}
        vehicle={vehicle}
        followedVehicle={followedVehicle}
        handleVehicleFollow={handleVehicleFollow}
        isDrivingMode={isDrivingMode}
      />
    ));
  }, [vehicles, followedVehicle, handleVehicleFollow, isDrivingMode]);
  
  // Memoize ambulance vehicle markers
  const renderedAmbulances = useMemo(() => {
    return ambulanceVehicles.map(vehicle => (
      <VehicleMarker
        key={vehicle.displayName || vehicle.id}
        vehicle={vehicle}
        followedVehicle={followedVehicle}
        handleVehicleFollow={handleVehicleFollow}
        isAmbulance={true}
        isDrivingMode={isDrivingMode}
      />
    ));
  }, [ambulanceVehicles, followedVehicle, handleVehicleFollow, isDrivingMode]);
  
  // Memoize drawn items to prevent re-creation on each render
  const renderedDrawnItems = useMemo(() => {
    if (!drawnItems.length) return null;
    
    console.log(`Rendering ${drawnItems.length} drawn items`);
    
    return drawnItems.map((item, index) => {
      if (!item.geojson || !item.geojson.geometry) {
        console.log(`Invalid drawn item at index ${index}:`, item);
        return null;
      }

      const { type } = item.geojson.geometry;
      const itemId = item.id || `drawn-item-${index}`;
      const color = item.geojson.properties?.color || '#FF4136';

      // Check if this drawn item has the same name as any incident to avoid duplicate labels
      const hasMatchingIncident = activeIncidents.some(incident => 
        incident.name === item.geojson.properties?.name
      );
      
      // Only show the label if it doesn't match an incident name
      const shouldShowLabel = !hasMatchingIncident;

      if (type === 'Point') {
        const [longitude, latitude] = item.geojson.geometry.coordinates;
        const markerType = item.geojson.properties?.markerType;
        const markerName = item.geojson.properties?.name || '';
        
        if (markerType === 'Circle') {
          return (
            <React.Fragment key={`drawn-circle-${itemId}`}>
              <Source
                id={`source-circle-${itemId}`}
                type="geojson"
                data={{
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      properties: {
                        id: itemId,
                        name: markerName,
                        color: color
                      },
                      geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                      }
                    }
                  ]
                }}
              >
                <Layer
                  id={`layer-circle-${itemId}`}
                  type="circle"
                  paint={{
                    'circle-radius': 10,
                    'circle-color': color,
                    'circle-opacity': 0.6,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': color
                  }}
                />
              </Source>
              {markerName && shouldShowLabel && (
                <Marker
                  key={`label-circle-${itemId}`}
                  longitude={longitude}
                  latitude={latitude}
                  offsetTop={-30}
                >
                  <div style={{
                    backgroundColor: 'rgba(40, 44, 52, 0.85)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                    borderLeft: `4px solid ${color}`
                  }}>{markerName}</div>
                </Marker>
              )}
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={`drawn-point-${itemId}`}>
              <Marker
                key={`marker-${itemId}`}
                longitude={longitude}
                latitude={latitude}
                anchor="bottom"
              >
                <div 
                  className="map-marker"
                  style={{ 
                    backgroundColor: color,
                    borderColor: darkenColor(color, 30)
                  }}
                />
              </Marker>
              {markerName && shouldShowLabel && (
                <Marker
                  key={`label-${itemId}`}
                  longitude={longitude}
                  latitude={latitude}
                  offsetTop={-30}
                >
                  <div style={{
                    backgroundColor: 'rgba(40, 44, 52, 0.85)',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                    borderLeft: `4px solid ${color}`
                  }}>{markerName}</div>
                </Marker>
              )}
            </React.Fragment>
          );
        }
      } else if (type === 'LineString') {
        console.log(`Rendering LineString with ${item.geojson.geometry.coordinates.length} points`);
        const coordinates = item.geojson.geometry.coordinates;
        const lineName = item.geojson.properties?.name || '';
        
        if (!coordinates || coordinates.length < 2) {
          console.log(`Invalid LineString coordinates for item ${itemId}:`, coordinates);
          return null;
        }
        
        // Calculate midpoint for label
        const midIndex = Math.floor(coordinates.length / 2);
        const midpoint = coordinates[midIndex];
        
        return (
          <React.Fragment key={`drawn-line-${itemId}`}>
            <Source
              id={`source-line-${itemId}`}
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {
                      id: itemId,
                      name: lineName,
                      color: color
                    },
                    geometry: {
                      type: 'LineString',
                      coordinates: coordinates
                    }
                  }
                ]
              }}
            >
              <Layer
                id={`layer-line-${itemId}`}
                type="line"
                paint={{
                  'line-color': color,
                  'line-width': 3,
                  'line-opacity': 0.9
                }}
              />
            </Source>
            {lineName && midpoint && shouldShowLabel && (
              <Marker
                key={`label-line-${itemId}`}
                longitude={midpoint[0]}
                latitude={midpoint[1]}
              >
                <div style={{
                  backgroundColor: 'rgba(40, 44, 52, 0.85)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                  borderLeft: `4px solid ${color}`
                }}>{lineName}</div>
              </Marker>
            )}
          </React.Fragment>
        );
      } else if (type === 'Polygon') {
        console.log(`Rendering Polygon with ${item.geojson.geometry.coordinates[0]?.length || 0} points`);
        const coordinates = item.geojson.geometry.coordinates;
        const polygonName = item.geojson.properties?.name || '';
        
        if (!coordinates || !coordinates[0] || coordinates[0].length < 3) {
          console.log(`Invalid Polygon coordinates for item ${itemId}:`, coordinates);
          return null;
        }
        
        // Calculate centroid for label (simple average of all points)
        let centerLng = 0;
        let centerLat = 0;
        const points = coordinates[0];
        for (const point of points) {
          centerLng += point[0];
          centerLat += point[1];
        }
        centerLng /= points.length;
        centerLat /= points.length;
        
        return (
          <React.Fragment key={`drawn-polygon-${itemId}`}>
            <Source
              id={`source-polygon-${itemId}`}
              type="geojson"
              data={{
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {
                      id: itemId,
                      name: polygonName,
                      color: color
                    },
                    geometry: {
                      type: 'Polygon',
                      coordinates: coordinates
                    }
                  }
                ]
              }}
            >
              <Layer
                id={`layer-polygon-fill-${itemId}`}
                type="fill"
                paint={{
                  'fill-color': color,
                  'fill-opacity': 0.3
                }}
              />
              <Layer
                id={`layer-polygon-outline-${itemId}`}
                type="line"
                paint={{
                  'line-color': color,
                  'line-width': 2,
                  'line-opacity': 0.9
                }}
              />
            </Source>
            {polygonName && (
              <Marker
                key={`label-polygon-${itemId}`}
                longitude={centerLng}
                latitude={centerLat}
              >
                <div style={{
                  backgroundColor: 'rgba(40, 44, 52, 0.85)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                  borderLeft: `4px solid ${color}`
                }}>{polygonName}</div>
              </Marker>
            )}
          </React.Fragment>
        );
      } else {
        console.log(`Unknown drawn item type: ${type} for item ${itemId}`);
        return null;
      }
    }).filter(Boolean);
  }, [drawnItems, activeIncidents, darkenColor]);

  // Add state for special resources modal
  const [showSpecialResourcesModal, setShowSpecialResourcesModal] = useState(false);
  
  // Special Resources button click handler
  const handleSpecialResourcesClick = () => {
    // Debug the user object structure before opening the modal
    console.log('Opening Special Resources Modal with user:', JSON.stringify(user, null, 2));
    setShowSpecialResourcesModal(true);
  };

  return (
    <div style={{ 
      height: '100vh', 
      width: '100%', 
      position: 'relative',
      backgroundColor: darkMode ? '#121212' : '#ffffff'
    }}>
      <Map
        {...viewState}
        ref={mapRef}
        onMove={handleViewStateChange}
        style={{ 
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: '100vh'
        }}
        mapStyle={getCurrentMapStyle()}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        onClick={handleMapClick}
        dragRotate={isDrivingMode} // Only enable rotation in driving mode
        touchZoomRotate={true}
        attributionControl={false} // Hide default attribution
        logoPosition='bottom-left'
        id="mapbox-main"
        renderWorldCopies={true}
        trackResize={true}
        boxZoom={true}
        cooperativeGestures={false}
        doubleClickZoom={true}
        minZoom={15} // Set minimum zoom level to 15
        onError={(error) => {
          console.error("Map error:", error);
          // Non-critical errors like missing tiles shouldn't affect the map
          if (error.status === 404 && error.url && error.url.includes('mapbox-incidents')) {
            console.log("Ignoring non-critical 404 for incidents layer");
            return; // Non-critical error
          }
          
          // For critical errors, try switching to fallback styles
          if (error.status === 401 || error.status === 403) {
            setUseMapboxStyles(false);
          }
        }}
        onStyleLoadError={handleStyleLoadError}
        transformRequest={(url, resourceType) => {
          // Log resource requests to debug issues
          if (resourceType === 'Source' && !url.includes('maptiler')) {
            console.log(`Loading map resource: ${resourceType} - ${url}`);
          }
          return { url };
        }}
        onLoad={onMapLoad}
      >
        {/* Custom Zoom Controls */}
        <MapboxZoomControls />
        
        {/* Movement Statistics Display */}
        {vehicles.length > 0 && (
          <div className="movement-stats">
            <div className="stat">
              <span>Total Vehicles:</span>
              <span className="value">{movementStats.totalVehicles}</span>
            </div>
            <div className="stat">
              <span>Moving Vehicles:</span>
              <span className="value highlight">{movementStats.movingVehicles}</span>
            </div>
            <div className="stat">
              <span>Movement %:</span>
              <span className={`value ${movementStats.movingVehicles > 0 ? 'highlight' : 'static'}`}>
                {movementStats.totalVehicles > 0 
                  ? Math.round((movementStats.movingVehicles / movementStats.totalVehicles) * 100) 
                  : 0}%
              </span>
            </div>
            <div className="stat">
              <span>Last Update:</span>
              <span className="value">
                {movementStats.lastUpdate 
                  ? movementStats.lastUpdate.toLocaleTimeString() 
                  : 'N/A'}
              </span>
            </div>
          </div>
        )}
        
        {/* Vehicle Tracking System */}
        {followedVehicle && (
          <ContinuousVehicleTracker 
            key="vehicle-tracker"
            followedVehicle={followedVehicle}
            isDrivingMode={isDrivingMode}
            setViewState={setViewState}
            currentViewState={viewState}
          />
        )}
        
        {/* Driving Mode Handler */}
        <DrivingModeHandler
          key="driving-mode-handler"
          isDrivingMode={isDrivingMode}
          followedVehicle={followedVehicle}
          viewState={viewState}
          setViewState={setViewState}
        />
        
        {/* Render Active Incidents */}
        {renderedIncidents}
        
        {/* Render Drawn Items */}
        {renderedDrawnItems}
        
        {/* Render Vehicles */}
        {renderedVehicles}
        
        {/* Render Ambulance Vehicles */}
        {renderedAmbulances}
        
        {/* Render temporary marker while placing */}
        {tempMarkerPosition && (
          <Marker
            longitude={tempMarkerPosition[0]}
            latitude={tempMarkerPosition[1]}
            anchor="bottom"
            color="#FF0000"
          >
            📍
          </Marker>
        )}
        
        {/* Render all saved markers */}
        {renderedMarkers}
        
        {/* Add attribution control */}
        <div style={{
          position: 'absolute',
          bottom: '5px',
          right: '5px',
          fontSize: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          padding: '2px 5px',
          borderRadius: '3px',
          zIndex: 1
        }}>
          © <a href="https://www.mapbox.com/about/maps/">Mapbox</a> | <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>
        </div>
      </Map>
      
      {/* Frosted Glass Overlay when vehicle search is open */}
      {showVehicleSearch && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 900,
            backgroundColor: darkMode ? 'rgba(10, 10, 10, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(8px) saturate(120%)',
            WebkitBackdropFilter: 'blur(8px) saturate(120%)',
            pointerEvents: 'auto', // Block clicks to force interaction with the vehicle search
            borderRadius: 0
          }}
          onClick={(e) => {
            // Prevent clicks from reaching the map
            e.preventDefault();
            e.stopPropagation();
            
            // Optional: Add a subtle visual or toast notification to guide the user
            toast.info("Please select a vehicle to continue", {
              position: "top-center", 
              autoClose: 2000,
              hideProgressBar: true
            });
          }}
        />
      )}
      
      {/* Show Active Incidents box when incidents are visible */}
      {showIncidents && activeIncidents.length > 0 && (
        <SearchAreaBox 
          incident={selectedIncident || activeIncidents[0]} // Show selected incident or first active incident
          darkMode={darkMode}
          onClose={() => setSelectedIncident(null)}
        />
      )}
        
      {/* Header with logo, controls, and user info all on one line */}
      <MapboxHeader 
        user={user} 
        darkMode={darkMode} 
        hideToggle={true}
        controls={
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }} className="mobile-button-container">
            {/* Special Resources Button (replacing Vehicle ID indicator) */}
            <button 
              className="mobile-button" 
              style={{
                backgroundColor: 'rgba(106, 76, 147, 0.9)', // Purple color for Special Resources
                color: 'white',
                border: 'none',
                borderRadius: '18px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
              }}
              onClick={handleSpecialResourcesClick}
            >
              <span style={{ marginRight: '5px' }}>🚨</span>
              <span className="button-text">Special Resources</span>
            </button>
            
            {/* Dark Mode Toggle */}
            <button 
              className="mobile-button"
              style={{
                backgroundColor: darkMode ? 'rgba(41, 117, 247, 0.9)' : 'rgba(80, 80, 80, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '18px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={toggleDarkMode}
            >
              <span style={{ marginRight: '3px', fontSize: '12px' }}>
                {darkMode ? '☀️' : '🌙'}
              </span>
              <span className="button-text">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            
            {/* Incidents Toggle Button */}
            <button 
              className="mobile-button"
              style={{
                backgroundColor: showIncidents ? 'rgba(41, 117, 247, 0.9)' : 'rgba(80, 80, 80, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '18px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
              }}
              onClick={() => setShowIncidents(prev => !prev)}
            >
              <span style={{ marginRight: '3px', fontSize: '12px' }}>
                {showIncidents ? '👁️' : '👁️‍🗨️'}
              </span>
              <span className="button-text">
                {showIncidents ? 'Hide Incidents' : 'Show Incidents'}
              </span>
              {activeIncidents.length > 0 && !showIncidents && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: 'red',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold'
                }}>
                  {activeIncidents.length}
                </span>
              )}
            </button>
            
            {/* Mark Location Button */}
            <button 
              className="mobile-button"
              style={{
                backgroundColor: isMarkingMode ? 'rgba(220, 53, 69, 0.8)' : 'rgba(80, 80, 80, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '18px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={isMarkingMode ? () => setIsMarkingMode(false) : handleCreateMarker}
            >
              <span style={{ marginRight: '3px', fontSize: '12px' }}>
                {isMarkingMode ? '✕' : '📍'}
              </span>
              <span className="button-text">{isMarkingMode ? 'Cancel' : 'Mark Location'}</span>
            </button>
            
            {/* Change Vehicle Button */}
            {!showVehicleSearch && followedVehicle && (
              <button 
                className="mobile-button"
                style={{
                  backgroundColor: 'rgba(41, 117, 247, 0.9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={showVehicleSearchDropdown}
              >
                <span style={{ marginRight: '3px', fontSize: '12px' }}>🔄</span>
                <span className="button-text">Change Vehicle</span>
              </button>
            )}
            
            {/* Desktop Mode Button */}
            <button 
              className="mobile-button"
              style={{
                backgroundColor: 'rgba(80, 80, 80, 0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '18px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={toggleMobileMode}
            >
              <span style={{ marginRight: '3px', fontSize: '12px' }}>🖥️</span>
              <span className="button-text">Desktop</span>
            </button>
          </div>
        }
      />
      
      {/* Add CSS for responsive button text */}
      <style>
        {`
          @media (max-width: 900px) {
            .button-text {
              display: none;
            }
            .mobile-button {
              padding: 5px !important;
            }
          }
          
          /* Add animation for pulse effect */
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(41, 117, 247, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(41, 117, 247, 0); }
            100% { box-shadow: 0 0 0 0 rgba(41, 117, 247, 0); }
          }
        `}
      </style>
      
      {/* Vehicle search dropdown - position adjusted */}
      {showVehicleSearch && (
        <div style={{
          position: 'absolute',
          top: '60px', // Position below the single header bar (50px + 10px margin)
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '400px',
          zIndex: 1000,
          backgroundColor: darkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          padding: '15px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              textAlign: 'center',
              color: darkMode ? 'white' : 'black',
              flex: 1
            }}>
              Select a vehicle to follow
            </div>
          </div>
          
          {vehicles.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '15px',
              color: darkMode ? '#ccc' : '#666',
              fontSize: '14px'
            }}>
              <p>Welcome to Mobile Map View</p>
              <p>Waiting for vehicle data to load...</p>
              <p>Once loaded, you can choose a vehicle to follow.</p>
            </div>
          ) : (
            <>
              <div className="map-vehicle-search-wrapper">
                <MapboxVehicleSearch 
                  vehicles={vehicles} 
                  onVehicleSelect={handleVehicleFollow}
                />
              </div>
              <div style={{
                fontSize: '12px',
                color: darkMode ? '#aaa' : '#666',
                marginTop: '10px',
                textAlign: 'center'
              }}>
                Select a vehicle to continue
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Initial instruction message when no vehicle is selected */}
      {showVehicleSearch && !followedVehicle && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(41, 117, 247, 0.9)',
          color: 'white',
          padding: '15px 25px',
          borderRadius: '20px',
          fontWeight: 'bold',
          fontSize: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          zIndex: 901, // Above the frosted glass but below the vehicle search
          pointerEvents: 'none',
          textAlign: 'center',
          maxWidth: '80%'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>👆</div>
          Select a vehicle above to start tracking
        </div>
      )}
      
      {/* Status bar in the middle - adjust its position to not overlap with top bar */}
      <MapboxStatusBar 
        followedVehicle={followedVehicle} 
        geocodedLocation={geocodedLocation}
        isGeocoding={isGeocoding}
      />
      
      {/* Marker naming modal */}
      <MapboxMarkerNameModal
        show={showNameModal}
        onClose={() => {
          setShowNameModal(false);
          setTempMarkerPosition(null);
        }}
        onSave={handleSaveMarker}
      />
      
      {/* Visual indicator when in marking mode */}
      {isMarkingMode && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(220, 53, 69, 0.8)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '20px',
          fontWeight: 'bold',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          Tap on the map to place marker
        </div>
      )}
      
      {/* Add API Control component for admin users */}
      {user && user.role === 'admin' && (
        <ApiControl position="bottom-right" />
      )}
      
      {/* Special Resources Modal */}
      <SpecialResourcesModal 
        show={showSpecialResourcesModal}
        onClose={() => setShowSpecialResourcesModal(false)}
        user={{
          userId: user?.userId || user?.id,
          userEmail: user?.userEmail || user?.email,
          userName: user?.userName || user?.name,
          department: user?.department
        }}
      />
    </div>
  );
};

export default MapboxMobileMap; 