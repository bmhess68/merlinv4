const { pool } = require('../db');

// Main audit logging function
const logAuditInfo = async (userName, action, description) => {
    await pool.query(`
        INSERT INTO audit_trail (
            user_email, 
            action, 
            additional_info, 
            timestamp
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [userName, action, description]
    );
};

// Extract user info from referer URL
const extractUserFromReferer = (referer) => {
    try {
        const url = new URL(referer);
        const userParam = url.searchParams.get('user');
        if (userParam) {
            const userData = JSON.parse(decodeURIComponent(userParam));
            return userData.userName;
        }
    } catch (error) {
        console.warn('Failed to parse user data from URL:', error);
    }
    return 'unknown';
};

// Specific login audit functions
const logLoginAttempt = async (req) => {
    await logAuditInfo(
        'Unknown',
        'LOGIN_ATTEMPT',
        JSON.stringify({
            method: 'Slack OAuth',
            attemptTime: new Date(),
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip
        })
    );
};

const logLoginSuccess = async (userEmail, req) => {
    await logAuditInfo(
        userEmail,
        'LOGIN_SUCCESS',
        JSON.stringify({
            method: 'Slack OAuth',
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip
        })
    );
};

// Function to get real IP address
const getClientIp = (req) => {
    // Try X-Forwarded-For first
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // Get the first IP in case of multiple proxies
        return xForwardedFor.split(',')[0].trim();
    }
    
    // Try X-Real-IP next
    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
        return xRealIp;
    }
    
    // Fall back to remote address
    return req.connection.remoteAddress;
};

module.exports = {
    logAuditInfo,
    logLoginAttempt,
    logLoginSuccess,
    extractUserFromReferer,
    getClientIp
}; 