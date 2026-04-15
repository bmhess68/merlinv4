const securityHeaders = (req, res, next) => {
    // Get origin from request headers or use merlin as default
    const origin = req.headers.origin || 'https://merlin.westchesterrtc.com';
    
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
};

module.exports = securityHeaders; 