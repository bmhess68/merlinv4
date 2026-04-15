const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDirectory = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const logFile = path.join(logDirectory, 'unauthorized_access.log');

const logUnauthorizedAccess = (req, clientIp) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        path: req.path,
        method: req.method,
        clientIp,
        headers: {
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            origin: req.headers.origin
        },
        query: req.query,
        body: req.method === 'GET' ? undefined : req.body // Don't log GET request bodies
    };

    fs.appendFile(
        logFile,
        JSON.stringify(logEntry) + '\n',
        (err) => {
            if (err) {
                console.error('Error writing to access log:', err);
            }
        }
    );
};

module.exports = logUnauthorizedAccess; 