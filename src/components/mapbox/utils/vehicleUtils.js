// Define a consistent set of vehicle icon mappings matching VehicleLayer.js
export const getVehicleIconUrl = (vehicle) => {
  // If vehicle is a string (displayName), convert to object format for consistency
  const vehicleObj = typeof vehicle === 'string' 
    ? { displayName: vehicle }
    : vehicle;
  
  // First determine the icon type based on vehicle properties
  let iconType = 'policeCar';
  
  // Handle null/undefined
  if (!vehicleObj || !vehicleObj.displayName) return `/images/icons/policecar/policeCar0.svg`;
  
  const displayName = vehicleObj.displayName.toLowerCase();
  
  // Check if this is an ambulance (either from type or displayName)
  if (vehicleObj.isAmbulance || 
      displayName.includes('ambulance') || 
      displayName.includes('ems') || 
      displayName.includes('bls') || 
      displayName.includes('als') || 
      displayName.includes('medic')) {
    return '/images/icons/ambulance.svg';
  }
  
  // Handle fire vehicles
  if (vehicleObj.type === 'fire') {
    if (displayName.includes('tanker')) {
      return '/images/icons/tanker.svg';
    } else if (displayName.includes('ladder')) {
      return '/images/icons/ladder.svg';
    } else if (displayName.includes('ems') || displayName.includes('bls') || displayName.includes('als')) {
      return '/images/icons/ambulance.svg';
    } else {
      return '/images/icons/engine.svg';
    }
  }

  // Handle police/etc. vehicles
  if (displayName.includes('det') || 
      displayName.includes('detective') || 
      displayName.includes('inv') || 
      displayName.includes('investigator') || 
      displayName.includes('narco') || 
      displayName.includes('siu') || 
      displayName.includes('fbi') || 
      displayName.includes('auto larceny')) {
    return '/images/icons/detcar.svg';
  } else if (displayName.includes('k9')) {
    return '/images/icons/k9/k90.svg';
  } else if (displayName.includes('marine')) {
    return '/images/icons/marine/boat0.svg';
  } else if (displayName.includes('aviation')) {
    return '/images/icons/helicopter/helicopter0.svg';
  } else if (displayName.includes('47 pct co')) {
    return '/images/icons/rav4.svg';
  } else if (displayName.includes('esu')) {
    return '/images/icons/esu/esu0.svg';
  } else if (displayName.includes('ems')) {
    return '/images/icons/ambulance.svg';
  } else if (displayName.includes('nypd')) {
    return '/images/icons/nypdcar.svg';
  } else if (displayName.includes('wcpd')) {
    return '/images/icons/wcpd.svg';
  } else if (displayName.includes('nysp')) {
    return '/images/icons/nyspcar.svg';
  } else if (displayName.includes('ctsp') || 
            displayName.includes('greenwich') || 
            displayName.includes('stamford')) {
    return '/images/icons/ctsp.svg';
  } else {
    return '/images/icons/policecar/policeCar0.svg';
  }
};

// Utility function to calculate distance between coordinates
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => value * Math.PI / 180;
  const R = 6371e3; // Earth's radius in meters
  
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
};

// Calculate bearing between two points
export const calculateBearing = (startLat, startLng, destLat, destLng) => {
  startLat = startLat * Math.PI / 180;
  startLng = startLng * Math.PI / 180;
  destLat = destLat * Math.PI / 180;
  destLng = destLng * Math.PI / 180;

  const y = Math.sin(destLng - startLng) * Math.cos(destLat);
  const x = Math.cos(startLat) * Math.sin(destLat) -
            Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  if (bearing < 0) {
    bearing += 360;
  }
  return bearing;
}; 