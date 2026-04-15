const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { logAuditInfo } = require('../services/auditService');

// Get all drawn items for a specific incident
router.get('/', async (req, res) => {
    try {
        const { incident_id } = req.query;
        
        if (!incident_id) {
            return res.status(400).json({ error: 'incident_id is required' });
        }

        console.log(`Fetching active drawn items for incident ${incident_id}`);
        const result = await pool.query(
            `SELECT id, geojson, name, color, created_at, created_by_name, active
             FROM drawn_items
             WHERE active = true
             AND incident_id = $1
             AND geojson IS NOT NULL
             ORDER BY created_at DESC`,
            [incident_id]
        );
        
        console.log(`Found ${result.rows.length} active drawn items for incident ${incident_id}`);
        
        // Validate each item before sending
        const validItems = result.rows.filter(item => {
            try {
                return (
                    item.geojson && 
                    typeof item.geojson === 'object' &&
                    item.geojson.geometry &&
                    item.geojson.geometry.coordinates
                );
            } catch (e) {
                console.error('Invalid drawn item:', item.id, e);
                return false;
            }
        });

        console.log(`Returning ${validItems.length} valid drawn items`);
        res.json(validItems);
    } catch (error) {
        console.error('Error fetching drawn items:', error);
        res.status(500).json({ error: 'Failed to fetch drawn items' });
    }
});

// Save new drawn item
router.post('/', async (req, res) => {
    try {
        const { type, coordinates, properties, incident_id } = req.body;
        const userEmail = req.session?.user?.userEmail || 'unknown';

        // Enhanced validation with specific error messages
        const missingFields = [];
        if (!type) missingFields.push('type');
        if (!coordinates) missingFields.push('coordinates');
        if (!properties) missingFields.push('properties');
        if (!incident_id) missingFields.push('incident_id');
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Construct GeoJSON object
        const geojson = {
            type: 'Feature',
            geometry: {
                type: type,
                coordinates: coordinates
            },
            properties: properties
        };

        // Insert new drawn item
        const result = await pool.query(
            `INSERT INTO drawn_items (
                incident_id,
                geojson,
                name,
                color,
                active,
                created_by_name,
                created_by_userid
            ) VALUES ($1, $2, $3, $4, true, $5, $6)
            RETURNING *`,
            [
                incident_id,
                JSON.stringify(geojson),
                properties.name || '',
                properties.color || '',
                userEmail,
                req.session?.user?.userId || 'unknown'
            ]
        );

        console.log('Successfully inserted drawn item:', result.rows[0]);
        res.status(201).json(result.rows[0]);

    } catch (error) {
        console.error('Error saving drawn item:', error);
        res.status(500).json({ 
            error: 'Failed to save drawn item',
            details: error.message
        });
    }
});

// Delete drawn item (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.session?.user?.userEmail || 'unknown';

        const result = await pool.query(
            'UPDATE drawn_items SET active = false WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rowCount === 0) {
            console.warn(`No drawn item found with id ${id}`);
            return res.status(404).json({ error: 'Drawn item not found' });
        }

        // Log the action
        await logAuditInfo(
            userEmail,
            'DELETE_DRAWN_ITEM',
            `Deleted drawn item ${id}`
        );

        console.log(`Successfully deleted drawn item ${id}`);
        res.json({ message: 'Drawn item deleted successfully' });
    } catch (error) {
        console.error('Error deleting drawn item:', error);
        res.status(500).json({ error: 'Failed to delete drawn item' });
    }
});

// Soft delete/restore drawn item (PATCH endpoint)
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { active, created_by_name, created_by_userid } = req.body;

        const result = await pool.query(
            `UPDATE drawn_items 
             SET active = $1,
                 created_by_name = $2,
                 created_by_userid = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 
             RETURNING *`,
            [active, created_by_name, created_by_userid, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Drawn item not found' });
        }

        // Log to audit trail
        await pool.query(
            `INSERT INTO audit_trail (user_email, action, additional_info)
             VALUES ($1, $2, $3)`,
            [
                created_by_name,
                active ? 'RESTORE_DRAWN_ITEM' : 'DELETE_DRAWN_ITEM',
                `${active ? 'Restored' : 'Deleted'} drawn item ${id}`
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating drawn item:', error);
        res.status(500).json({ error: 'Failed to update drawn item' });
    }
});

module.exports = router; 