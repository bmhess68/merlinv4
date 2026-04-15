const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const cors = require('cors');
const cron = require('node-cron');
const Redis = require('ioredis');
const moment = require('moment');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config();
const fetch = require('node-fetch');
const turf = require('@turf/turf');
const { pool } = require('./db');
const adminRoutes = require('./routes/admin');
const rosterApi = require('./routes/roster');
const addressSearchRoutes = require('./routes/addressSearch');
const weatherRoutes = require('./routes/weather');
const incidentRoutes = require('./routes/incidents');
const markerRoutes = require('./routes/markers');
const drawnItemRoutes = require('./routes/drawnItems');
const pgSession = require('connect-pg-simple')(session);
const http = require('http');
const socketIo = require('socket.io');
const cadService = require('./services/cadService');
const { checkEmails } = require('./services/cadService');
const { checkAndStartVehicleProcessing, processVehicles } = require('./vehicleTracker');
const corsOptions = require('./config/cors');
const securityHeaders = require('./middleware/security');
const allowLocalhost = require('./middleware/localAuth');
const requireAuth = require('./middleware/auth');
const { logAuditInfo, extractUserFromReferer } = require('./services/auditService');
const { getCSVFiles, processCSVFile } = require('./services/csvService');
const csvRoutes = require('./routes/csv');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const tempMarkersRouter = require('./routes/tempMarkers');
const slackEventsRouter = require('./routes/slackEvents');
const slackFilesRouter = require('./routes/slackFiles');
const reverseGeocodeRouter = require('./routes/reverseGeocode');
const specialResourcesRouter = require('./routes/specialResources');

let locationsData = {}; 

// Global variables for location data
let currentLocationData = null;  // For police
let currentFDLocationData = null;  // For Fire/EMS

// Move these lines before any app.use() calls
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Make io available globally
global.io = io;

// Now the rest of your middleware and routes can use 'app'
app.use(cors(corsOptions));
app.use(securityHeaders);

// Removed the raw body parser for Slack webhook verification since we're not using it

// Standard JSON parser for all routes
app.use(express.json({ limit: '5mb' }));

// 3. Session middleware
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your-fallback-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 3 * 24 * 60 * 60 * 1000, //3 days
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
    },
    name: 'merlin.sid'
}));

// 4. Security headers
app.use((req, res, next) => {
    res.set({
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block'
    });
    next();
});

// 5. Debug middleware
app.use((req, res, next) => {
    // Only log session issues or errors
    if (!req.session || !req.sessionID) {
        console.log('Session Debug: Missing session or sessionID', {
            path: req.path,
            hasSession: !!req.session
        });
    }
    next();
});

// 7. Apply authentication to protected API routes
app.use('/api', requireAuth);

// 8. Webhooks that bypass auth (Removed the duplicate direct implementation)

