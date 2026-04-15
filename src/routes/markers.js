const express = require('express');
const router = express.Router();
const { logAuditInfo } = require('../services/auditService');

// Get all markers
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM markers');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching markers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new marker
router.post('/', async (req, res) => {
    const { 
        name, 
        color, 
        location_lat, 
        location_long, 
        incident_id, 
        type 
    } = req.body;

    try {
        const newMarker = await pool.query(
            `INSERT INTO markers (
                name, 
                color, 
                location_lat, 
                location_long, 
                incident_id, 
                type, 
                datetime_added
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
            RETURNING *`,
            [name, color, location_lat, location_long, incident_id, type]
        );

        await logAuditInfo(
            req.session?.user?.userName || 'Unknown',
            'CREATE_MARKER',
            `Created marker "${name}" for incident ${incident_id}`
        );

        res.status(201).json(newMarker.rows[0]);
    } catch (err) {
        console.error('Error creating new marker:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update marker active status
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { active } = req.body;

    try {
        const result = await pool.query(
            'UPDATE markers SET active = $1 WHERE id = $2 RETURNING *',
            [active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Marker not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating marker:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
