const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://merlin.westchesterrtc.com',
        'https://devmerlin.westchesterrtc.com'
        
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};

module.exports = corsOptions; 