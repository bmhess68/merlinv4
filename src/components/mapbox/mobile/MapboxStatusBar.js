import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * StatusBar component for the Mapbox mobile view
 * Displays vehicle information and location data
 * @param {Object} props
 * @param {Object} props.followedVehicle - The vehicle being followed
 * @param {Object} props.geocodedLocation - Geocoded location information
 * @param {boolean} props.isGeocoding - Whether geocoding is in progress
 */
const MapboxStatusBar = ({ followedVehicle, geocodedLocation, isGeocoding }) => {
  // State to store previous geocoded location to prevent flashing
  const [previousLocation, setPreviousLocation] = useState(null);
  
  // Update previous location when we get new data
  useEffect(() => {
    if (geocodedLocation && !isGeocoding) {
      setPreviousLocation(geocodedLocation);
    }
  }, [geocodedLocation, isGeocoding]);
  
  // Return null if there's no vehicle to follow
  if (!followedVehicle) return null;
  
  // Use previous location data during geocoding to prevent flashing
  const displayLocation = isGeocoding ? previousLocation : geocodedLocation;
  
  // Format coordinates to be more readable
  const formatCoord = num => (typeof num === 'number' ? num.toFixed(5) : '0.00000');
  
  // Convert numeric heading to compass direction
  const getCompassDirection = (heading) => {
    if (heading === undefined || heading === null) return 'Unknown';
    
    // Convert to number if it's a string
    const numericHeading = typeof heading === 'string' ? parseFloat(heading) : heading;
    
    // Ensure heading is within 0-360 range
    const normalizedHeading = ((numericHeading % 360) + 360) % 360;
    
    // Define compass directions with their degree ranges
    const directions = [
      { name: 'NORTH', min: 337.5, max: 22.5 },
      { name: 'NORTHEAST', min: 22.5, max: 67.5 },
      { name: 'EAST', min: 67.5, max: 112.5 },
      { name: 'SOUTHEAST', min: 112.5, max: 157.5 },
      { name: 'SOUTH', min: 157.5, max: 202.5 },
      { name: 'SOUTHWEST', min: 202.5, max: 247.5 },
      { name: 'WEST', min: 247.5, max: 292.5 },
      { name: 'NORTHWEST', min: 292.5, max: 337.5 }
    ];
    
    // Handle special case for NORTH which spans across 0
    if (normalizedHeading >= 337.5 || normalizedHeading < 22.5) {
      return 'NORTH';
    }
    
    // Find matching direction
    for (const direction of directions) {
      if (normalizedHeading >= direction.min && normalizedHeading < direction.max) {
        return direction.name;
      }
    }
    
    return 'Unknown';
  };
  
  // Extract address parts to ensure both house number and street name are shown
  const getStreetAddress = () => {
    if (!displayLocation) {
      return `${formatCoord(followedVehicle.latitude)}, ${formatCoord(followedVehicle.longitude)}`;
    }
    
    // First try to get the fully formatted address
    if (displayLocation.address) {
      // Try to extract just the street number and name
      const parts = displayLocation.address.split(',');
      if (parts.length > 0) {
        // If the first part looks like it contains both number and street, use it
        const firstPart = parts[0].trim();
        // Check if it's not just a number (could be house number without street)
        if (isNaN(parseInt(firstPart)) || firstPart.indexOf(' ') > -1) {
          return firstPart;
        }
      }
    }
    
    // If we're here, we might have only a house number or only a street name
    // Try to combine address components if available
    if (displayLocation.addressComponents) {
      const components = displayLocation.addressComponents;
      const houseNumber = components.house_number || '';
      
      // Look for street name in various possible fields
      const streetFields = ['road', 'street', 'highway', 'pedestrian', 'footway', 'path', 'cycleway'];
      let streetName = '';
      
      for (const field of streetFields) {
        if (components[field]) {
          streetName = components[field];
          break;
        }
      }
      
      if (houseNumber && streetName) {
        return `${houseNumber} ${streetName}`;
      } else if (streetName) {
        return streetName;
      } else if (houseNumber) {
        // We have only house number, try to find the street from other parts or locality
        let streetFromLocality = '';
        if (components.road) streetFromLocality = components.road;
        else if (components.suburb) streetFromLocality = `${houseNumber} in ${components.suburb}`;
        else if (components.village) streetFromLocality = `${houseNumber} in ${components.village}`;
        else if (components.town) streetFromLocality = `${houseNumber} in ${components.town}`;
        else if (components.city) streetFromLocality = `${houseNumber} in ${components.city}`;
        
        return streetFromLocality || `${houseNumber}`;
      }
    }
    
    // If we have street from geocoded location, use that
    if (displayLocation.street) {
      return displayLocation.street;
    }
    
    // Last resort - just show coordinates
    return `${formatCoord(followedVehicle.latitude)}, ${formatCoord(followedVehicle.longitude)}`;
  };
  
  // Get city/town name
  const getLocality = () => {
    if (!displayLocation) return '';
    
    if (displayLocation.locality) {
      return displayLocation.locality;
    }
    
    // Try to get from address components if available
    if (displayLocation.addressComponents) {
      const components = displayLocation.addressComponents;
      if (components.village) return components.village;
      if (components.town) return components.town;
      if (components.city) return components.city;
      if (components.suburb) return components.suburb;
      if (components.county) return components.county;
    }
    
    return '';
  };
  
  // Get location name if available
  const getLocationName = () => {
    if (!displayLocation) return null;
    
    if (displayLocation.addressComponents) {
      const components = displayLocation.addressComponents;
      
      // Try various potential name fields
      const nameFields = [
        'building', 'amenity', 'shop', 'tourism', 'historic', 
        'leisure', 'landuse', 'office', 'place_of_worship', 'public_building'
      ];
      
      for (const field of nameFields) {
        if (components[field]) {
          return components[field];
        }
      }
      
      // Check for name field directly
      if (components.name) {
        return components.name;
      }
    }
    
    // Check for name in the main geocodedLocation object
    if (displayLocation.name) {
      return displayLocation.name;
    }
    
    return null;
  };
  
  const streetAddress = getStreetAddress();
  const locality = getLocality();
  const locationName = getLocationName();
  
  // Combine street address with location name if available
  const displayAddress = locationName 
    ? `${streetAddress} (${locationName})`
    : streetAddress;
  
  // Get compass direction from heading
  const compassDirection = getCompassDirection(followedVehicle.heading);
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '0', // Position at the bottom of the screen
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80%', // 80% of screen width as requested
      backgroundColor: 'rgba(30, 30, 30, 0.7)', // Reduced from 0.9 to 0.7
      color: 'white',
      paddingTop: '15px',
      paddingBottom: '25px', // Extra padding at bottom for usability
      paddingLeft: '20px',
      paddingRight: '20px',
      zIndex: 1000,
      boxShadow: '0 -4px 15px rgba(0, 0, 0, 0.25)', // Lighter shadow
      backdropFilter: 'blur(5px)', // Reduced blur for better visibility
      WebkitBackdropFilter: 'blur(5px)', // Matching reduced blur
      borderTopLeftRadius: '15px', // Rounded corners on top
      borderTopRightRadius: '15px',
      borderTop: '1px solid rgba(255, 255, 255, 0.15)',
      transition: 'all 0.3s ease-in-out'
    }}>
      {/* Vehicle Title */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ marginRight: '6px' }}>🚓</span> {/* Police car emoji instead of pin */}
          {followedVehicle.displayName || 'Unknown Vehicle'}
        </div>
        {followedVehicle.speed && (
          <div style={{
            backgroundColor: parseInt(followedVehicle.speed, 10) > 5 ? 'rgba(76, 175, 80, 0.7)' : 'rgba(150, 150, 150, 0.5)',
            fontSize: '12px',
            fontWeight: 'bold',
            padding: '3px 8px',
            borderRadius: '12px'
          }}>
            {followedVehicle.speed} mph
          </div>
        )}
      </div>
      
      {/* Debugging output - can be removed in production */}
      {process.env.NODE_ENV === 'development' && displayLocation && (
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '5px' }}>
          Address data: {JSON.stringify(displayLocation)}
        </div>
      )}
      
      {/* Location Info */}
      <div>
        {/* Always show address - either current or previous when loading */}
        <div>
          {/* Large Street Address (including house number and location name if available) */}
          <div style={{ 
            fontSize: '36px', 
            fontWeight: 'bold',
            lineHeight: '1.2',
            marginTop: '5px',
            marginBottom: '5px',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            transition: 'opacity 0.3s ease-in-out',
            opacity: isGeocoding ? 0.7 : 1
          }}>
            {displayAddress}
            {isGeocoding && (
              <span style={{ 
                fontSize: '14px', 
                opacity: 0.6, 
                marginLeft: '10px', 
                fontWeight: 'normal',
                verticalAlign: 'middle'
              }}>
                (updating...)
              </span>
            )}
          </div>
          
          {/* Smaller Additional Info */}
          <div style={{ 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '5px',
            transition: 'opacity 0.3s ease-in-out',
            opacity: isGeocoding ? 0.7 : 1
          }}>
            <div>
              {locality && <span>{locality} • </span>}
              <span style={{ fontStyle: 'italic' }}>
                {formatCoord(followedVehicle.latitude)}, {formatCoord(followedVehicle.longitude)}
              </span>
            </div>
            
            {followedVehicle.heading !== undefined && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>{compassDirection}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>({followedVehicle.heading}°)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

MapboxStatusBar.propTypes = {
  followedVehicle: PropTypes.shape({
    displayName: PropTypes.string,
    latitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    longitude: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    heading: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    speed: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  }),
  geocodedLocation: PropTypes.shape({
    address: PropTypes.string,
    street: PropTypes.string,
    locality: PropTypes.string,
    addressComponents: PropTypes.object,
    name: PropTypes.string
  }),
  isGeocoding: PropTypes.bool
};

MapboxStatusBar.defaultProps = {
  isGeocoding: false
};

export default MapboxStatusBar; 