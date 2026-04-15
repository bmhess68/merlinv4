const logUnauthorizedAccess = require('./accessLogger');

const allowLocalhost = (req, res, next) => {
    // Get the real client IP from headers set by nginx
    const xForwardedFor = req.headers['x-forwarded-for'];
    const xRealIp = req.headers['x-real-ip'];
    const remoteIp = req.connection.remoteAddress;
    
    // Get the actual client IP
    const clientIp = xRealIp || (xForwardedFor ? xForwardedFor.split(',')[0].trim() : remoteIp);
    
    // Only allow 127.0.0.1
    const isLocalhost = clientIp === '127.0.0.1' || 
                       clientIp === '::ffff:127.0.0.1' ||
                       remoteIp === '127.0.0.1' ||
                       remoteIp === '::ffff:127.0.0.1';
    
    // Skip logging for frequent endpoints
    const skipLoggingPaths = [
        '/update-locations',
        '/FDLocations',
        '/locations',
        '/sse/vehicles',
        '/sse/fireVehicles'
    ];
    
    // Only log if it's not a frequent endpoint or if it's not localhost
    if (!skipLoggingPaths.includes(req.path) && !isLocalhost) {
        console.log('Request IP info:', {
            path: req.path,
            clientIp,
            xForwardedFor,
            xRealIp,
            remoteIp,
            isLocalhost,
            isAuthenticated: !!req.session?.user,
            userEmail: req.session?.user?.userEmail
        });
    }

    // Block non-localhost requests
    if (!isLocalhost) {
        // Log unauthorized access attempt
        logUnauthorizedAccess(req, clientIp);
        
        console.warn(`Unauthorized access attempt from IP: ${clientIp} to ${req.path}`);
        return res.status(403).send('Access denied. Local access only.');
    }

    // Allow localhost requests
    next();
};

module.exports = allowLocalhost; 