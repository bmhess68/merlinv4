const axios = require('axios');

const whitePlainsCoords = { lat: 41.0340, lng: -73.7629 };

async function searchAddress(query) {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key is not configured');
    }

    try {
        const url = 'https://maps.googleapis.com/maps/api/geocode/json';
        
        // Define the search area center (White Plains)
        const whitePlainsCenter = {
            lat: 41.0340,
            lng: -73.7638
        };

        // Create a 50-mile radius bounding box
        const boundingRadius = 50 / 69; // Convert miles to degrees (approximate)
        
        const response = await axios.get(url, {
            params: {
                address: query,  // Use raw query without forcing White Plains context
                key: process.env.GOOGLE_MAPS_API_KEY,
                bounds: `${whitePlainsCenter.lat - boundingRadius},${whitePlainsCenter.lng - boundingRadius}|${whitePlainsCenter.lat + boundingRadius},${whitePlainsCenter.lng + boundingRadius}`,
                components: 'country:US',  // Restrict to USA only
                location: `${whitePlainsCenter.lat},${whitePlainsCenter.lng}`,
                radius: 80467.2  // 50 miles in meters
            }
        });

        if (response.data.status !== 'OK') {
            console.error('Google API error:', response.data.status, response.data.error_message);
            return [];
        }

        // Process and filter results
        const results = response.data.results
            .filter(result => {
                // Check if result is within 50 miles of White Plains
                const location = result.geometry.location;
                const distance = calculateDistance(
                    whitePlainsCenter.lat,
                    whitePlainsCenter.lng,
                    location.lat,
                    location.lng
                );
                return distance <= 50;
            })
            .map(result => ({
                displayName: result.formatted_address,
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
                type: 'address',
                distance: calculateDistance(
                    whitePlainsCenter.lat,
                    whitePlainsCenter.lng,
                    result.geometry.location.lat,
                    result.geometry.location.lng
                ).toFixed(1) // Add distance information
            }))
            .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)); // Sort by distance

        return results;
    } catch (error) {
        console.error('Error in searchAddress:', error.response?.data || error.message);
        throw error;
    }
}

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

module.exports = { searchAddress };