const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
require('dotenv').config();

let currentAlerts = [];
let lastNotifiedAlerts = new Set();

// Function to fetch alerts from OpenWeather
async function fetchWeatherAlerts() {
    try {
        const response = await fetch(
            `https://api.openweathermap.org/data/3.0/alerts?lat=41.0340&lon=-73.7629&appid=${process.env.OPENWEATHER_API_KEY}`
        );
        const data = await response.json();
        return data.alerts || [];
    } catch (error) {
        console.error('Error fetching weather alerts:', error);
        return [];
    }
}

// Check for new alerts every 5 minutes
setInterval(async () => {
    const newAlerts = await fetchWeatherAlerts();
    
    // Check for new alerts that haven't been notified
    const newAlertIds = new Set(newAlerts.map(alert => alert.id));
    
    // Update current alerts
    currentAlerts = newAlerts;
    
    // Emit new alerts to connected clients
    if (global.io) {
        global.io.emit('weatherAlerts', currentAlerts);
    }
}, 5 * 60 * 1000);

// API key endpoint
router.get('/apikey', (req, res) => {
    res.json({ apiKey: process.env.OPENWEATHER_API_KEY });
});

// Endpoint to get current alerts
router.get('/alerts', (req, res) => {
    res.json(currentAlerts);
});

// Endpoint to get weather preferences
router.get('/preferences', (req, res) => {
    // You might want to fetch this from a database in the future
    res.json({ weatherEnabled: false });
});

module.exports = router;