// 9. Keep the location endpoints with allowLocalhost middleware
app.post('/FDLocations', allowLocalhost, async (req, res) => {
    try {
        console.log('POST /FDLocations - Received data:', {
            hasData: !!req.body,
            type: req.body?.type,
            featureCount: req.body?.features?.length
        });
        currentFDLocationData = req.body;
        await processVehicles(currentFDLocationData, 'fd');
        res.status(200).json({ message: 'FD location data updated successfully' });
    } catch (error) {
        console.error('Error processing FD location data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/locations', allowLocalhost, async (req, res) => {
    try {
        console.log('POST /locations - Received data:', {
            hasData: !!req.body,
            type: req.body?.type,
            featureCount: req.body?.features?.length
        });
        currentLocationData = req.body;
        await processVehicles(currentLocationData, 'police');
        res.status(200).json({ message: 'Location data updated successfully' });
    } catch (error) {
        console.error('Error processing location data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Then define your routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roster', rosterApi);
app.use('/api/weather', weatherRoutes);
app.use('/api/markers', markerRoutes);
app.use('/api/drawn-items', drawnItemRoutes);
app.use('/api/address-search', addressSearchRoutes);
app.use('/api/special-resources', specialResourcesRouter);

// Add Slack Events Router
app.use('/slack', slackEventsRouter);
app.use('/slack/files', slackFilesRouter);

const { Issuer } = require('openid-client');

// Set up Slack OpenID Connect
Issuer.discover('https://slack.com/.well-known/openid-configuration').then(slackIssuer => {
  const client = new slackIssuer.Client({
      client_id: process.env.SLACK_CLIENT_ID,
      client_secret: process.env.SLACK_CLIENT_SECRET,
      redirect_uris: [process.env.SLACK_REDIRECT_URI],
      response_types: ['code'],
      scope: 'openid email profile'
  });

  const params = {
      scope: 'openid profile email', // Only these scopes
  };

  app.get('/login', async (req, res) => {
    try {
        // Log login attempt before redirect
        await pool.query(
            `INSERT INTO audit_trail (
                user_email,
                action,
                additional_info,
                timestamp
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
            [
                'Unknown',
                'LOGIN_ATTEMPT',
                JSON.stringify({
                    method: 'Slack OAuth',
                    attemptTime: new Date(),
                    userAgent: req.headers['user-agent'],
                    ipAddress: req.ip
                })
            ]
        );

        const authUrl = client.authorizationUrl(params);
        res.redirect(authUrl);
    } catch (error) {
        console.error('Login attempt logging failed:', error);
        res.redirect('/error.html');
    }
  });

  app.get('/oauth/callback', (req, res) => {
    console.log('OAuth callback received from Slack');
    
    client.callback(
        process.env.SLACK_REDIRECT_URI,
        client.callbackParams(req)
    )
    .then(async tokenSet => {
        try {
            const claims = tokenSet.claims();
            const userInfo = await client.userinfo(tokenSet.access_token);
            
            // First, try to create/update the user
            const updateUserResult = await pool.query(
                `INSERT INTO users (
                    email, 
                    name, 
                    slack_id, 
                    last_login
                ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (email) 
                DO UPDATE SET 
                    name = EXCLUDED.name,
                    slack_id = EXCLUDED.slack_id,
                    last_login = CURRENT_TIMESTAMP
                RETURNING permissions, slack_id`,
                [
                    userInfo.email,
                    userInfo.name,
                    claims['https://slack.com/user_id']
                ]
            );

            // Now get the user data including permissions
            const userData = {
                userId: claims['https://slack.com/user_id'],
                userEmail: userInfo.email,
                userName: userInfo.name,
                userAvatar: claims.picture || '',
                permissions: updateUserResult.rows[0].permissions
            };

            // Set user session
            req.session.user = userData;

            // Log successful login
            await pool.query(
                `INSERT INTO audit_trail (
                    user_email,
                    action,
                    additional_info,
                    timestamp
                ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                [
                    userInfo.email,
                    'LOGIN_SUCCESS',
                    JSON.stringify({
                        method: 'Slack OAuth',
                        userAgent: req.headers['user-agent'],
                        ipAddress: req.ip
                    })
                ]
            );

            const encodedUser = encodeURIComponent(JSON.stringify(userData));
            return res.redirect(`/map?user=${encodedUser}`);

        } catch (error) {
            console.error('Error processing user info:', error);
            return res.redirect('/login?error=user_info_failed');
        }
    })
    .catch(err => {
        console.error('OAuth callback error:', err);
        return res.redirect('/login?error=authentication_failed');
    });
});
app.get('/api/user/permissions', async (req, res) => {
    try {
        // Get user email from header
        const userEmail = req.headers['x-user-email'];
        
        if (!userEmail) {
            console.log('No user email in headers');
            return res.status(401).json({ 
                error: 'Not authenticated',
                debug: {
                    hasSession: !!req.session,
                    sessionContent: req.session
                }
            });
        }

        // Get user permissions from database
        const result = await pool.query(
            'SELECT permissions FROM users WHERE email = $1',
            [userEmail]
        );

        if (!result.rows[0]) {
            console.log('No user found for email:', userEmail);
            return res.status(404).json({ error: 'User not found' });
        }

        // Store in session and return
        req.session.user = {
            userEmail: userEmail,
            permissions: result.rows[0].permissions
        };

        res.json({
            permissions: result.rows[0].permissions
        });

    } catch (error) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
  // Serve static files from the React app build
app.use(express.static(path.join(__dirname, '..','build')));

// Serve the React app for all other requests
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});
// Define the error route separately if needed
app.get('/error.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'error.html'));
});
});
//CSV import and file

// CSV routes
app.use('/api/csv', csvRoutes);

// Route to receive data from the Python script
app.post('/api/locations', (req, res) => {
  const locationsData = req.body;
  if (!locationsData || !locationsData.vehicles || !locationsData.incidents) {
      console.error('Invalid locationsData received:', locationsData);
      return res.status(400).send('Invalid data');
  }

  checkVehiclePositions(locationsData)
      .then(() => res.status(200).send('Data received'))
      .catch(error => {
          console.error('Error in /api/locations route:', error.message);
          res.status(500).send('Server error');
      });
});

// Apply the middleware to the locations endpoint
app.get('/locations', allowLocalhost, (req, res) => {
    console.log('GET /locations - Current location data:', {
        hasData: !!currentLocationData,
        type: currentLocationData?.type,
        featureCount: currentLocationData?.features?.length
    });
    res.json(currentLocationData || { type: 'FeatureCollection', features: [] });
});

app.post('/update-locations', allowLocalhost, (req, res) => {
    try {
        const newLocationData = req.body;
        const oldFeatureCount = currentLocationData?.features?.length || 0;
        const newFeatureCount = newLocationData?.features?.length || 0;

        // Only log if the feature count has changed
        if (oldFeatureCount !== newFeatureCount) {
            console.log('Location data updated:', {
                previousFeatures: oldFeatureCount,
                newFeatures: newFeatureCount,
                timestamp: new Date().toISOString()
            });
        }

        currentLocationData = newLocationData;
        res.status(200).send('Locations data updated');
    } catch (error) {
        console.error('Error updating locations data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update the vehicle endpoint
app.post('/vehicle', async (req, res) => {
  try {
    const { vehicles } = req.body;

    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid vehicle data provided',
        received: req.body 
      });
    }

    // Validate each vehicle's data
    for (const vehicle of vehicles) {
      if (!vehicle.displayName || 
          typeof vehicle.latitude !== 'number' || 
          typeof vehicle.longitude !== 'number') {
        return res.status(400).json({
          error: 'Invalid vehicle format',
          vehicle: vehicle
        });
      }
    }

    // Process vehicles and check against active incidents
    const result = await processVehicles(vehicles);
    
    res.status(200).json({
      message: 'Vehicle data processed successfully',
      processedCount: vehicles.length,
      result: result
    });

  } catch (error) {
    console.error('Error processing vehicle data:', error);
    res.status(500).json({ 
      error: 'Server error', 
      details: error.message 
    });
  }
});
  
// Update the SSE endpoint with better error handling
app.get('/sse/vehicles', async (req, res) => {
    try {
        // Get user email from query parameter
        const userEmail = req.query.userEmail;
        // Add mobileMode parameter check
        const mobileMode = req.query.mobileMode === 'true';
        
        if (!userEmail) {
            console.log('No user email in query');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // Get user permissions from database
        const result = await pool.query(
            'SELECT permissions FROM users WHERE email = $1',
            [userEmail]
        );

        if (!result.rows[0]) {
            console.log('No user found for email:', userEmail);
            return res.status(403).json({ error: 'User not found' });
        }

        const userPermissions = result.rows[0].permissions;
        
        // Modified permission check to bypass if mobileMode is true
        if (!mobileMode && !userPermissions.policeGPS && !userPermissions.admin) {
            console.log('Permission denied for user:', userEmail);
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Add logging for mobile mode
        if (mobileMode) {
            console.log('Mobile mode enabled, bypassing permission check for user:', userEmail);
        } else {
            console.log('Setting up SSE for user:', userEmail);
        }

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': 'https://merlin.westchesterrtc.com',
            'Access-Control-Allow-Credentials': 'true'
        });

        // Function to send data
        const sendVehicleData = () => {
            try {
                if (currentLocationData) {
                    res.write(`data: ${JSON.stringify(currentLocationData)}\n\n`);
                } else {
                    res.write(`data: ${JSON.stringify({ features: [] })}\n\n`);
                }
            } catch (error) {
                console.error('Error sending SSE data:', error);
                res.write(`data: ${JSON.stringify({ error: 'Error sending data' })}\n\n`);
            }
        };

        // Send initial data
        sendVehicleData();

        // Set up interval for updates
        const intervalId = setInterval(sendVehicleData, 1000);

        // Handle client disconnect
        req.on('close', () => {
            clearInterval(intervalId);
            res.end();
        });

        // Handle errors
        req.on('error', (error) => {
            console.error('SSE request error:', error);
            clearInterval(intervalId);
            res.end();
        });

        // Handle response errors
        res.on('error', (error) => {
            console.error('SSE response error:', error);
            clearInterval(intervalId);
            res.end();
        });

    } catch (error) {
        console.error('SSE setup error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error('Logout failed:', err);
          return res.status(200).json({ error: 'Logout failed but continuing' });
      }
      
      // Clear any authentication cookies
      res.clearCookie('connect.sid'); // or whatever your session cookie name is
      
      // Send success response instead of redirect
      // Let the client handle the redirect
      res.status(200).json({ message: 'Logged out successfully' });
  });
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Modify the catch-all route handler
app.use((req, res, next) => {
    // Skip logging for frequent endpoints
    const skipPaths = [
        '/FDLocations',
        '/api/locations',
        '/locations',
        '/sse/vehicles',
        '/sse/fireVehicles'
    ];
    
    if (!skipPaths.some(path => req.path.startsWith(path))) {
        console.log(`Request to: ${req.method} ${req.path}`);
    }
    next();
});
// SSE endpoint for fire/EMS vehicles
app.get('/sse/fireVehicles', async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        // Add mobileMode parameter check
        const mobileMode = req.query.mobileMode === 'true';
        
        if (!userEmail) {
            console.log('No user email in query');
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const result = await pool.query(
            'SELECT permissions FROM users WHERE email = $1',
            [userEmail]
        );

        if (!result.rows[0]) {
            console.log('No user found for email:', userEmail);
            return res.status(403).json({ error: 'User not found' });
        }

        const userPermissions = result.rows[0].permissions;
        
        // Modified permission check to bypass if mobileMode is true
        if (!mobileMode && !userPermissions.fireGPS && !userPermissions.admin) {
            console.log('Fire GPS permission denied for user:', userEmail);
            return res.status(403).json({ error: 'Permission denied' });
        }

        // Add logging for mobile mode
        if (mobileMode) {
            console.log('Mobile mode enabled, bypassing permission check for user:', userEmail);
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': 'https://merlin.westchesterrtc.com',
            'Access-Control-Allow-Credentials': 'true'
        });

        const sendFireData = () => {
            try {
                if (currentFDLocationData) {
                    res.write(`data: ${JSON.stringify(currentFDLocationData)}\n\n`);
                } else {
                    res.write(`data: ${JSON.stringify({ features: [] })}\n\n`);
                }
            } catch (error) {
                console.error('Error sending fire SSE data:', error);
                res.write(`data: ${JSON.stringify({ error: 'Error sending data' })}\n\n`);
            }
        };

        sendFireData();
        const intervalId = setInterval(sendFireData, 1000);

        req.on('close', () => {
            clearInterval(intervalId);
            res.end();
        });

    } catch (error) {
        console.error('Fire SSE setup error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start server
const PORT = 3000;
server.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    await checkAndStartVehicleProcessing();
    //startCADMonitoring(); // This should now work with the import
});

// Use the address search routes
app.use('/api', addressSearchRoutes);

app.get('/FDLocations', allowLocalhost, (req, res) => {
    console.log('GET /FDLocations - Current FD location data:', {
        hasData: !!currentFDLocationData,
        type: currentFDLocationData?.type,
        featureCount: currentFDLocationData?.features?.length
    });
    res.json(currentFDLocationData || { type: 'FeatureCollection', features: [] });
});
/// In your login route
app.post('/login', async (req, res) => {
    try {
        // ... existing login code ...

        // Get the real client IP
        const clientIp = getClientIp(req);
        
        // Log the login
        await logAuditInfo(
            user.email,
            'LOGIN_SUCCESS',
            JSON.stringify({
                method: 'Slack OAuth',
                userAgent: req.headers['user-agent'],
                ipAddress: clientIp // Use the real IP here
            })
        );

        // ... rest of login code ...
    } catch (error) {
        // ... error handling ...
    }
});

// Add this route for audit trail
app.post('/api/audit-trail', async (req, res) => {
    try {
        const { action, additional_info } = req.body;
        const userName = extractUserFromReferer(req.headers.referer || '');
        
        await logAuditInfo(userName, action, additional_info);
        res.status(200).json({ message: 'Audit trail created' });
    } catch (error) {
        console.error('Error creating audit trail:', error);
        res.status(500).json({ error: 'Failed to create audit trail' });
    }
});

// Add this inside your io.on('connection', ...) handler or create one if it doesn't exist
io.on('connection', async (socket) => {
    console.log('Socket connected:', socket.id);
    
    // Send active notifications to newly connected users
    try {
        const recentNotifications = await pool.query(
            `SELECT * FROM notifications 
             WHERE expires_at > NOW() 
             ORDER BY timestamp DESC 
             LIMIT 5`
        );
        
        if (recentNotifications.rows.length > 0) {
            socket.emit('active_notifications', recentNotifications.rows);
            console.log(`Sent ${recentNotifications.rows.length} active notifications to socket ${socket.id}`);
        }
    } catch (error) {
        console.error('Error fetching recent notifications:', error);
    }
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// Add current user endpoint
app.get('/api/user/current', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json(req.session.user);
});

app.use(tempMarkersRouter);

// Add Slack Events Router with enhanced logging
app.use('/slack', (req, res, next) => {
    // Add request logging
    console.log(`Slack Event: ${req.method} ${req.path}`, {
        headers: {
            'content-type': req.headers['content-type'],
            'x-slack-signature': req.headers['x-slack-signature'] ? 'Present' : 'Missing',
            'x-slack-request-timestamp': req.headers['x-slack-request-timestamp']
        },
        body: req.body ? 
            (typeof req.body === 'object' ? 
                `${Object.keys(req.body).join(', ')} (keys)` : 
                'Raw body present') 
            : 'No body'
    });
    
    next();
}, slackEventsRouter);

// Add scheduled task to clean up expired resources every hour
cron.schedule('0 * * * *', async () => {
  try {
    console.log('Running cleanup job for expired special resources...');
    const result = await pool.query(
      `UPDATE special_resources 
       SET is_active = FALSE 
       WHERE is_active = TRUE AND tour_end < NOW() 
       RETURNING id`
    );
    
    if (result.rows.length > 0) {
      console.log(`Deactivated ${result.rows.length} expired special resources: ${result.rows.map(row => row.id).join(', ')}`);
    } else {
      console.log('No expired special resources to deactivate');
    }
  } catch (error) {
    console.error('Error in special resources cleanup job:', error);
  }
});

// Mobile mode follow logging
app.post('/api/logs/mobile-follows', async (req, res) => {
  try {
    const userEmail = req.headers['x-user-email'];
    
    // Ensure the user is authenticated
    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Extract data from request
    const { follower_email, follower_name, followed_vehicle, timestamp } = req.body;
    
    // Validate required fields
    if (!follower_email || !followed_vehicle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mobile_follow_logs (
        id SERIAL PRIMARY KEY,
        follower_email TEXT NOT NULL,
        follower_name TEXT NOT NULL,
        followed_vehicle TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Format user name - never store null or empty string
    const formattedName = follower_name || follower_email.split('@')[0];
    
    // Insert the log entry
    const result = await pool.query(
      `INSERT INTO mobile_follow_logs 
        (follower_email, follower_name, followed_vehicle, timestamp)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        follower_email, 
        formattedName, 
        followed_vehicle,
        timestamp ? new Date(timestamp) : new Date()
      ]
    );
    
    // Add console log for debugging
    console.log(`Mobile Follow Log: ${formattedName} (${follower_email}) followed ${followed_vehicle} at ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Mobile follow log created',
      log: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error logging mobile follow:', error);
    res.status(500).json({ error: 'Failed to log mobile follow' });
  }
});

// Get mobile follow logs (admin only)
app.get('/api/logs/mobile-follows', async (req, res) => {
  try {
    const userEmail = req.headers['x-user-email'];
    
    // Ensure the user is authenticated
    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Check if user is admin
    const userResult = await pool.query(
      'SELECT permissions FROM users WHERE email = $1',
      [userEmail]
    );
    
    const isAdmin = userResult.rows.length > 0 && 
      userResult.rows[0].permissions && 
      userResult.rows[0].permissions.admin;
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    // Get pagination parameters
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM mobile_follow_logs');
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get log entries
    const result = await pool.query(
      `SELECT * FROM mobile_follow_logs 
       ORDER BY timestamp DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    res.json({
      logs: result.rows,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + result.rows.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error retrieving mobile follow logs:', error);
    res.status(500).json({ error: 'Failed to retrieve mobile follow logs' });
  }
});

// Get recent mobile follows for a user
app.get('/api/logs/mobile-follows/recent', async (req, res) => {
  try {
    const userEmail = req.headers['x-user-email'];
    
    // Ensure the user is authenticated
    if (!userEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get limit parameter (default to 10)
    const limit = parseInt(req.query.limit) || 10;
    
    // Check if table exists first
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'mobile_follow_logs'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      return res.json({ recentFollows: [] });
    }
    
    // Get recent follows by this user
    const result = await pool.query(
      `SELECT * FROM mobile_follow_logs 
       WHERE follower_email = $1
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [userEmail, limit]
    );
    
    res.json({ recentFollows: result.rows });
  } catch (error) {
    console.error('Error retrieving recent mobile follows:', error);
    res.status(500).json({ error: 'Failed to retrieve recent mobile follows' });
  }
});







