const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET vehicles for specific incident
router.get('/incident-vehicles/:incident_id', async (req, res) => {
    const { incident_id } = req.params;
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (vehicle_id) * 
             FROM incident_vehicles 
             WHERE incident_id = $1 AND action != 'exited' 
             ORDER BY vehicle_id, timestamp DESC`, 
            [incident_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching incident vehicles:', error.stack);
        res.status(500).json({ error: 'Failed to fetch incident vehicles.' });
    }
});

// GET assignments
router.get('/assignments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assignments');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments.' });
    }
});

// POST new vehicle/person
router.post('/incident-vehicles', async (req, res) => {
    const { vehicle_id, officer_name, assignment, notes, incident_id } = req.body;

    if (!vehicle_id || !officer_name || !assignment || !incident_id) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO incident_vehicles 
             (vehicle_id, officer_name, assignment, notes, incident_id, action, timestamp, vehicle_type) 
             VALUES ($1, $2, $3, $4, $5, 'entered', NOW(), 'manual') 
             RETURNING *`,
            [vehicle_id, officer_name, assignment, notes, incident_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding new person:', error);
        res.status(500).json({ error: 'Failed to add new person.' });
    }
});

// PATCH update vehicle
router.patch('/incident-vehicles/:vehicle_id', async (req, res) => {
    const { vehicle_id } = req.params;
    const { officer_name, assignment, notes } = req.body;

    try {
        const result = await pool.query(
            `UPDATE incident_vehicles 
             SET officer_name = $1, 
                 assignment = $2, 
                 notes = $3 
             WHERE vehicle_id = $4 AND action != 'exited'
             RETURNING *`,
            [officer_name, assignment, notes || '', decodeURIComponent(vehicle_id)]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Vehicle not found or already exited' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Failed to update vehicle.' });
    }
});

module.exports = router;
