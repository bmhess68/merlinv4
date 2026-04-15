/**
 * Creates a view state change handler that enforces minimum zoom level
 * @param {function} setViewState - State setter for view state
 * @param {Object} followedVehicle - Currently followed vehicle if any
 * @param {number} minZoom - Minimum zoom level to enforce
 * @returns {function} The event handler function
 */
export const createViewStateChangeHandler = (setViewState, followedVehicle, minZoom = 15) => {
  return (evt) => {
    // Only update view state from user interactions (originalEvent present)
    // or when not following a vehicle
    if (evt.originalEvent) {
      // If user is manually interacting with the map, enforce minimum zoom
      const newViewState = {
        ...evt.viewState,
        zoom: Math.max(evt.viewState.zoom, minZoom)
      };
      
      setViewState(newViewState);
    } else if (!followedVehicle) {
      // Not following a vehicle, so update normally for programmatic changes
      // but still enforce minimum zoom
      const newViewState = {
        ...evt.viewState,
        zoom: Math.max(evt.viewState.zoom, minZoom)
      };
      
      setViewState(newViewState);
    }
    // If following a vehicle and not a manual interaction, let vehicle tracker handle it
  };
};

/**
 * Creates a map click handler for placing markers
 * @param {boolean} isMarkingMode - Whether marking mode is active
 * @param {function} setTempMarkerPosition - State setter for temporary marker position
 * @param {function} setShowNameModal - State setter for name modal visibility
 * @param {function} setIsMarkingMode - State setter for marking mode
 * @returns {function} The event handler function
 */
export const createMapClickHandler = (isMarkingMode, setTempMarkerPosition, setShowNameModal, setIsMarkingMode) => {
  return (event) => {
    if (isMarkingMode) {
      setTempMarkerPosition([event.lngLat.lng, event.lngLat.lat]);
      setShowNameModal(true);
      setIsMarkingMode(false);
    }
  };
};

/**
 * Creates a map load handler that sets up necessary configurations
 * @param {function} setViewState - State setter for view state
 * @param {Object} mapRef - Reference to the map object
 * @returns {function} The event handler function
 */
export const createMapLoadHandler = (setViewState, mapRef) => {
  return (event) => {
    const map = event.target;
    console.log('MapboxMobileMap: Map loaded');
    console.log('- Initial zoom level:', map.getZoom());
    console.log('- Min zoom:', map.getMinZoom());
    console.log('- Max zoom:', map.getMaxZoom());
    
    // Set minimum zoom level to 15
    map.setMinZoom(15);
    
    // Ensure zoom controls are enabled
    if (map.scrollZoom.isEnabled() === false) {
      console.log('MapboxMobileMap: Enabling scroll zoom on load');
      map.scrollZoom.enable();
    }
    
    if (map.doubleClickZoom.isEnabled() === false) {
      console.log('MapboxMobileMap: Enabling double click zoom on load');
      map.doubleClickZoom.enable();
    }
    
    if (map.touchZoomRotate.isEnabled() === false) {
      console.log('MapboxMobileMap: Enabling touch zoom on load');
      map.touchZoomRotate.enable();
    }
    
    // Add listeners for zoom events
    map.on('zoom', () => {
      console.log('MapboxMobileMap: Zoom event detected, current level:', map.getZoom());
    });
    
    map.on('zoomstart', () => {
      console.log('MapboxMobileMap: Zoom operation starting, level:', map.getZoom());
    });
    
    map.on('zoomend', () => {
      console.log('MapboxMobileMap: Zoom operation completed, final level:', map.getZoom());
      // Update view state to match actual map zoom
      setViewState(prev => ({
        ...prev,
        zoom: map.getZoom()
      }));
    });
    
    // Store the map reference more explicitly
    mapRef.current = event.target;
  };
}; 