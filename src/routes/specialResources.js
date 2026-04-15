const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const moment = require('moment-timezone');

// Middleware to ensure user is authenticated
const requireUser = (req, res, next) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) {
        return res.status(401).json({ error: 'Unauthorized: Missing user email' });
    }
    req.userEmail = userEmail;
    next();
};

// Middleware to ensure user is an admin
const requireAdmin = async (req, res, next) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) {
            return res.status(401).json({ error: 'Unauthorized: Missing user email' });
        }
        
        // Check for admin permissions
        const userCheck = await pool.query(
            `SELECT permissions FROM users WHERE email = $1`,
            [userEmail]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }
        
        const isAdmin = userCheck.rows[0].permissions && userCheck.rows[0].permissions.admin;
        
        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin permission required' });
        }
        
        req.userEmail = userEmail;
        next();
    } catch (error) {
        console.error('Error checking admin status:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};

// Get all special resource categories
router.get('/categories', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, description FROM special_resource_categories ORDER BY name'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching special resource categories:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Admin - Add a new category
router.post('/categories', requireAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        
        // Check if category with this name already exists
        const existingCheck = await pool.query(
            'SELECT id FROM special_resource_categories WHERE LOWER(name) = LOWER($1)',
            [name]
        );
        
        if (existingCheck.rows.length > 0) {
            return res.status(400).json({ error: 'A category with this name already exists' });
        }
        
        // Create the new category
        const result = await pool.query(
            `INSERT INTO special_resource_categories (name, description)
             VALUES ($1, $2)
             RETURNING id, name, description`,
            [name, description || '']
        );
        
        res.status(201).json({
            message: 'Category created successfully',
            category: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating special resource category:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Admin - Update a category
router.put('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, description } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        
        // Check if the category exists
        const existingCheck = await pool.query(
            'SELECT id FROM special_resource_categories WHERE id = $1',
            [categoryId]
        );
        
        if (existingCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Check if the new name conflicts with any other category
        const nameCheck = await pool.query(
            'SELECT id FROM special_resource_categories WHERE LOWER(name) = LOWER($1) AND id != $2',
            [name, categoryId]
        );
        
        if (nameCheck.rows.length > 0) {
            return res.status(400).json({ error: 'Another category with this name already exists' });
        }
        
        // Update the category
        const result = await pool.query(
            `UPDATE special_resource_categories 
             SET name = $1, description = $2 
             WHERE id = $3
             RETURNING id, name, description`,
            [name, description || '', categoryId]
        );
        
        res.json({
            message: 'Category updated successfully',
            category: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating special resource category:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Admin - Delete a category
router.delete('/categories/:id', requireAdmin, async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Check if there are resources using this category
        const resourceCheck = await pool.query(
            'SELECT COUNT(*) FROM special_resources WHERE category_id = $1',
            [categoryId]
        );
        
        const resourceCount = parseInt(resourceCheck.rows[0].count);
        
        if (resourceCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category that is in use',
                resourceCount: resourceCount
            });
        }
        
        // Check if the category exists
        const existingCheck = await pool.query(
            'SELECT id FROM special_resource_categories WHERE id = $1',
            [categoryId]
        );
        
        if (existingCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }
        
        // Delete the category
        await pool.query(
            'DELETE FROM special_resource_categories WHERE id = $1',
            [categoryId]
        );
        
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting special resource category:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get all active special resources
router.get('/', async (req, res) => {
    try {
        // Convert query parameters to boolean
        const includeInactive = req.query.includeInactive === 'true';
        
        let query = `
            SELECT 
                sr.id, 
                sr.user_id, 
                sr.user_email, 
                sr.user_name, 
                sr.department, 
                sr.category_id, 
                src.name AS category_name,
                sr.skill_description, 
                sr.tour_start, 
                sr.tour_end, 
                sr.is_active,
                sr.created_at,
                sr.updated_at
            FROM 
                special_resources sr
            JOIN 
                special_resource_categories src ON sr.category_id = src.id
        `;
        
        // Add where clause if we only want active resources
        if (!includeInactive) {
            query += ` WHERE sr.is_active = TRUE AND sr.tour_end > NOW() `;
        }
        
        query += ` ORDER BY sr.tour_end ASC`;
        
        const result = await pool.query(query);
        
        // Convert timestamps to EST
        const resources = result.rows.map(resource => ({
            ...resource,
            tour_start_est: moment(resource.tour_start).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'),
            tour_end_est: moment(resource.tour_end).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')
        }));
        
        res.json(resources);
    } catch (error) {
        console.error('Error fetching special resources:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Add a new special resource
router.post('/', requireUser, async (req, res) => {
    try {
        const {
            user_id,
            user_name,
            department,
            category_id,
            skill_description,
            tour_start,
            tour_end
        } = req.body;
        
        // Validation
        if (!user_id || !user_name || !department || !category_id || !tour_start || !tour_end) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Check if category exists
        const categoryCheck = await pool.query(
            'SELECT id FROM special_resource_categories WHERE id = $1',
            [category_id]
        );
        
        if (categoryCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid category ID' });
        }
        
        // Parse and validate tour times
        const startTime = moment.tz(tour_start, 'America/New_York');
        const endTime = moment.tz(tour_end, 'America/New_York');
        
        if (!startTime.isValid() || !endTime.isValid()) {
            return res.status(400).json({ error: 'Invalid date/time format' });
        }
        
        if (endTime.isBefore(startTime)) {
            return res.status(400).json({ error: 'Tour end time must be after start time' });
        }
        
        // Insert the new resource
        const result = await pool.query(
            `INSERT INTO special_resources (
                user_id,
                user_email,
                user_name,
                department,
                category_id,
                skill_description,
                tour_start,
                tour_end,
                is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            RETURNING id`,
            [
                user_id,
                req.userEmail,
                user_name,
                department,
                category_id,
                skill_description,
                startTime.toISOString(),
                endTime.toISOString()
            ]
        );
        
        res.status(201).json({ 
            id: result.rows[0].id,
            message: 'Special resource added successfully' 
        });
    } catch (error) {
        console.error('Error adding special resource:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Update a special resource (only the owner or admin can update)
router.put('/:id', requireUser, async (req, res) => {
    try {
        const resourceId = req.params.id;
        const userEmail = req.userEmail;
        const isAdmin = req.headers['x-is-admin'] === 'true';
        
        // Check if the resource exists
        const resourceCheck = await pool.query(
            `SELECT user_email FROM special_resources WHERE id = $1`,
            [resourceId]
        );
        
        if (resourceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Resource not found' });
        }
        
        // Skip owner check if user is admin
        if (!isAdmin && resourceCheck.rows[0].user_email !== userEmail) {
            // If not admin and not the owner, check if they're an admin in DB
            const userCheck = await pool.query(
                `SELECT permissions FROM users WHERE email = $1`,
                [userEmail]
            );
            
            const isDbAdmin = userCheck.rows.length > 0 && userCheck.rows[0].permissions && userCheck.rows[0].permissions.admin;
            
            // If not the owner and not an admin, unauthorized
            if (!isDbAdmin) {
                return res.status(403).json({ error: 'You are not authorized to update this resource' });
            }
        }
        
        // Destructure request body
        const {
            department,
            category_id,
            skill_description,
            tour_start,
            tour_end,
            is_active
        } = req.body;
        
        // Build update fields and values
        const updates = [];
        const values = [];
        let paramCounter = 1;
        
        if (department) {
            updates.push(`department = $${paramCounter++}`);
            values.push(department);
        }
        
        if (category_id) {
            updates.push(`category_id = $${paramCounter++}`);
            values.push(category_id);
        }
        
        if (skill_description !== undefined) {
            updates.push(`skill_description = $${paramCounter++}`);
            values.push(skill_description);
        }
        
        if (tour_start) {
            const startTime = moment.tz(tour_start, 'America/New_York');
            if (startTime.isValid()) {
                updates.push(`tour_start = $${paramCounter++}`);
                values.push(startTime.toISOString());
            } else {
                return res.status(400).json({ error: 'Invalid tour start time format' });
            }
        }
        
        if (tour_end) {
            const endTime = moment.tz(tour_end, 'America/New_York');
            if (endTime.isValid()) {
                updates.push(`tour_end = $${paramCounter++}`);
                values.push(endTime.toISOString());
            } else {
                return res.status(400).json({ error: 'Invalid tour end time format' });
            }
        }
        
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCounter++}`);
            values.push(is_active);
        }
        
        // If no updates, return success
        if (updates.length === 0) {
            return res.json({ message: 'No changes required' });
        }
        
        // Add the ID as the last parameter
        values.push(resourceId);
        
        // Execute the update
        await pool.query(
            `UPDATE special_resources SET ${updates.join(', ')} WHERE id = $${paramCounter}`,
            values
        );
        
        res.json({ message: 'Special resource updated successfully' });
    } catch (error) {
        console.error('Error updating special resource:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Delete/deactivate a special resource
router.delete('/:id', requireUser, async (req, res) => {
    try {
        const resourceId = req.params.id;
        const userEmail = req.userEmail;
        const isAdmin = req.headers['x-is-admin'] === 'true';
        
        // Check if the resource exists
        const resourceCheck = await pool.query(
            `SELECT user_email FROM special_resources WHERE id = $1`,
            [resourceId]
        );
        
        if (resourceCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Resource not found' });
        }
        
        // Skip owner check if user is admin
        if (!isAdmin && resourceCheck.rows[0].user_email !== userEmail) {
            // If not admin and not the owner, check if they're an admin in DB
            const userCheck = await pool.query(
                `SELECT permissions FROM users WHERE email = $1`,
                [userEmail]
            );
            
            const isDbAdmin = userCheck.rows.length > 0 && userCheck.rows[0].permissions && userCheck.rows[0].permissions.admin;
            
            // If not the owner and not an admin, unauthorized
            if (!isDbAdmin) {
                return res.status(403).json({ error: 'You are not authorized to delete this resource' });
            }
        }
        
        // Soft delete by marking inactive
        await pool.query(
            `UPDATE special_resources SET is_active = FALSE WHERE id = $1`,
            [resourceId]
        );
        
        res.json({ message: 'Special resource deactivated successfully' });
    } catch (error) {
        console.error('Error deleting special resource:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Get special resources for a specific user
router.get('/user/:userEmail', requireUser, async (req, res) => {
    try {
        const targetUserEmail = req.params.userEmail;
        const requestingUserEmail = req.userEmail;
        
        // Check if the user has permission to view this data
        if (targetUserEmail !== requestingUserEmail) {
            // Check if requesting user is admin
            const userCheck = await pool.query(
                `SELECT permissions FROM users WHERE email = $1`,
                [requestingUserEmail]
            );
            
            const isAdmin = userCheck.rows.length > 0 && userCheck.rows[0].permissions && userCheck.rows[0].permissions.admin;
            
            if (!isAdmin) {
                return res.status(403).json({ error: 'Unauthorized to view other users\' resources' });
            }
        }
        
        // Fetch the resources
        const result = await pool.query(
            `SELECT 
                sr.id, 
                sr.user_id, 
                sr.user_email, 
                sr.user_name, 
                sr.department, 
                sr.category_id, 
                src.name AS category_name,
                sr.skill_description, 
                sr.tour_start, 
                sr.tour_end, 
                sr.is_active,
                sr.created_at,
                sr.updated_at
            FROM 
                special_resources sr
            JOIN 
                special_resource_categories src ON sr.category_id = src.id
            WHERE 
                sr.user_email = $1
            ORDER BY 
                sr.tour_end DESC`,
            [targetUserEmail]
        );
        
        // Convert timestamps to EST
        const resources = result.rows.map(resource => ({
            ...resource,
            tour_start_est: moment(resource.tour_start).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss'),
            tour_end_est: moment(resource.tour_end).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss')
        }));
        
        res.json(resources);
    } catch (error) {
        console.error('Error fetching user special resources:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Scheduled job route to mark expired resources as inactive
router.post('/cleanup', async (req, res) => {
    try {
        // This requires an API key to prevent unauthorized access
        const apiKey = req.headers['x-api-key'];
        const configuredApiKey = process.env.SPECIAL_RESOURCES_API_KEY;
        
        if (!apiKey || apiKey !== configuredApiKey) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Mark all expired resources as inactive
        const result = await pool.query(
            `UPDATE special_resources 
             SET is_active = FALSE 
             WHERE is_active = TRUE AND tour_end < NOW() 
             RETURNING id`
        );
        
        res.json({ 
            message: 'Cleanup completed successfully', 
            deactivatedCount: result.rows.length,
            deactivatedIds: result.rows.map(row => row.id)
        });
    } catch (error) {
        console.error('Error cleaning up expired resources:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router; 