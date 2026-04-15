// server/routes/tempMarkers.js

const express = require('express');
const router = express.Router();

// In-memory storage for temporary markers
let tempMarkers = [];

// Clean up markers older than 24 hours
const MARKER_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// Run cleanup every hour
setInterval(() => {
    const now = Date.now();
    tempMarkers = tempMarkers.filter(marker => {
        const markerTime = new Date(marker.createdAt).getTime();
        return (now - markerTime) < MARKER_LIFETIME_MS;
    });
    console.log(`Cleaned up temporary markers. ${tempMarkers.length} remaining.`);
}, 60 * 60 * 1000); // Every hour

// Get all temporary markers
router.get('/api/tempmarkers', (req, res) => {
    res.json(tempMarkers);
});

// Create a new temporary marker
router.post('/api/tempmarkers', (req, res) => {
    const newMarker = req.body;
    
    // Validate required fields
    if (!newMarker.latitude || !newMarker.longitude || !newMarker.name || !newMarker.createdBy) {
        return res.status(400).json({ error: 'Missing required marker fields' });
    }
    
    // Add to markers collection
    tempMarkers.push(newMarker);
    
    // Broadcast to all connected clients using Socket.IO
    if (global.io) {
        global.io.emit('tempMarkerUpdate', {
            action: 'add',
            marker: newMarker
        });
        console.log(`Broadcasting new temp marker "${newMarker.name}" to all clients`);
    } else {
        console.warn('Socket.IO not available for broadcasting temp marker');
    }
    
    // Return success
    res.status(201).json(newMarker);
});

// Delete a temporary marker
router.delete('/api/tempmarkers/:id', (req, res) => {
    const markerId = req.params.id;
    const userInfo = req.user; // Assuming you have user info in the request
    
    // Find the marker
    const markerIndex = tempMarkers.findIndex(m => m.id === markerId);
    
    if (markerIndex === -1) {
        return res.status(404).json({ error: 'Temporary marker not found' });
    }
    
    const marker = tempMarkers[markerIndex];
    
    // Check if user is authorized to delete (creator or admin)
    // For now, allow any user to delete markers for testing
    const isAdmin = userInfo && userInfo.permissions && userInfo.permissions.admin;
    const isCreator = userInfo && userInfo.userName === marker.createdBy;
    
    // Temporarily disable auth check for testing
    // if (!isAdmin && !isCreator) {
    //     return res.status(403).json({ error: 'Not authorized to delete this marker' });
    // }
    
    // Remove the marker
    tempMarkers.splice(markerIndex, 1);
    
    // Broadcast deletion to all connected clients
    if (global.io) {
        global.io.emit('tempMarkerUpdate', {
            action: 'delete',
            markerId: markerId
        });
        console.log(`Broadcasting temp marker deletion (ID: ${markerId}) to all clients`);
    } else {
        console.warn('Socket.IO not available for broadcasting marker deletion');
    }
    
    // Return success
    res.status(200).json({ message: 'Temporary marker deleted successfully' });
});

// Add a new endpoint to sync all markers
router.get('/api/tempmarkers/sync', (req, res) => {
    res.json({
        action: 'sync',
        markers: tempMarkers
    });
});

module.exports = router;