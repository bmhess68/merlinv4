import React, { useEffect, useState, useCallback, useRef } from 'react';

// Simplified StatusBar component that only shows geocoded location information
const StatusBar = ({ followedVehicle, geocodedLocation, isGeocoding }) => {
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const lastLocationRef = useRef(null);

    // Format heading as compass direction
    const getCompassDirection = (degrees) => {
        if (degrees === undefined || degrees === null) return 'N/A';
        
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round((degrees % 360) / 22.5) % 16;
        return directions[index];
    };

    // Keep track of initial load completion and cache successful location data
    useEffect(() => {
        if (geocodedLocation && !initialLoadComplete) {
            setInitialLoadComplete(true);
        }
        
        // Store the last successful location data
        if (geocodedLocation) {
            lastLocationRef.current = geocodedLocation;
        }
    }, [geocodedLocation, initialLoadComplete]);

    // Extract street, town and full address from geocoded location data
    const getAddressParts = useCallback(() => {
        // Default values
        let street = 'Location unavailable';
        let town = '';
        let fullAddress = 'Location unavailable';
        
        // Only show loading message during initial geocoding, not during updates
        if (isGeocoding && !initialLoadComplete) {
            return { 
                street: 'Determining location...', 
                town: '', 
                fullAddress: 'Determining location...' 
            };
        }
        
        // Use the last successful location data during background updates
        const dataToUse = isGeocoding && initialLoadComplete ? lastLocationRef.current : geocodedLocation;
        
        console.log("StatusBar: Processing location data:", dataToUse);
        
        if (!dataToUse) {
            console.log("StatusBar: No location data available");
            if (followedVehicle && followedVehicle.latitude && followedVehicle.longitude) {
                const coords = `${followedVehicle.latitude.toFixed(5)}, ${followedVehicle.longitude.toFixed(5)}`;
                return { street: coords, town: '', fullAddress: coords };
            }
            return { street, town, fullAddress };
        }
        
        // Check if this is a fallback (coordinates-only) location
        if (dataToUse.isFallback) {
            console.log("StatusBar: Detected fallback location, using coordinates");
            if (followedVehicle && followedVehicle.latitude && followedVehicle.longitude) {
                const coords = `${followedVehicle.latitude.toFixed(5)}, ${followedVehicle.longitude.toFixed(5)}`;
                return { street: coords, town: '', fullAddress: coords };
            }
            return { street, town, fullAddress };
        }
        
        // If the data structure is missing essential fields
        if (!dataToUse.street && !dataToUse.address && !dataToUse.displayName && !dataToUse.addressComponents) {
            console.log("StatusBar: Missing essential address fields, using coordinates");
            if (followedVehicle && followedVehicle.latitude && followedVehicle.longitude) {
                const coords = `${followedVehicle.latitude.toFixed(5)}, ${followedVehicle.longitude.toFixed(5)}`;
                return { street: coords, town: '', fullAddress: coords };
            }
            return { street, town, fullAddress };
        }

        // Check if we have pre-formatted street name from the geocoding service
        if (dataToUse.street) {
            street = dataToUse.street;
            town = dataToUse.locality || '';
            fullAddress = dataToUse.address || dataToUse.displayName || `${street}, ${town}`;
            console.log("StatusBar: Using street field:", street);
            return { street, town, fullAddress };
        }
        
        // If we have address components from Nominatim
        if (dataToUse.addressComponents) {
            const addr = dataToUse.addressComponents;
            
            // Try to construct the street address from components
            const houseNumber = addr.house_number || '';
            const roadName = addr.road || addr.highway || addr.street || '';
            
            if (roadName) {
                street = houseNumber ? `${houseNumber} ${roadName}` : roadName;
            }
            
            // Get town/city information
            town = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
            
            // Add state/postcode if available
            if (addr.state) {
                town = town ? `${town}, ${addr.state}` : addr.state;
            }
            
            fullAddress = dataToUse.address || dataToUse.displayName || `${street}, ${town}`;
            
            console.log("StatusBar: Using addressComponents to build:", street);
            return { street, town, fullAddress };
        } 
        // If we have traditional address field
        else if (dataToUse.address) {
            // Try to extract street from the full address if needed
            if (typeof dataToUse.address === 'string') {
                const parts = dataToUse.address.split(',');
                if (parts.length >= 2) {
                    street = parts[0].trim();
                    town = parts.slice(1, 3).join(',').trim();
                    fullAddress = dataToUse.address;
                } else {
                    street = dataToUse.address;
                    fullAddress = dataToUse.address;
                }
            } 
            // If address is an object (old format)
            else if (typeof dataToUse.address === 'object') {
                const addr = dataToUse.address;
                const houseNumber = addr.house_number || '';
                const roadName = addr.road || addr.highway || addr.street || '';
                
                if (roadName) {
                    street = houseNumber ? `${houseNumber} ${roadName}` : roadName;
                }
                
                town = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
                if (addr.state) {
                    town = town ? `${town}, ${addr.state}` : addr.state;
                }
                
                fullAddress = dataToUse.displayName || `${street}, ${town}`;
            }
            
            console.log("StatusBar: Using address field:", street);
            return { street, town, fullAddress };
        } 
        // If we just have a display name
        else if (dataToUse.displayName) {
            const parts = dataToUse.displayName.split(',');
            
            if (parts.length >= 2) {
                street = parts[0].trim();
                town = parts.slice(1, 3).join(',').trim();
                fullAddress = dataToUse.displayName;
            } else {
                street = dataToUse.displayName;
                fullAddress = dataToUse.displayName;
            }
            
            console.log("StatusBar: Using displayName:", street);
            return { street, town, fullAddress };
        }
        
        // If we get here, we have an unexpected structure but at least we have a geocodedLocation object
        console.log("StatusBar: Using fallback parsing for unexpected structure");
        street = "Location Found"; // At least don't show "unavailable"
        return { street, town, fullAddress };
    }, [followedVehicle, geocodedLocation, isGeocoding, initialLoadComplete]);

    // Glass effect style base
    const glassEffect = {
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // 50% opacity
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)', // Stronger shadow
        border: '2px solid rgba(255, 255, 255, 0.25)' // Visible border
    };
    
    // Status bar style with centered content
    const statusBarStyle = {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '12px 15px',
        color: 'white',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center', // Center content
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        ...glassEffect,
        // Use max-content to size the bar based on content
        width: 'fit-content',
        maxWidth: '100%',
        margin: '0 auto'
    };
    
    const emptyStatusStyle = {
        ...statusBarStyle,
        padding: '12px 15px',
        fontSize: '24px',
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.9)'
    };
    
    // Container for address and compass
    const contentContainerStyle = {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px' // Add space between address and compass
    };
    
    // Address container style
    const addressContainerStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    };
    
    // Street display - keep large font
    const streetStyle = {
        fontSize: '40px',
        fontWeight: '800',
        color: 'white',
        textAlign: 'center',
        marginBottom: '5px'
    };
    
    // Town display
    const townStyle = {
        fontSize: '18px',
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center'
    };
    
    // Compass display in a circle
    const compassStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '50%',
        width: '45px',
        height: '45px',
        padding: '8px',
        fontSize: '20px',
        fontWeight: '700',
        color: 'white',
        lineHeight: '1'
    };
    
    // If no vehicle is selected, show the placeholder
    if (!followedVehicle) {
        return (
            <div style={emptyStatusStyle}>
                <div>Select a vehicle to track</div>
            </div>
        );
    }
    
    // For string value (just display name)
    if (typeof followedVehicle === 'string') {
        return (
            <div style={statusBarStyle}>
                <div style={{ 
                    fontSize: '27px',
                    fontWeight: '600'
                }}>
                    Select location on map
                </div>
            </div>
        );
    }
    
    // Get formatted address components
    const { street, town, fullAddress } = getAddressParts();
    const compassDir = getCompassDirection(followedVehicle.heading);
    
    // Component with address and heading
    return (
        <div style={statusBarStyle}>
            <div style={contentContainerStyle}>
                <div style={addressContainerStyle}>
                    <div style={streetStyle}>
                        {street}
                    </div>
                    {town && (
                        <div style={townStyle}>
                            {town}
                        </div>
                    )}
                </div>
                
                <div style={compassStyle}>
                    {compassDir}
                </div>
            </div>
            
            {/* Show loading state as an overlay if geocoding is in progress - ONLY on initial load */}
            {isGeocoding && !initialLoadComplete && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    borderRadius: 'inherit',
                    fontSize: '14px',
                    fontStyle: 'italic'
                }}>
                    <span>Finding nearby roads...</span>
                </div>
            )}
        </div>
    );
};

export default StatusBar; 