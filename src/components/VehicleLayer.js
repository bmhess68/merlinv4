import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import { icons } from './utils';
import L from 'leaflet';
import 'leaflet-rotatedmarker';
import { PERMISSIONS, hasPermission } from '../utils/permissions';
import axios from 'axios';

const determineIconType = (displayName, isFireVehicle = false) => {
    // Add null check for displayName
    if (!displayName) return 'policeCar';
    
    if (isFireVehicle) {
        if (displayName.includes('Tanker')) {
            return 'tanker';
        } else if (displayName.includes('Ladder')) {
            return 'ladder';
        } else if (displayName.includes('Rescue')) {
            return 'rescue'; // Use specific rescue icon
        } else if (displayName.includes('EMS') || displayName.includes('BLS') || displayName.includes('ALS')) {
            return 'ambulance';
        } else {
            return 'engine';
        }
    }

    if (displayName.includes('Det') || 
        displayName.includes('Detective') || 
        displayName.includes('Inv') || 
        displayName.includes('Investigator') || 
        displayName.includes('Narco') || 
        displayName.includes('SIU') || 
        displayName.includes('FBI') || 
        displayName.includes('Auto Larceny')) {
        return 'detcar';
    } else if (displayName.includes('K9')) {
        return 'k9';
    } else if (displayName.includes('Marine')) {
        return 'boat';
    } else if (displayName.includes('Aviation')) {
        return 'helicopter';
    } else if (displayName.includes('47 PCT CO')) {
        return 'rav4';
    } else if (displayName.includes('ESU')) {
        return 'esu';
    } else if (displayName.includes('EMS')) {
        return 'ambulance';
    } else if (displayName.includes('NYPD')) {
        return 'nypd';
    } else if (displayName.includes('WCPD')) {
        return 'wcpd';
    } else if (displayName.includes('NYSP')) {
        return 'nysp';
    } else if (displayName.includes('CTSP') || 
              displayName.includes('Greenwich') || 
              displayName.includes('Stamford')) {
        return 'ctsp';
    } else {
        return 'policeCar';
    }
};

const determineTooltipClass = (displayName, isFireVehicle) => {
    // Add null check for displayName
    if (!displayName) return 'custom-tooltip police-tooltip';
    
    if (isFireVehicle) {
        if (displayName.includes('EMS') || displayName.includes('BLS') || displayName.includes('ALS') || displayName.includes('Medic')) {
            return 'custom-tooltip ems-tooltip';
        }
        return 'custom-tooltip fire-tooltip';
    }
    if (displayName.includes('EMS') || displayName.includes('BLS') || displayName.includes('ALS') || displayName.includes('Medic')) {
        return 'custom-tooltip ems-tooltip';
    }
    return 'custom-tooltip police-tooltip';
};

