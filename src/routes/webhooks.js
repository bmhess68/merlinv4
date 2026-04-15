const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../db');
const bodyParser = require('body-parser');

// Use raw body parser for this route to verify Slack signatures
router.use(bodyParser.raw({ type: 'application/json' }));

/**
 * Verifies that the request came from Slack
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the request is valid
 */
function verifySlackRequest(req) {
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    if (!slackSigningSecret) {
        console.error('SLACK_SIGNING_SECRET is not set in environment variables');
        return false;
    }

    const slackSignature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    
    // Prevent replay attacks
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) {
        console.error('Slack webhook timestamp too old');
        return false;
    }
    
    // Create signature to compare with Slack's
    const sigBasestring = `v0:${timestamp}:${req.body.toString()}`;
    const mySignature = 'v0=' + crypto
        .createHmac('sha256', slackSigningSecret)
        .update(sigBasestring)
        .digest('hex');
        
    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(mySignature, 'utf8'),
            Buffer.from(slackSignature, 'utf8')
        );
    } catch (e) {
        console.error('Error comparing signatures:', e);
        return false;
    }
}

/**
 * Store notification in database and broadcast to all connected clients
 */
async function processNotification(message) {
    try {
        // 1. Store in database
        const result = await pool.query(
            `INSERT INTO notifications (
                type, sender, message, timestamp, expires_at
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id`,
            [
                'emergency', 
                message.user,
                message.text,
                new Date(), 
                new Date(Date.now() + message.duration)
            ]
        );
        
        const notificationId = result.rows[0].id;
        
        // 2. Broadcast to all connected clients
        const io = global.io;
        if (io) {
            io.emit('emergency_notification', {
                id: notificationId,
                ...message
            });
            
            // Log broadcast
            console.log(`Emergency notification #${notificationId} broadcast to all clients`);
        } else {
            console.error('Socket.io instance not available for broadcasting');
        }
        
        // 3. Return success with ID
        return { 
            success: true,
            notificationId 
        };
    } catch (error) {
        console.error('Error processing notification:', error);
        throw error;
    }
}

// Main webhook endpoint
router.post('/slack', async (req, res) => {
    try {
        // Skip signature verification if flag is set, regardless of environment
        const skipVerification = process.env.SKIP_SLACK_VERIFICATION === 'true';
        
        if (!skipVerification && !verifySlackRequest(req)) {
            return res.status(401).json({ error: 'Invalid request signature' });
        }
        
        // Parse the message payload
        const payload = JSON.parse(req.body.toString());
        console.log('Received webhook payload:', payload);
        
        // Extract text content based on Slack's format
        // This handles both slash commands and app interactions
        let messageText = '';
        let userName = 'Dispatch';
        
        if (payload.command && payload.text) {
            // Slash command format
            messageText = payload.text;
            userName = payload.user_name || 'Dispatch';
        } else if (payload.event && payload.event.text) {
            // Event API format
            messageText = payload.event.text;
            userName = payload.event.user || 'Dispatch';
        } else if (payload.payload) {
            // Interactive component or modal
            const parsedPayload = typeof payload.payload === 'string' 
                ? JSON.parse(payload.payload) 
                : payload.payload;
            messageText = parsedPayload.message || parsedPayload.text || 'Emergency Alert';
            userName = parsedPayload.user?.name || 'Dispatch';
        } else {
            // Default fallback
            messageText = payload.text || payload.message || 'Emergency Alert';
            userName = payload.user_name || payload.user?.name || 'Dispatch';
        }
        
        // Create standardized message object
        const message = {
            text: messageText,
            user: userName,
            timestamp: new Date().toISOString(),
            type: 'emergency_notification',
            duration: 60000 // 60 seconds in milliseconds
        };
        
        // Process and broadcast the notification
        const result = await processNotification(message);
        
        // Respond to Slack
        res.status(200).json({ 
            message: 'Notification received and broadcast to all users',
            notificationId: result.notificationId
        });
        
    } catch (error) {
        console.error('Error processing Slack webhook:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get active notifications
router.get('/active', async (req, res) => {
    try {
        const notifications = await pool.query(
            `SELECT * FROM notifications 
             WHERE expires_at > NOW() 
             ORDER BY timestamp DESC 
             LIMIT 10`
        );
        
        res.status(200).json(notifications.rows);
    } catch (error) {
        console.error('Error fetching active notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;