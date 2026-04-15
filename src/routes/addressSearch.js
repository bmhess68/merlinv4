const express = require('express');
const router = express.Router();
const axios = require('axios');

router.get('/address-search', async (req, res) => {
    try {
        const { query, lat, lng, zoom } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        console.log('Processing address search for:', query);

        if (!process.env.GOOGLE_MAPS_API_KEY) {
            console.error('Google Maps API key is missing');
            return res.status(500).json({ error: 'Server configuration error - Missing API key' });
        }

        const url = 'https://maps.googleapis.com/maps/api/geocode/json';
        
        // Use provided map center or default to White Plains
        const searchCenter = {
            lat: parseFloat(lat) || 41.0340,
            lng: parseFloat(lng) || -73.7638
        };

        try {
            const response = await axios.get(url, {
                params: {
                    address: query,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                    location: `${searchCenter.lat},${searchCenter.lng}`,
                    region: 'us'
                }
            });

            // If no results, return empty array
            if (response.data.status === 'ZERO_RESULTS') {
                console.log('No results found for query:', query);
                return res.json([]);
            }

            if (response.data.status !== 'OK') {
                console.error('Google API error:', response.data.status, response.data.error_message);
                return res.status(400).json({ 
                    error: 'Google API error', 
                    details: response.data.error_message 
                });
            }

            // Process and filter results
            const results = response.data.results
                .map(result => ({
                    displayName: result.formatted_address,
                    latitude: result.geometry.location.lat,
                    longitude: result.geometry.location.lng,
                    type: 'address',
                    distance: calculateDistance(
                        searchCenter.lat,
                        searchCenter.lng,
                        result.geometry.location.lat,
                        result.geometry.location.lng
                    ).toFixed(1) + ' miles'
                }))
                .sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

            console.log('Found results:', results.length);
            res.json(results);
        } catch (axiosError) {
            console.error('Google API request failed:', axiosError.response?.data || axiosError.message);
            return res.status(500).json({ 
                error: 'Failed to contact Google API',
                details: axiosError.message
            });
        }
    } catch (error) {
        console.error('Address search error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message
        });
    }
});

// Helper function to calculate distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI/180);
}

module.exports = router;