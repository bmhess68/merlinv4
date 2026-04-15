import { toast } from 'react-toastify';

// Import geocoding service when it's available
// import geocodingService from '../utils/reverseGeocodingService';

/**
 * Follows a vehicle and updates the map view
 * @param {Object|string} vehicle - Vehicle object or display name
 * @param {Object} user - Current user
 * @param {function} setFollowedVehicle - State setter for followed vehicle
 * @param {function} setViewState - State setter for view state
 * @param {Object} viewState - Current view state
 * @param {Object} mapRef - Reference to the map object
 * @param {number} minZoomLevel - Minimum zoom level
 * @returns {Promise<void>} 
 */
export const followVehicle = async (
  vehicle, 
  user, 
  setFollowedVehicle, 
  setViewState, 
  viewState, 
  mapRef,
  minZoomLevel = 15
) => {
  console.log("Vehicle selected for following:", vehicle);
  
  // Enable driving mode automatically when a vehicle is selected
  const enableDrivingMode = () => {      
    // Disable pan and rotate controls for driving mode
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      map.dragPan.disable();
      map.dragRotate.disable();
      
      // Ensure zoom controls remain enabled
      if (map.scrollZoom.isEnabled() === false) {
        map.scrollZoom.enable();
      }
      if (map.doubleClickZoom.isEnabled() === false) {
        map.doubleClickZoom.enable();
      }
      if (map.touchZoomRotate.isEnabled() === false) {
        // Enable zoom but disable rotate
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
      }
      
      // Limit the minimum zoom level to prevent zooming out too far
      map.setMinZoom(minZoomLevel);
      
      // Add a CSS class to the map container for driving mode styling
      map.getContainer().classList.add('driving-mode');
    }
    
    // Notify the user
    toast.info(`Now tracking ${vehicle.displayName || 'vehicle'}`, {
      position: "top-center",
      autoClose: 2000
    });
  };
  
  // If we just have the displayName (string)
  if (typeof vehicle === 'string') {
    // Fetch the complete vehicle data
    try {
      // Get user email from props
      const userEmail = user?.userEmail;
      
      if (!userEmail) {
        console.error("Cannot follow vehicle: No user email available");
        setFollowedVehicle({ displayName: vehicle });
        return;
      }
      
      // Use the environment variable base URL if available
      const baseUrl = process.env.REACT_APP_API_URL || '';
      
      // Use the proper API endpoint
      const url = `${baseUrl}/api/vehicles/${vehicle}`;
      console.log(`Fetching vehicle data from: ${url}`);
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-User-Email': userEmail
        }
      });
      
      if (response.ok) {
        const vehicleData = await response.json();
        console.log("Successfully fetched vehicle data:", vehicleData);
        setFollowedVehicle(vehicleData);
        
        // Preserve the current zoom level if it exists
        const currentZoom = viewState.zoom;
        // Determine appropriate zoom level - must be at least minZoomLevel
        const zoomLevel = Math.max(currentZoom, minZoomLevel);
        
        console.log(`Setting view for vehicle follow. Using zoom level: ${zoomLevel} (current: ${currentZoom}, min: ${minZoomLevel})`);
        
        // Immediately center the map on the followed vehicle and match its heading for driving mode
        setViewState(prev => ({
          ...prev,
          longitude: vehicleData.longitude,
          latitude: vehicleData.latitude,
          zoom: zoomLevel, // Use determined zoom level with minimum enforced
          bearing: vehicleData.heading || 0, // Always set bearing as we're always in driving mode
          pitch: 0,
          transitionDuration: 500
        }));
        
        // Initialize driving mode features after a brief delay
        setTimeout(() => {
          enableDrivingMode();
        }, 200);
        
        // Force update after a brief delay to ensure map moves
        setTimeout(() => {
          if (vehicleData && vehicleData.latitude && vehicleData.longitude) {
            console.log("Forcing map update after delay");
            setViewState(prev => ({
              ...prev,
              longitude: vehicleData.longitude,
              latitude: vehicleData.latitude,
              bearing: vehicleData.heading || 0,
              // Keep zoom at the same level (won't be below minimum)
            }));
          }
        }, 300);
      } else {
        console.error(`Failed to fetch vehicle data: ${response.status}`);
        // Fallback to just the display name if we can't get the data
        setFollowedVehicle({ displayName: vehicle });
      }
    } catch (error) {
      console.error("Error fetching vehicle data:", error);
      setFollowedVehicle({ displayName: vehicle });
    }
  } 
  // If we have a vehicle object
  else {
    console.log("Setting followed vehicle with data:", vehicle);
    setFollowedVehicle(vehicle);
    
    // Preserve the current zoom level if it exists
    const currentZoom = viewState.zoom;
    // Determine appropriate zoom level - must be at least minZoomLevel
    const zoomLevel = Math.max(currentZoom, minZoomLevel);
    
    console.log(`Setting view for vehicle follow. Using zoom level: ${zoomLevel} (current: ${currentZoom}, min: ${minZoomLevel})`);
    
    // Immediately center the map on the followed vehicle and match its heading for driving mode
    setViewState(prev => ({
      ...prev,
      longitude: vehicle.longitude,
      latitude: vehicle.latitude,
      zoom: zoomLevel, // Use determined zoom level with minimum enforced
      bearing: vehicle.heading || 0, // Always set bearing as we're always in driving mode
      pitch: 0,
      transitionDuration: 500
    }));
    
    // Enable driving mode after a brief delay to ensure map is positioned
    setTimeout(() => {
      enableDrivingMode();
    }, 200);
    
    // Force update after a brief delay to ensure map moves
    setTimeout(() => {
      if (vehicle && vehicle.latitude && vehicle.longitude) {
        console.log("Forcing map update after delay");
        setViewState(prev => ({
          ...prev,
          longitude: vehicle.longitude,
          latitude: vehicle.latitude,
          bearing: vehicle.heading || 0,
          // Keep zoom at the same level (won't be below minimum)
        }));
      }
    }, 300);
  }
};

