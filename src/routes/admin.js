const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');
const { pool } = require('../db'); // Make sure this points to where your PostgreSQL connection is defined
require('dotenv').config();
const util = require('util');
const execPromise = util.promisify(exec);
const requireAdmin = require('../middleware/adminAuth');

const router = express.Router();

// Setup for file uploads
const upload = multer({ dest: path.join(__dirname, 'csv') });

// Add debug logging for route registration
console.log('Registering admin routes...');

// Apply admin check to all admin routes
router.use(requireAdmin);

// Admin route to add emails to `authorized_emails.txt`
router.post('/add-email', (req, res) => {
    const { email } = req.body;
    const filePath = path.join(__dirname, 'authorized_emails.txt');

    // Append email to the file
    fs.appendFile(filePath, `,${email}`, (err) => {
        if (err) {
            console.error('Failed to add email:', err);
            return res.status(500).json({ error: 'Failed to add email' });
        }
        res.status(200).send('Email added');
    });
});

// Route to get the list of authorized emails
router.get('/emails', (req, res) => {
    const filePath = path.join(__dirname, 'authorized_emails.txt');

    fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
            console.error('Failed to read email list:', err);
            return res.status(500).json({ error: 'Failed to read email list' });
        }
        const emails = data.split(',').map(email => email.trim());
        res.json(emails);
    });
});

// Admin route to upload CSV files
router.post('/upload-csv', upload.single('csvFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'csv', req.file.originalname);

    // Validate CSV file content
    const csvContent = fs.readFileSync(tempPath, 'utf-8');
    const lines = csvContent.split('\n');
    const invalidLines = lines.filter(line => (line.match(/,/g) || []).length !== 4);

    if (invalidLines.length > 0) {
        fs.unlinkSync(tempPath); // Delete the temp file
        return res.status(400).json({ error: 'CSV file contains errors. Each line must have exactly 4 commas.' });
    }

    fs.rename(tempPath, targetPath, (err) => {
        if (err) {
            console.error('Failed to move file:', err);
            return res.status(500).json({ error: 'Failed to upload CSV' });
        }
        res.status(200).send('CSV uploaded successfully');
    });
});

// Admin route to show server logs for merlin.service
router.get('/logs/merlin', (req, res) => {
    exec('journalctl -u merlin.service -n 100 --no-pager', (err, stdout, stderr) => {
        if (err) {
            console.error('Failed to retrieve merlin logs:', stderr);
            return res.status(500).json({ error: 'Failed to retrieve merlin logs' });
        }
        res.send(stdout);
    });
});

// Admin route to show server logs for zello.service
router.get('/logs/zello', (req, res) => {
    exec('journalctl -u zello.service -n 100 --no-pager', (err, stdout, stderr) => {
        if (err) {
            console.error('Failed to retrieve zello logs:', stderr);
            return res.status(500).json({ error: 'Failed to retrieve zello logs' });
        }
        res.send(stdout);
    });
});

// Add new route for FD Locations logs
router.get('/logs/fdlocations', (req, res) => {
    exec('journalctl -u fdlocations.service -n 100 --no-pager', (err, stdout, stderr) => {
        if (err) {
            console.error('Failed to retrieve FD Locations logs:', stderr);
            return res.status(500).json({ error: 'Failed to retrieve FD Locations logs' });
        }
        res.send(stdout);
    });
});

// Function to check service status
function checkServiceStatus(serviceName) {
    return new Promise((resolve) => {
        exec(`systemctl is-active ${serviceName}`, (error, stdout) => {
            if (error) {
                console.error(`Failed to check ${serviceName} service status:`, error);
                resolve({ status: 'inactive' });
            } else {
                resolve({ status: stdout.trim() === 'active' ? 'active' : 'inactive' });
            }
        });
    });
}

// Route to get the status of the Merlin service
router.get('/status/merlin', async (req, res) => {
    const status = await checkServiceStatus('merlin.service');
    res.json(status);
});

// Route to get the status of the Zello service
router.get('/status/zello', async (req, res) => {
    const status = await checkServiceStatus('zello.service');
    res.json(status);
});


