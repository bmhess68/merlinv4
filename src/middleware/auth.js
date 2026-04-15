const { pool } = require('../db');

// IPs to exclude from logging
const EXCLUDED_IPS = ['127.0.0.1', '::1', '192.168.2.185'];

function getClientIp(req) {
    const ip = req.headers['x-real-ip'] || 
               (req.headers['x-forwarded-for'] ? 
                   req.headers['x-forwarded-for'].split(',')[0].trim() : 
                   req.connection.remoteAddress);
    return ip;
}

const requireAuth = (req, res, next) => {
    const clientIp = getClientIp(req);

    // Only log if IP is not in excluded list
    if (!EXCLUDED_IPS.includes(clientIp)) {
        if (!req.session || !req.session.user) {
            logToAuditTrail({
                user_email: 'unauthorized',
                action: 'UNAUTHORIZED_ACCESS',
                additional_info: JSON.stringify({
                    path: req.path,
                    method: req.method,
                    ip: clientIp,
                    userAgent: req.headers['user-agent'],
                    origin: req.headers.origin,
                    hasSession: !!req.session
                })
            });
        } else {
            // Log all API access except for excluded IPs
            logToAuditTrail({
                user_email: req.session.user.email,
                action: 'API_ACCESS',
                additional_info: JSON.stringify({
                    path: req.path,
                    method: req.method,
                    ip: clientIp,
                    userAgent: req.headers['user-agent'],
                    isSensitive: isSecuritySensitiveEndpoint(req.path)
                })
            });
        }
    }

    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    next();
};

// Helper function to identify sensitive endpoints
function isSecuritySensitiveEndpoint(path) {
    const sensitiveEndpoints = [
        '/api/admin',
        '/api/roster',
        '/api/incidents/create',
        '/api/incidents/delete',
        '/api/incidents/update'
    ];
    return sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
}

// Helper function to log to audit_trail
async function logToAuditTrail({ user_email, action, additional_info }) {
    try {
        await pool.query(`
            INSERT INTO audit_trail (
                user_email,
                action,
                additional_info,
                timestamp
            ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        `, [user_email, action, additional_info]);
    } catch (error) {
        console.error('Error logging to audit trail:', error);
        // Don't block the request if logging fails
    }
}

module.exports = requireAuth; 