/**
 * Updates the location information for a vehicle
 * @param {Object} vehicle - The vehicle to update location for
 * @param {function} setIsGeocoding - State setter for geocoding status
 * @param {function} setGeocodedLocation - State setter for geocoded location
 * @param {Object} geocodingService - The geocoding service to use
 * @returns {Promise<void>}
 */
export const updateVehicleLocationInfo = async (
  vehicle,
  setIsGeocoding,
  setGeocodedLocation,
  geocodingService
) => {
  if (!vehicle || (!vehicle.latitude && vehicle.latitude !== 0) || (!vehicle.longitude && vehicle.longitude !== 0)) {
    console.log("No valid vehicle data for geocoding:", vehicle);
    return;
  }
  
  // Parse coordinates as numbers to ensure they're the right type
  // Handle potential string values from API
  const latitude = typeof vehicle.latitude === 'string' ? parseFloat(vehicle.latitude) : vehicle.latitude;
  const longitude = typeof vehicle.longitude === 'string' ? parseFloat(vehicle.longitude) : vehicle.longitude;
  const heading = typeof vehicle.heading === 'string' ? parseFloat(vehicle.heading || 0) : (vehicle.heading || 0);
  
  console.log("------------------------------");
  console.log("GEOCODING ATTEMPT:");
  console.log(`Vehicle ID: ${vehicle.id || 'N/A'}, Display Name: ${vehicle.displayName || 'N/A'}`);
  console.log(`Coordinates: lat=${latitude}, lon=${longitude}, heading=${heading}`);
  console.log(`Original types: lat=${typeof vehicle.latitude}, lon=${typeof vehicle.longitude}, heading=${typeof vehicle.heading}`);
  console.log("------------------------------");
  
  // Check if coordinates are valid numbers
  if (isNaN(latitude) || isNaN(longitude)) {
    console.error("Invalid coordinates detected:", vehicle.latitude, vehicle.longitude);
    return;
  }
  
  setIsGeocoding(true);
  try {
    // Pass vehicle heading to the geocoding service for better intersection lookup
    console.log("Calling geocodingService.getAddressForLocation with:", latitude, longitude, heading);
    const location = await geocodingService.getAddressForLocation(
      latitude,
      longitude,
      heading
    );
    
    console.log("Geocoding result:", location ? "SUCCESS" : "FAILED (null result)");
    if (location) {
      console.log("Geocoded address:", location.address);
      console.log("Street:", location.street);
      console.log("Locality:", location.locality);
      
      setGeocodedLocation(location);
      console.log("State updated with geocoded location");
    } else {
      console.warn("No location data returned from geocoding service");
    }
  } catch (error) {
    console.error('Error during geocoding:', error);
    toast.error('Error getting location information');
  } finally {
    setIsGeocoding(false);
  }
}; 