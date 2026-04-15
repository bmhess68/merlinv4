import React, { useEffect, useRef } from 'react';

// Start the ContinuousVehicleTracker component
const ContinuousVehicleTracker = ({ followedVehicle, isDrivingMode, setViewState, currentViewState }) => {
  const lastUpdateRef = useRef(null);
  const intervalRef = useRef(null);
  const vehicleRef = useRef(followedVehicle);
  const lastPositionRef = useRef(null);

  // Update ref when followedVehicle changes to avoid dependency in the effect
  useEffect(() => {
    vehicleRef.current = followedVehicle;
  }, [followedVehicle]);

  // Keep track of vehicle updates and center map - only run this once
  useEffect(() => {
    console.log("ContinuousVehicleTracker: Setting up tracking system");
    
    // Function to update the map position when the vehicle moves
    const updateMapPosition = () => {
      const currentVehicle = vehicleRef.current;
      if (!currentVehicle || !currentVehicle.latitude || !currentVehicle.longitude) {
        return;
      }
      
      const now = Date.now();
      // Only log every second to avoid console spam
      if (!lastUpdateRef.current || now - lastUpdateRef.current > 1000) {
        console.log(
          "Centering map on vehicle:", 
          currentVehicle.displayName, 
          "at", 
          currentVehicle.latitude.toFixed(6), 
          currentVehicle.longitude.toFixed(6),
          "Current map position:",
          currentViewState ? 
            `${currentViewState.latitude.toFixed(6)}, ${currentViewState.longitude.toFixed(6)}` : 
            "unknown"
        );
        lastUpdateRef.current = now;
      }
      
      // Get current coordinates
      const newPosition = {
        latitude: currentVehicle.latitude,
        longitude: currentVehicle.longitude,
        heading: currentVehicle.heading || 0
      };
      
      // If we have a last position, check if the change is significant enough to update
      if (lastPositionRef.current) {
        const latChange = Math.abs(lastPositionRef.current.latitude - newPosition.latitude);
        const lngChange = Math.abs(lastPositionRef.current.longitude - newPosition.longitude);
        
        // Skip update if change is too small (prevents tiny jitters)
        // Using a larger threshold of 0.00005 degrees (roughly 5-6 meters)
        if (latChange < 0.00005 && lngChange < 0.00005) {
          return;
        }
      }
      
      // Save the current position for the next comparison
      lastPositionRef.current = newPosition;
      
      setViewState(prev => {
        return {
          ...prev,
          longitude: newPosition.longitude,
          latitude: newPosition.latitude,
          // In driving mode, only update the bearing to match vehicle heading
          ...(isDrivingMode ? { 
            bearing: newPosition.heading,
            pitch: 0 // Keep a flat 2D view in driving mode
          } : {}),
          // Add smooth transition for all updates
          transitionDuration: 300,
          transitionInterpolator: {
            interpolatePosition: (from, to) => [
              from[0] + (to[0] - from[0]) * 0.5,
              from[1] + (to[1] - from[1]) * 0.5
            ]
          }
        };
      });
    };
    
    // Set up interval to continuously track the vehicle if not already set up
    if (!intervalRef.current) {
      // Run once immediately
      updateMapPosition();
      
      // Then set up the interval - reduce frequency to 200ms (5 updates per second)
      intervalRef.current = setInterval(updateMapPosition, 200);
      console.log("ContinuousVehicleTracker: Started tracking interval");
    }
    
    // Clean up only when component unmounts, not on every re-render
    return () => {
      if (intervalRef.current) {
        console.log("ContinuousVehicleTracker: Cleaning up interval on unmount");
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // Empty dependency array means this runs once on mount and cleans up on unmount
  }, []); 
  
  return null;
};

export default ContinuousVehicleTracker; 