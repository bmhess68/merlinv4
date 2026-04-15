const express = require('express');
const router = express.Router();

// Simple test route
router.get('/', (req, res) => {
    res.json({ message: 'Markers API is working' });
});

module.exports = router;