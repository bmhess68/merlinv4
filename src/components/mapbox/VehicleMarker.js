import React, { useContext } from 'react';
import { Marker, useMap } from 'react-map-gl/mapbox';
import { getVehicleIconUrl } from './utils/vehicleUtils';

// VehicleMarker component with ambulance support
const VehicleMarker = ({ vehicle, followedVehicle, handleVehicleFollow, isAmbulance, isDrivingMode }) => {
  // Get access to the map to check the current bearing
  const { current: map } = useMap();
  
  // Check if this vehicle is the one being followed
  const isFollowed = followedVehicle && 
    followedVehicle.displayName === vehicle.displayName;
  
  // Determine the icon URL based on vehicle type and ambulance flag
  const getIcon = () => {
    // Pass vehicle object with isAmbulance flag
    const vehicleWithType = {
      ...vehicle,
      isAmbulance: isAmbulance
    };
    
    // Use the vehicle utils function which now handles ambulances
    return getVehicleIconUrl(vehicleWithType);
  };
  
  // Get the icon URL
  const iconUrl = getIcon();
  
  // Determine tooltip background color
  const getTooltipStyle = () => {
    if (isAmbulance) {
      return {
        backgroundColor: 'rgba(0, 128, 0, 0.8)', // Green background for ambulances
        color: 'white',
        padding: '1px 3px',
        borderRadius: '4px',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 1,
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: '110%'
      };
    }
    
    // Default blue for police/other vehicles
    return {
      backgroundColor: 'rgba(0, 0, 255, 0.7)',
      color: 'white',
      padding: '1px 3px',
      borderRadius: '4px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 1,
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '110%'
    };
  };
  
  // Calculate the correct rotation for the vehicle icon
  const getIconRotation = () => {
    const vehicleHeading = vehicle.heading || 0;
    
    // In driving mode, when we're following this vehicle, we need to
    // compensate for the map's rotation (bearing) which is set to match the vehicle heading
    if (isDrivingMode && isFollowed && map) {
      // The map's bearing is already set to the vehicle's heading, so the
      // vehicle icon should appear pointing straight up (0 degrees)
      return 0;
    }
    
    // For other vehicles in driving mode, or when not in driving mode,
    // we need to use the vehicle's actual heading
    return vehicleHeading;
  };
  
  return (
    <Marker
      key={vehicle.displayName}
      longitude={vehicle.longitude}
      latitude={vehicle.latitude}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        console.log("Vehicle marker clicked:", vehicle);
        handleVehicleFollow(vehicle);
      }}
    >
      <div className={`vehicle-marker ${isFollowed ? 'followed' : ''}`} style={{
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        filter: isFollowed ? 'drop-shadow(0 0 3px rgba(52, 152, 219, 0.8))' : 'none', 
        width: isFollowed ? '36px' : '28px',
        height: isFollowed ? '36px' : '28px',
        position: 'relative',
        border: 'none',
        backgroundColor: 'transparent'
      }}>
        <img 
          src={iconUrl} 
          alt={isAmbulance ? 'ambulance' : (vehicle.type || 'vehicle')} 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `rotate(${getIconRotation()}deg)`,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '0',
            boxShadow: 'none'
          }}
        />
        
        {/* Always-visible tooltip that stays horizontal regardless of vehicle rotation */}
        <div style={getTooltipStyle()}>
          {vehicle.displayName}
          {isFollowed && ' (Following)'}
        </div>
      </div>
    </Marker>
  );
};

export default VehicleMarker; 