const VehicleLayer = ({ 
    setVehicles, 
    showPoliceGPS, 
    showFireGPS, 
    showTooltips, 
    tooltipFontSize, 
    mobileMode = false, 
    followedVehicle = null, 
    setFollowedVehicle = () => {}, 
    overridePermissions = false, 
    user: propUser,
    drivingMode = false
}) => {
    const map = useMap();
    const [userState, setUserState] = useState({ permissions: {} });
    const [policeVehicles, setPoliceVehicles] = useState([]);
    const [fireVehicles, setFireVehicles] = useState([]);
    const markersRef = useRef({});
    const sourcesRef = useRef({ police: null, fire: null });
    const eventListenersRef = useRef({});
    const previousPositionRef = useRef(null);
    const omsRef = useRef(null);
    const prevZoomRef = useRef(null);
    const tooltipStateRef = useRef(new Set());

    // Parse userData once and memoize it
    const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
    const userData = useMemo(() => {
        const userParam = urlParams.get('user');
        if (userParam) {
            return JSON.parse(decodeURIComponent(userParam));
        }
        return {};
    }, [urlParams]);

    useEffect(() => {
        const fetchUserPermissions = async () => {
            try {
                const response = await axios.get('https://merlin.westchesterrtc.com/api/user/permissions', {
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Email': userData.userEmail,
                    },
                });

                setUserState((prevUser) => {
                    const newUser = {
                        ...userData,
                        permissions: response.data.permissions,
                    };
                    // Only update if different
                    if (JSON.stringify(prevUser) !== JSON.stringify(newUser)) {
                        return newUser;
                    } else {
                        return prevUser;
                    }
                });
            } catch (error) {
                console.error('Failed to fetch user permissions:', error);
                setUserState({ permissions: {} });
            }
        };

        fetchUserPermissions();
    }, [userData]);
    

    const connectSSE = useCallback((type) => {
        if (!userData || !userData.userEmail) {
            console.error(`Cannot connect to ${type} SSE: No user data available`);
            return;
        }
        
        // Check if user has required permission
        const hasPermission = type === 'police' 
            ? (userData.permissions?.policeGPS || userData.permissions?.admin)
            : (userData.permissions?.fireGPS || userData.permissions?.admin);
        
        // If no permission and not overriding, don't connect
        if (!hasPermission && !overridePermissions) {
            return;
        }
        
        const endpoint = type === 'police' ? 'vehicles' : 'fireVehicles';
        
        // Add the mobileMode parameter when overridePermissions is true
        const url = `https://merlin.westchesterrtc.com/sse/${endpoint}?userEmail=${encodeURIComponent(userData.userEmail)}${overridePermissions ? '&mobileMode=true' : ''}`;
        
        try {
            sourcesRef.current[type] = new EventSource(url, { withCredentials: true });
            
            sourcesRef.current[type].onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.features) {
                        if (type === 'police') {
                            setPoliceVehicles(data.features);
                        } else {
                            setFireVehicles(data.features);
                        }
                    }
                } catch (e) {
                    console.error(`Error parsing ${type} SSE data:`, e);
                }
            };
            
            sourcesRef.current[type].onerror = (event) => {
                console.error(`${type} SSE connection error:`, event);
            };
        } catch (error) {
            console.error(`Error setting up ${type} SSE connection:`, error);
        }
    }, [userData, overridePermissions]);

    const cleanupSSEConnection = useCallback((type) => {
        if (sourcesRef.current[type]) {
            try {
                if (eventListenersRef.current[type]) {
                    sourcesRef.current[type].removeEventListener('message', eventListenersRef.current[type].onMessage);
                    sourcesRef.current[type].removeEventListener('error', eventListenersRef.current[type].onError);
                    eventListenersRef.current[type] = null;
                }
                sourcesRef.current[type].close();
                sourcesRef.current[type] = null;
            } catch (error) {
                console.error(`Error cleaning up ${type} SSE connection:`, error);
            }
        }
    }, []);

    useEffect(() => {
        console.log('VehicleLayer mounted with overridePermissions:', overridePermissions);
        console.log('Initial propUser:', propUser);
        console.log('showPoliceGPS:', showPoliceGPS);
        console.log('showFireGPS:', showFireGPS);
        console.log('mobileMode:', mobileMode);
        
        // Use propUser if provided, otherwise fall back to userState
        const userToCheck = propUser || userState;
        
        console.log('Setting up SSE connections with user:', userToCheck);
        console.log('User permissions:', userToCheck.permissions);
        console.log('Override permissions:', overridePermissions);
        
        if (userToCheck.permissions && Object.keys(userToCheck.permissions).length > 0 || overridePermissions) {
            console.log('User has permissions or override is enabled, connecting to SSE');
            const connectToSSE = () => {
                if (showPoliceGPS) {
                    console.log('Connecting to police SSE');
                    connectSSE('police');
                } else {
                    console.log('Not connecting to police SSE, showPoliceGPS is false');
                    // Cleanup police SSE connection
                    cleanupSSEConnection('police');
                    setPoliceVehicles([]);
                }

                if (showFireGPS) {
                    console.log('Connecting to fire SSE');
                    connectSSE('fire');
                } else {
                    console.log('Not connecting to fire SSE, showFireGPS is false');
                    // Cleanup fire SSE connection
                    cleanupSSEConnection('fire');
                    setFireVehicles([]);
                }
            };

            connectToSSE();

            return () => {
                console.log('Cleaning up SSE connections');
                // Cleanup SSE connections
                cleanupSSEConnection('police');
                cleanupSSEConnection('fire');
            };
        } else {
            console.log('User has no permissions and override is disabled, not connecting to SSE');
        }
    }, [propUser, userState.permissions, showPoliceGPS, showFireGPS, connectSSE, cleanupSSEConnection, overridePermissions]);

    const handleMarkerOverlap = useCallback((markers) => {
        markers.forEach(marker => {
            const tooltip = marker.getTooltip();
            if (tooltip) {
                tooltip.options.permanent = true;
                tooltip.options.opacity = 1;
                
                const tooltipElement = tooltip.getElement();
                if (tooltipElement) {
                    tooltipElement.style.cssText = `
                        font-size: ${tooltipFontSize}px !important;
                        padding: 2px 4px !important;
                        white-space: nowrap !important;
                        width: auto !important;
                        opacity: 1 !important;
                        display: block !important;
                        visibility: visible !important;
                    `;
                    marker.openTooltip();
                }
            }
        });
    }, [tooltipFontSize]);

    useEffect(() => {
        if (!followedVehicle) return;
        
        //console.log('Setting up continuous vehicle tracking for:', 
        //    typeof followedVehicle === 'object' ? 
        //        (followedVehicle.displayName || 
        //         (followedVehicle.properties && followedVehicle.properties.displayName)) : 
        //        followedVehicle);
        
        // Function to update the map position based on vehicle movement
        const updatePosition = () => {
            const allVehicles = [...policeVehicles, ...fireVehicles];
            let targetVehicle;
            
            // Find the vehicle we're following (handle different formats)
            if (typeof followedVehicle === 'string') {
                // Find by name
                targetVehicle = allVehicles.find(v => {
                    if (v.type === 'Feature') {
                        return v.properties && v.properties.displayName === followedVehicle;
                    }
                    return v.displayName === followedVehicle;
                });
            } else if (followedVehicle && followedVehicle.displayName) {
                // Find by displayName property
                targetVehicle = allVehicles.find(v => {
                    if (v.type === 'Feature') {
                        return v.properties && v.properties.displayName === followedVehicle.displayName;
                    }
                    return v.displayName === followedVehicle.displayName;
                });
            } else if (followedVehicle && followedVehicle.type === 'Feature') {
                // Already a GeoJSON Feature
                targetVehicle = followedVehicle;
            }
            
            // Extract coordinates based on vehicle format
            let latitude, longitude, heading;
            
            if (targetVehicle) {
                if (targetVehicle.type === 'Feature') {
                    // GeoJSON format
                    if (targetVehicle.geometry && targetVehicle.geometry.coordinates) {
                        longitude = targetVehicle.geometry.coordinates[0];
                        latitude = targetVehicle.geometry.coordinates[1];
                        heading = targetVehicle.properties?.heading || 0;
                    }
                } else {
                    // Direct format
                    latitude = targetVehicle.latitude;
                    longitude = targetVehicle.longitude;
                    heading = targetVehicle.heading || 0;
                }
            }
            
            if (latitude !== undefined && longitude !== undefined) {
                const newPosition = [latitude, longitude];
                
                // Only update if position has changed
                if (!previousPositionRef.current || 
                    previousPositionRef.current[0] !== newPosition[0] || 
                    previousPositionRef.current[1] !== newPosition[1]) {
                    
                    console.log('Updating map to follow vehicle:', 
                        targetVehicle.type === 'Feature' ? 
                            targetVehicle.properties.displayName : 
                            targetVehicle.displayName);
                    
                    // Center the map on the vehicle's new position
                    map.panTo(newPosition, { animate: true, duration: 0.5 });
                    previousPositionRef.current = newPosition;
                    
                    // Update the followed vehicle state with the latest coordinates
                    if (typeof setFollowedVehicle === 'function' && typeof followedVehicle === 'object') {
                        setFollowedVehicle(prev => ({
                            ...prev,
                            latitude: latitude,
                            longitude: longitude,
                            heading: heading
                        }));
                    }
                }
            }
        };
        
        // Set up an interval to continuously track the vehicle (every 500ms)
        const intervalId = setInterval(updatePosition, 500);
        
        // Run once immediately
        updatePosition();
        
        // Clean up interval when component unmounts or vehicle changes
        return () => clearInterval(intervalId);
    }, [followedVehicle, policeVehicles, fireVehicles, map, setFollowedVehicle]);

    useEffect(() => {
        // Force update of all markers when font size changes
        const rafId = requestAnimationFrame(() => {
            const allMarkers = Object.values(markersRef.current);
            handleMarkerOverlap(allMarkers);
        });

        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [tooltipFontSize, handleMarkerOverlap]);

    useEffect(() => {
        if (!map) return;

        const handleZoom = debounce(() => {
            requestAnimationFrame(() => {
                const allMarkers = Object.values(markersRef.current);
                handleMarkerOverlap(allMarkers);
            });
        }, 150);

        map.on('zoomend', handleZoom);
        
        const initialZoom = map.getZoom();
        prevZoomRef.current = initialZoom;
        handleZoom();
        
        return () => {
            map.off('zoomend', handleZoom);
            handleZoom.cancel();
        };
    }, [map, handleMarkerOverlap]);

    const debounce = (func, wait) => {
        let timeout;
        let lastArgs;
        let lastThis;
        let result;
        let timerId;

        const later = () => {
            timerId = null;
            result = func.apply(lastThis, lastArgs);
        };

        const debounced = function(...args) {
            lastArgs = args;
            lastThis = this;

            clearTimeout(timerId);
            timerId = setTimeout(later, wait);

            return result;
        };

        debounced.cancel = () => {
            clearTimeout(timerId);
            timerId = null;
        };

        return debounced;
    };

    // Define icons at the component level
    const icons = {
        policeCar: L.icon({
            iconUrl: '/images/icons/policecar/policeCar0.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        detcar: L.icon({
            iconUrl: '/images/icons/detcar.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        k9: L.icon({
            iconUrl: '/images/icons/k9/k90.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        boat: L.icon({
            iconUrl: '/images/icons/marine/boat0.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        helicopter: L.icon({
            iconUrl: '/images/icons/helicopter/helicopter0.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        rav4: L.icon({
            iconUrl: '/images/icons/rav4.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        esu: L.icon({
            iconUrl: '/images/icons/esu/esu0.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        ambulance: L.icon({
            iconUrl: '/images/icons/ambulance.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        engine: L.icon({
            iconUrl: '/images/icons/engine.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        ladder: L.icon({
            iconUrl: '/images/icons/ladder.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        tanker: L.icon({
            iconUrl: '/images/icons/tanker.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        rescue: L.icon({
            iconUrl: '/images/icons/rescue.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        nypd: L.icon({
            iconUrl: '/images/icons/nypdcar.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        wcpd: L.icon({
            iconUrl: '/images/icons/wcpd.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        nysp: L.icon({
            iconUrl: '/images/icons/nyspcar.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        ctsp: L.icon({
            iconUrl: '/images/icons/ctsp.svg',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    };

    // Create a special icon for the followed vehicle when in driving mode
    const createFollowedVehicleIcon = (baseIconType, heading) => {
        // We create a custom icon with larger size and possibly a different image for the followed vehicle
        const iconUrl = icons[baseIconType]?.options?.iconUrl || '/images/icons/policeCar.svg';
        
        return L.icon({
            iconUrl,
            iconSize: drivingMode ? [48, 48] : [32, 32], // Larger in driving mode
            iconAnchor: drivingMode ? [24, 24] : [16, 16]
        });
    };

    // Update getIconForDevice to handle followed vehicle differently
    const getIconForDevice = (vehicle) => {
        const iconType = determineIconType(vehicle.displayName, vehicle.isFireVehicle);
        
        // If this is the followed vehicle and we're in driving mode, use the special icon
        if (drivingMode && isFollowedVehicle(vehicle.displayName)) {
            return createFollowedVehicleIcon(iconType, vehicle.heading);
        }
        
        return icons[iconType] || icons.policeCar;
    };

    // Define handleMarkerClick as a regular function
    function handleMarkerClick(marker, displayName, latlng) {
        // Get coordinates directly from the marker
        const markerPosition = marker.getLatLng();
        const latitude = markerPosition.lat;
        const longitude = markerPosition.lng;
        const heading = marker.options.rotationAngle || 0;
        
        console.log('Marker position:', markerPosition);
        console.log('Extracted coordinates:', { latitude, longitude, heading });
        
        // Create a full vehicle object with coordinates
        const vehicleObject = {
            displayName: displayName,
            latitude: latitude,
            longitude: longitude,
            heading: heading
        };
        
        // Pass the complete object to setFollowedVehicle
        setFollowedVehicle(vehicleObject);
    }

    // Helper function to check if this vehicle is being followed
    const isFollowedVehicle = (name) => {
        if (!followedVehicle) return false;
        
        if (typeof followedVehicle === 'string') {
            return followedVehicle === name;
        } else if (followedVehicle.displayName) {
            return followedVehicle.displayName === name;
        } else if (followedVehicle.type === 'Feature' && followedVehicle.properties) {
            return followedVehicle.properties.displayName === name || 
                   followedVehicle.properties.name === name;
        }
        return false;
    };

    const updateMarkers = useCallback(() => {
        const allVehicles = [...policeVehicles, ...fireVehicles];
        
        allVehicles.forEach(vehicle => {
            // Determine if this is a fire vehicle based on which array it comes from
            const isFromFireArray = fireVehicles.includes(vehicle);
            
            // Handle GeoJSON Feature objects
            if (vehicle.type === 'Feature') {
                // Extract properties and geometry from the GeoJSON Feature
                const properties = vehicle.properties || {};
                const geometry = vehicle.geometry || {};
                
                // Skip if no geometry or properties
                if (!geometry || !geometry.coordinates || !properties) {
                    return;
                }
                
                // Extract coordinates from GeoJSON (note: GeoJSON uses [longitude, latitude] order)
                const longitude = geometry.coordinates[0];
                const latitude = geometry.coordinates[1];
                
                // Extract displayName from properties
                const displayName = properties.displayName || properties.name || properties.id;
                
                if (!displayName) {
                    return;
                }
                
                // Extract heading from properties
                const heading = properties.heading || properties.rotation || 0;
                
                // Create a simplified vehicle object with the extracted data
                // Set isFireVehicle based on the source array or properties
                const processedVehicle = {
                    displayName,
                    latitude,
                    longitude,
                    heading,
                    isFireVehicle: isFromFireArray || properties.isFireVehicle || false
                };
                
                // Now process this vehicle
                processVehicle(processedVehicle);
            } else {
                // Handle direct vehicle objects (original format)
                if (!vehicle || !vehicle.displayName) {
                    return;
                }
                
                if (vehicle.latitude === undefined || vehicle.longitude === undefined) {
                    return;
                }
                
                // Set isFireVehicle based on the source array if not already set
                const vehicleWithFireFlag = {
                    ...vehicle,
                    isFireVehicle: isFromFireArray || vehicle.isFireVehicle || false
                };
                
                // Process the vehicle directly
                processVehicle(vehicleWithFireFlag);
            }
        });

        // Clean up removed markers
        Object.keys(markersRef.current).forEach(id => {
            if (!allVehicles.some(v => {
                // Check both formats
                return (v.displayName === id) || 
                       (v.type === 'Feature' && v.properties && v.properties.displayName === id);
            })) {
                map.removeLayer(markersRef.current[id]);
                delete markersRef.current[id];
            }
        });
        
        // Update processVehicle function to enhance driving mode appearance
        function processVehicle(vehicle) {
            const { displayName, latitude, longitude, heading, isFireVehicle } = vehicle;
            const latlng = [latitude, longitude];
            let marker = markersRef.current[displayName];
            
            try {
                if (marker && marker._map) {
                    marker.setLatLng(latlng);
                    
                    // Apply special styling for followed vehicle in driving mode
                    const isCurrentlyFollowed = isFollowedVehicle(displayName);
                    marker.setIcon(getIconForDevice(vehicle));
                    
                    // Always set rotation angle based on heading
                    marker.setRotationAngle(heading || 0);
                    
                    // Update z-index to ensure followed vehicle is on top in driving mode
                    if (drivingMode && isCurrentlyFollowed) {
                        if (marker._icon) {
                            marker._icon.style.zIndex = 1000; // Higher z-index
                        }
                    }
                    
                    // Re-bind click handler
                    marker.off('click');
                    marker.on('click', () => handleMarkerClick(marker, displayName, latlng));
                    
                    if (showTooltips) {
                        // Updated tooltip handling
                        const tooltipContent = isCurrentlyFollowed 
                            ? `${displayName} ${drivingMode ? '' : '(Following)'}`
                            : displayName;
                        
                        if (!marker.getTooltip()) {
                            // Create a new tooltip
                            marker.bindTooltip(tooltipContent, {
                                permanent: true,
                                direction: 'top',
                                className: `${determineTooltipClass(displayName, isFireVehicle)} ${isCurrentlyFollowed ? 'vehicle-following-indicator' : ''}`,
                                offset: [0, drivingMode && isCurrentlyFollowed ? -30 : -20]
                            });
                            
                            // Update the tooltip font size immediately after creation
                            const tooltipElement = marker.getTooltip().getElement();
                            if (tooltipElement) {
                                tooltipElement.style.cssText = `
                                    font-size: ${isCurrentlyFollowed ? tooltipFontSize + 2 : tooltipFontSize}px !important;
                                    padding: 2px 4px !important;
                                    white-space: nowrap !important;
                                    width: auto !important;
                                    opacity: 1 !important;
                                    display: block !important;
                                    visibility: visible !important;
                                `;
                            }
                        } else {
                            // Update existing tooltip content if following status changed
                            marker.getTooltip().setContent(tooltipContent);
                            
                            // Update tooltip class and style if needed
                            const tooltipElement = marker.getTooltip().getElement();
                            if (tooltipElement) {
                                if (isCurrentlyFollowed) {
                                    // Add vehicle-following-indicator class for dark theme styling
                                    tooltipElement.className = tooltipElement.className.replace(/(tooltip-\w+)/g, '$1 vehicle-following-indicator');
                                    tooltipElement.style.fontSize = `${tooltipFontSize + 2}px`;
                                    tooltipElement.style.fontWeight = 'bold';
                                } else {
                                    // Remove special styling if no longer followed
                                    tooltipElement.className = tooltipElement.className.replace(/\s*vehicle-following-indicator/g, '');
                                    tooltipElement.style.fontSize = `${tooltipFontSize}px`;
                                    tooltipElement.style.fontWeight = '';
                                }
                            }
                        }
                    } else {
                        if (marker.getTooltip()) {
                            marker.unbindTooltip();
                        }
                    }
                } else {
                    if (marker) {
                        map.removeLayer(marker);
                    }
                    
                    marker = L.marker(latlng, {
                        icon: getIconForDevice(vehicle),
                        rotationAngle: heading || 0,
                        rotationOrigin: 'center center'
                    }).addTo(map);

                    // Bind click handler
                    marker.on('click', () => handleMarkerClick(marker, displayName, latlng));

                    if (showTooltips) {
                        marker.bindTooltip(displayName, {
                            permanent: true,
                            direction: 'top',
                            className: determineTooltipClass(displayName, isFireVehicle),
                        });
                        
                        if (followedVehicle === displayName) {
                            marker.getTooltip().setContent(`${displayName} (Following)`);
                        }
                    }
                    
                    markersRef.current[displayName] = marker;
                }
            } catch (error) {
                console.error('Error updating/creating marker:', error);
            }
        }
    }, [policeVehicles, fireVehicles, map, showTooltips, tooltipFontSize, followedVehicle, drivingMode]);

    useEffect(() => {
        if (map && (policeVehicles.length > 0 || fireVehicles.length > 0)) {
            updateMarkers();
        }
    }, [map, policeVehicles, fireVehicles, updateMarkers]);

    useEffect(() => {
        const allVehicles = [...policeVehicles, ...fireVehicles];
        setVehicles({
            police: policeVehicles,
            fire: fireVehicles,
            all: allVehicles,
        });
    }, [policeVehicles, fireVehicles, setVehicles]);

    const resetFollowing = () => {
        if (followedVehicle) {
            const marker = markersRef.current[followedVehicle];
            if (marker) {
                marker.getTooltip().setContent(followedVehicle);
            }
            if (typeof setFollowedVehicle === 'function') {
                setFollowedVehicle(null);
            }
            map.dragging.enable();
        }
    };

    useEffect(() => {
        if (map) {
            map.resetVehicleFollowing = resetFollowing;
        }
        return () => {
            if (map) {
                delete map.resetVehicleFollowing;
            }
        };
    }, [map, followedVehicle]);

    const createMarker = useCallback((displayName, latlng, icon, heading, isFireVehicle) => {
        if (markersRef.current[displayName]?.tooltip) {
            markersRef.current[displayName].tooltip.dispose();
        }
        
        const marker = L.marker(latlng, {
            icon: icon,
            rotationAngle: heading,
            rotationOrigin: 'center center',
            zIndexOffset: 1000,
        });
        
        if (showTooltips) {
            marker.bindTooltip(displayName, {
                permanent: true,
                direction: 'top',
                className: determineTooltipClass(displayName, isFireVehicle),
                opacity: 0.9
            });
        }
        
        return marker;
    }, [showTooltips]);

    useEffect(() => {
        return () => {
            Object.keys(markersRef.current).forEach((displayName) => {
                const marker = markersRef.current[displayName];
                if (marker && marker._map) {
                    marker.off('click');
                    marker.unbindTooltip();
                    map.removeLayer(marker);
                }
            });
            markersRef.current = {};

            cleanupSSEConnection('police');
            cleanupSSEConnection('fire');

            if (typeof setFollowedVehicle === 'function') {
                setFollowedVehicle(null);
            }
            previousPositionRef.current = null;
            prevZoomRef.current = null;
            tooltipStateRef.current = new Set();

            if (map) {
                map.dragging.enable();
                map.touchZoom.enable();
                map.doubleClickZoom.enable();
                map.scrollWheelZoom.enable();
                map.boxZoom.enable();
                map.keyboard.enable();
            }

            console.log('VehicleLayer unmounted');
        };
    }, [map, cleanupSSEConnection]);

    useEffect(() => {
        // Add special handling for mobile mode
        if (mobileMode && followedVehicle) {
            const marker = markersRef.current[followedVehicle.id];
            if (marker) {
                // Center map on followed vehicle
                map.setView([followedVehicle.latitude, followedVehicle.longitude], 18);
                
                // Add visual indication for followed vehicle
                if (marker._icon) {
                    marker._icon.classList.add('followed-vehicle');
                }
            }
        }
    }, [policeVehicles, fireVehicles, showTooltips, tooltipFontSize, mobileMode, followedVehicle, map]);

    return null;
};

export default VehicleLayer;
