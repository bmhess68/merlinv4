const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { checkAndStartVehicleProcessing } = require('../vehicleTracker');

// Get all incidents
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                incident_id,
                name,
                type_incident,
                location_lat,
                location_long,
                location_address,
                radius,
                notes,
                incident_commander,
                staging_manager,
                communications,
                created_by_name,
                created_by_userid,
                active,
                date,
                time as created_at
            FROM incidents 
            ORDER BY date DESC, time DESC`);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching incidents:', error);
        res.status(500).json({ error: 'Failed to fetch incidents' });
    }
});

// Get incident types - Place BEFORE /:id route
router.get('/types', async (req, res) => {
    try {
        console.log('Attempting to fetch incident types...');
        const result = await pool.query(
            `SELECT type_id as id, type_name as name 
             FROM inctype 
             ORDER BY type_name`
        );
        console.log('Successfully fetched incident types:', result.rows);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in /types endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch incident types' });
    }
});

// Get dispositions - Place BEFORE /:id route
router.get('/dispositions', async (req, res) => {
    try {
        console.log('Attempting to fetch dispositions...');
        const result = await pool.query(
            `SELECT id, disposition_text as name 
             FROM disposition 
             ORDER BY disposition_text`
        );
        console.log('Successfully fetched dispositions:', result.rows);
        res.json(result.rows);
    } catch (error) {
        console.error('Error in /dispositions endpoint:', error);
        res.status(500).json({ error: 'Failed to fetch dispositions' });
    }
});

// Get single incident
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM incidents WHERE incident_id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching incident:', error);
        res.status(500).json({ error: 'Failed to fetch incident' });
    }
});

// Create new incident
router.post('/', async (req, res) => {
    try {
        const {
            name,
            type_incident,
            location_lat,
            location_long,
            location_address,
            radius,
            notes,
            incident_commander,
            staging_manager,
            communications,
            created_by_name,
            created_by_userid
        } = req.body;

        // Create the geography point
        const result = await pool.query(
            `INSERT INTO incidents (
                name, 
                type_incident, 
                location_lat, 
                location_long,
                location_address,
                radius, 
                notes, 
                incident_commander, 
                staging_manager,
                communications, 
                created_by_name, 
                created_by_userid,
                active,
                date,
                time,
                location
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE, CURRENT_DATE, CURRENT_TIME, ST_SetSRID(ST_MakePoint($13, $14), 4326)) 
            RETURNING *`,
            [
                name, type_incident, location_lat, location_long, location_address,
                radius, notes, incident_commander, staging_manager,
                communications, created_by_name, created_by_userid,
                location_long, location_lat // for the geography point
            ]
        );

        // After creating incident, create the circle drawn item
        const circleGeojson = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [location_long, location_lat]
            },
            properties: {
                name: name,
                color: '#0000FF',
                markerType: 'Circle',
                radius: radius
            }
        };

        // Insert the circle drawn item
        await pool.query(
            `INSERT INTO drawn_items (
                incident_id,
                geojson,
                name,
                color,
                active,
                created_by_name,
                created_by_userid
            ) VALUES ($1, $2, $3, $4, true, $5, $6)`,
            [
                result.rows[0].incident_id,
                JSON.stringify(circleGeojson),
                name,
                '#0000FF',
                created_by_name,
                created_by_userid
            ]
        );

        await checkAndStartVehicleProcessing();
        
        // Log to audit trail
        await pool.query(
            `INSERT INTO audit_trail (user_email, action, additional_info)
             VALUES ($1, $2, $3)`,
            [
                created_by_name,
                'CREATE_INCIDENT',
                `Created incident "${name}" of type ${type_incident}`
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating incident:', error);
        res.status(500).json({ 
            error: 'Failed to create incident',
            details: error.message 
        });
    }
});

// Update incident
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            type_incident,
            location_lat,
            location_long,
            location_address,
            radius,
            notes,
            incident_commander,
            staging_manager,
            communications,
            updated_by
        } = req.body;

        const result = await pool.query(
            `UPDATE incidents 
             SET name = $1, type_incident = $2, location_lat = $3, 
                 location_long = $4, radius = $5, notes = $6, 
                 incident_commander = $7, staging_manager = $8, 
                 communications = $9, updated_at = CURRENT_TIMESTAMP,
                 updated_by = $10, location_address = $11
             WHERE incident_id = $12 
             RETURNING *`,
            [
                name, type_incident, location_lat, location_long,
                radius, notes, incident_commander, staging_manager,
                communications, updated_by, location_address, id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating incident:', error);
        res.status(500).json({ error: 'Failed to update incident' });
    }
});

// Close incident
router.post('/:id/close', async (req, res) => {
    try {
        const { id } = req.params;
        const { closed_by, disposition } = req.body;

        const result = await pool.query(
            `UPDATE incidents 
             SET active = FALSE, 
                 closed_at = CURRENT_TIMESTAMP,
                 closed_by = $1,
                 disposition = $2
             WHERE incident_id = $3 
             RETURNING *`,
            [closed_by, disposition, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Incident not found' });
        }

        // Log to audit trail
        await pool.query(
            `INSERT INTO audit_trail (user_email, action, additional_info)
             VALUES ($1, $2, $3)`,
            [
                closed_by,
                'CLOSE_INCIDENT',
                `Closed incident ${id} with disposition: ${disposition}`
            ]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error closing incident:', error);
        res.status(500).json({ error: 'Failed to close incident' });
    }
});

router.post('/close-incident', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { 
            incident_id, 
            disposition, 
            notes, 
            email_requested, 
            email_address,
            created_by_name,
            created_by_userid 
        } = req.body;

        // Insert into closeinc table
        await client.query(
            `INSERT INTO closeinc (
                incident_id, 
                disposition, 
                notes, 
                email_requested, 
                email_address, 
                created_by_name, 
                created_by_userid
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                incident_id, 
                disposition, 
                notes, 
                email_requested, 
                email_address,
                created_by_name,
                created_by_userid
            ]
        );

        // Update incident to inactive
        await client.query(
            `UPDATE incidents 
             SET active = false, 
                 inc_close_datetime = CURRENT_TIMESTAMP 
             WHERE incident_id = $1`,
            [incident_id]
        );

        // Update all drawn items for this incident to inactive
        await client.query(
            `UPDATE drawn_items 
             SET active = false 
             WHERE incident_id = $1`,
            [incident_id]
        );

        await client.query('COMMIT');
        res.json({ success: true });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error closing incident:', error);
        res.status(500).json({ 
            error: 'Failed to close incident',
            details: error.message 
        });
    } finally {
        client.release();
    }
});

module.exports = router; 