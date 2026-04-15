const express = require('express');
const router = express.Router();
const { getCSVFiles, processCSVFile } = require('../services/csvService');

// Routes will be mounted at /api/csv/...
router.get('/files', async (req, res) => {
    try {
        const csvFiles = await getCSVFiles();
        res.json(csvFiles);
    } catch (error) {
        console.error('Error reading CSV directory:', error);
        res.status(500).json({ error: 'Failed to read CSV directory' });
    }
});

router.get('/data/:filename', async (req, res) => {
    try {
        const geoJSON = await processCSVFile(req.params.filename);
        res.json(geoJSON);
    } catch (error) {
        if (error.message === 'CSV file not found') {
            res.status(404).json({ error: 'CSV file not found' });
        } else {
            console.error('Error processing CSV file:', error);
            res.status(500).json({ error: 'Failed to process CSV file' });
        }
    }
});

module.exports = router;