import React, { useEffect, useRef } from 'react';

// Simplified Driving Mode Handler - controls the map view in driving mode
const DrivingModeHandler = ({ isDrivingMode, followedVehicle, viewState, setViewState }) => {
  const updateIntervalRef = useRef(null);
  const lastLogTimeRef = useRef(0);
  const drivingModeRef = useRef(isDrivingMode);
  const vehicleRef = useRef(followedVehicle);
  const lastZoomRef = useRef(viewState?.zoom || 16);
  
  // Update refs when props change to avoid dependency in the effect
  useEffect(() => {
    drivingModeRef.current = isDrivingMode;
    vehicleRef.current = followedVehicle;
    
    // Log current state for debugging
    console.log("DrivingModeHandler: State update received");
    console.log("- isDrivingMode:", isDrivingMode);
    console.log("- viewState zoom:", viewState?.zoom);
    console.log("- lastZoom:", lastZoomRef.current);
    
    // Keep track of zoom level
    if (viewState?.zoom) {
      // Check if zoom has changed
      if (lastZoomRef.current !== viewState.zoom) {
        console.log("DrivingModeHandler: Zoom changed from", lastZoomRef.current, "to", viewState.zoom);
        lastZoomRef.current = viewState.zoom;
      }
    }
    
    // Handle enabling/disabling of driving mode
    if (isDrivingMode && !updateIntervalRef.current && followedVehicle) {
      console.log("DrivingModeHandler: Enabling driving mode for vehicle:", followedVehicle.displayName);
      setupTracking();
    } else if (!isDrivingMode && updateIntervalRef.current) {
      console.log("DrivingModeHandler: Disabling driving mode tracking");
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, [isDrivingMode, followedVehicle, viewState]);
  
  // Function to set up the tracking interval
  const setupTracking = () => {
    // Function to update the map position
    const updateMapPosition = () => {
      const currentVehicle = vehicleRef.current;
      const isDrivingModeActive = drivingModeRef.current;
      
      if (!isDrivingModeActive || !currentVehicle || !currentVehicle.latitude || !currentVehicle.longitude) return;
      
      const now = Date.now();
      if (now - lastLogTimeRef.current > 1000) {
        console.log("DrivingModeHandler: Updating map position with vehicle heading:", currentVehicle.heading);
        console.log("DrivingModeHandler: Current zoom level:", lastZoomRef.current);
        lastLogTimeRef.current = now;
      }
      
      // IMPORTANT: Get the current zoom from the state or map
      // This ensures we preserve user's zoom level and don't reset it
      const currentZoom = lastZoomRef.current;
      
      // Simply update the view state to match the vehicle's position and heading
      // but KEEP the current zoom level
      setViewState(prev => {
        // Only update if there's an actual change to avoid infinite loops
        if (prev.longitude !== currentVehicle.longitude || 
            prev.latitude !== currentVehicle.latitude || 
            prev.bearing !== (currentVehicle.heading || 0)) {
          
          return {
            longitude: currentVehicle.longitude,
            latitude: currentVehicle.latitude,
            bearing: currentVehicle.heading || 0,
            zoom: currentZoom, // Preserve current zoom level
            pitch: 0, // Keep a flat 2D view 
            transitionDuration: 300,
          };
        }
        return prev; // No change needed
      });
    };
    
    // Run once immediately
    updateMapPosition();
    
    // Set up interval for continuous updates
    updateIntervalRef.current = setInterval(updateMapPosition, 300);
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        console.log("DrivingModeHandler: Cleaning up interval on unmount");
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, []);
  
  return null; // This component doesn't render anything visible
};

export default DrivingModeHandler; 