// Route to retrieve the last 50 entries from the audit trail
router.get('/audit-trail', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                user_email,
                action,
                additional_info,
                timestamp
            FROM audit_trail 
            ORDER BY timestamp DESC 
            LIMIT 50
        `);
        
        // Add debug logging
        console.log('Audit trail query result:', result.rows);
        
        // Ensure we're sending an array
        if (!Array.isArray(result.rows)) {
            console.error('Query result is not an array:', result.rows);
            return res.json([]); // Send empty array as fallback
        }
        
        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to retrieve audit trail:', error);
        return res.status(500).json({ error: 'Failed to retrieve audit trail' });
    }
});

// Get all users with their permissions
router.get('/users/permissions', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        // Get total count for pagination
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM users 
             WHERE email ILIKE $1 OR name ILIKE $1`,
            [`%${search}%`]
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        const result = await pool.query(
            `SELECT id, email, name, permissions, last_login 
             FROM users 
             WHERE email ILIKE $1 OR name ILIKE $1
             ORDER BY last_login DESC NULLS LAST
             LIMIT $2 OFFSET $3`,
            [`%${search}%`, limit, offset]
        );

        res.json({
            users: result.rows,
            total: total
        });
    } catch (error) {
        console.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user permissions
router.post('/users/permissions', async (req, res) => {
    const { userId, permission, value } = req.body;
    
    try {
        // Get current permissions and user email
        const beforeUpdate = await pool.query(
            'SELECT permissions, email FROM users WHERE id = $1', 
            [userId]
        );
        
        if (!beforeUpdate.rows[0]) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Convert string 'true'/'false' to boolean if needed
        const boolValue = value === true || value === 'true';
        
        // Update the permission using proper JSON handling
        const result = await pool.query(
            `UPDATE users 
            SET permissions = jsonb_set(
                COALESCE(permissions::jsonb, '{}'::jsonb),
                ARRAY[$2],
                $3::jsonb
            )
            WHERE id = $1
            RETURNING permissions`,
            [userId, permission, JSON.stringify(boolValue)]
        );

        // Log to audit trail
        await pool.query(
            `INSERT INTO audit_trail (
                user_email,
                action,
                additional_info
            ) VALUES ($1, $2, $3)`,
            [
                req.session?.user?.userEmail || 'system',
                'permission_update',
                `Permission "${permission}" changed to ${boolValue} for user ${beforeUpdate.rows[0].email}`
            ]
        );

        // Return the updated permissions
        res.json({ 
            success: true,
            message: 'Permission updated successfully',
            permissions: result.rows[0].permissions
        });
    } catch (error) {
        console.error('Failed to update permission:', error);
        res.status(500).json({ 
            error: 'Failed to update permission',
            details: error.message 
        });
    }
});

// Add these new routes to handle database management

// Update the table and column mapping to match your database structure
const tableConfig = {
    assignments: {
        table: 'assignments',
        nameColumn: 'name',    
        idColumn: 'id'         
    }
    // removed incidentTypes and dispositions since they're now in incidents route
};

// Get all items of a specific type
router.get('/database/:type', async (req, res) => {
    const { type } = req.params;
    
    const config = tableConfig[type];
    if (!config) {
        console.error('Invalid type requested:', type);
        return res.status(400).json({ error: 'Invalid type' });
    }

    try {
        const result = await pool.query(
            `SELECT ${config.idColumn} as id, ${config.nameColumn} as name 
             FROM "${config.table}" 
             ORDER BY ${config.nameColumn}`
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error(`Failed to fetch ${type}:`, error);
        res.status(500).json({ 
            error: `Failed to fetch ${type}`,
            details: error.message
        });
    }
});

// Update item
router.put('/database/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const { name } = req.body;
    
    const config = tableConfig[type];
    if (!config) {
        return res.status(400).json({ error: 'Invalid type' });
    }

    try {
        const result = await pool.query(
            `UPDATE "${config.table}" 
             SET ${config.nameColumn} = $1 
             WHERE ${config.idColumn} = $2 
             RETURNING ${config.idColumn} as id, ${config.nameColumn} as name`,
            [name, id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Failed to update ${type}:`, error);
        res.status(500).json({ error: `Failed to update ${type}` });
    }
});

// Add new item
router.post('/database/:type', async (req, res) => {
    const { type } = req.params;
    const { name } = req.body;
    
    const config = tableConfig[type];
    if (!config) {
        return res.status(400).json({ error: 'Invalid type' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO "${config.table}" (${config.nameColumn}) 
             VALUES ($1) 
             RETURNING ${config.idColumn} as id, ${config.nameColumn} as name`,
            [name]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Failed to add ${type}:`, error);
        res.status(500).json({ error: `Failed to add ${type}` });
    }
});

// Delete item
router.delete('/database/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    
    const config = tableConfig[type];
    if (!config) {
        return res.status(400).json({ error: 'Invalid type' });
    }

    try {
        await pool.query(
            `DELETE FROM "${config.table}" 
             WHERE ${config.idColumn} = $1`,
            [id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error(`Failed to delete ${type}:`, error);
        res.status(500).json({ error: `Failed to delete ${type}` });
    }
});

// Add these new routes for service management
router.post('/restart/:service', async (req, res) => {
    const { service } = req.params;
    const validServices = ['merlin', 'zello', 'fdlocations'];
    
    if (!validServices.includes(service)) {
        return res.status(400).json({ error: 'Invalid service name' });
    }

    try {
        console.log(`Attempting to restart ${service} service...`);
        
        const serviceMap = {
            merlin: 'merlin',
            zello: 'zello',
            fdlocations: 'fdlocations'
        };

        const actualServiceName = serviceMap[service];
        console.log(`Using service name: ${actualServiceName}`);

        // Execute the restart command
        await execPromise(`sudo systemctl restart ${actualServiceName}.service 2>&1`);
        
        // Wait longer for the service to start (10 seconds max)
        let status = 'unknown';
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            try {
                const statusResult = await execPromise(`systemctl is-active ${actualServiceName}.service`);
                status = statusResult.stdout.trim();
                
                console.log(`Attempt ${attempts + 1}: Service ${actualServiceName} status: ${status}`);
                
                if (status === 'active') {
                    break;
                } else if (status === 'failed') {
                    throw new Error('Service failed to start');
                }
                
                // Wait 1 second before next check
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            } catch (error) {
                console.error(`Error checking service status (attempt ${attempts + 1}):`, error);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (status !== 'active') {
            throw new Error(`Service failed to become active after ${maxAttempts} attempts. Final status: ${status}`);
        }

        res.json({ 
            success: true, 
            message: `${service} service restarted successfully`,
            status: status
        });
    } catch (error) {
        console.error(`Failed to restart ${service}:`, error);
        res.status(500).json({ 
            error: `Failed to restart ${service}`,
            details: error.message
        });
    }
});

// Add a route to check service status
router.get('/status/:service', async (req, res) => {
    const { service } = req.params;
    const validServices = ['merlin', 'zello', 'fdlocations'];
    
    if (!validServices.includes(service)) {
        return res.status(400).json({ error: 'Invalid service name' });
    }

    try {
        const { stdout } = await execPromise(`systemctl is-active ${service}.service`);
        res.json({ status: stdout.trim() });
    } catch (error) {
        console.error(`Failed to check ${service} status:`, error);
        res.status(500).json({ 
            error: `Failed to check ${service} status`,
            details: error.message
        });
    }
});

// Add a test route to verify routing is working
router.get('/test', (req, res) => {
    res.json({ message: 'Admin routes are working' });
});

// Add a new route to get both service logs and audit logs
router.get('/all-logs', async (req, res) => {
    try {
        // Get service logs
        const merlinLogs = await execPromise('journalctl -u merlin.service -n 100 --no-pager');
        const zelloLogs = await execPromise('journalctl -u zello.service -n 100 --no-pager');
        const fdLocationsLogs = await execPromise('journalctl -u fdlocations.service -n 100 --no-pager');

        // Get audit logs
        const auditResult = await pool.query(`
            SELECT 
                id,
                user_email,
                action,
                additional_info,
                to_char(timestamp, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
            FROM audit_trail 
            ORDER BY timestamp DESC 
            LIMIT 50
        `);

        res.json({
            merlin: merlinLogs.stdout,
            zello: zelloLogs.stdout,
            fdlocations: fdLocationsLogs.stdout,
            audit: auditResult.rows
        });
    } catch (error) {
        console.error('Failed to retrieve logs:', error);
        res.status(500).json({ error: 'Failed to retrieve logs' });
    }
});

// Get mobile follow logs (admin only)
router.get('/logs/mobile-follows', async (req, res) => {
    try {
        // Get pagination parameters
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        
        // Get total count for pagination
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM mobile_follow_logs'
        );
        
        // Get paginated logs
        const logsResult = await pool.query(
            `SELECT * FROM mobile_follow_logs 
             ORDER BY timestamp DESC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        
        res.json({
            logs: logsResult.rows,
            total: parseInt(countResult.rows[0].count),
            limit,
            offset
        });
    } catch (error) {
        console.error('Error retrieving mobile follow logs:', error);
        
        // If table doesn't exist yet, return empty results
        if (error.code === '42P01') { // undefined_table
            return res.json({
                logs: [],
                total: 0,
                limit: 100,
                offset: 0,
                message: 'Mobile follow logs table does not exist yet'
            });
        }
        
        res.status(500).json({ error: 'Failed to retrieve mobile follow logs' });
    }
});

// Export mobile follow logs as CSV
router.get('/logs/mobile-follows/export', async (req, res) => {
    try {
        // Check if table exists
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'mobile_follow_logs'
            )
        `);
        
        if (!tableExists.rows[0].exists) {
            return res.status(404).json({ error: 'Mobile follow logs table does not exist yet' });
        }
        
        // Get all logs ordered by timestamp
        const result = await pool.query(
            `SELECT 
                id,
                follower_email,
                follower_name,
                followed_vehicle,
                timestamp
             FROM mobile_follow_logs 
             ORDER BY timestamp DESC`
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No mobile follow logs found' });
        }
        
        // Create CSV header
        let csv = 'ID,Follower Email,Follower Name,Followed Vehicle,Timestamp\n';
        
        // Add each row
        result.rows.forEach(log => {
            const timestamp = new Date(log.timestamp).toISOString();
            
            // Escape fields that might contain commas
            const followerName = log.follower_name ? `"${log.follower_name.replace(/"/g, '""')}"` : '';
            const followedVehicle = `"${log.followed_vehicle.replace(/"/g, '""')}"`;
            
            csv += `${log.id},${log.follower_email},${followerName},${followedVehicle},${timestamp}\n`;
        });
        
        // Set response headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=mobile_follow_logs.csv');
        
        res.status(200).send(csv);
    } catch (error) {
        console.error('Error exporting mobile follow logs:', error);
        res.status(500).json({ error: 'Failed to export mobile follow logs' });
    }
});

module.exports = router;