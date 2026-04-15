const fetch = require('node-fetch');
const { pool } = require('../db');
require('dotenv').config();

class WeatherService {
    constructor() {
        this.apiKey = process.env.OPENWEATHER_API_KEY;
        this.alerts = new Map(); // Store current alerts to prevent duplicates
    }

    async getUserPreference(userEmail) {
        try {
            const result = await pool.query(
                'SELECT weather_preferences FROM users WHERE email = $1',
                [userEmail]
            );
            return result.rows[0]?.weather_preferences?.weatherEnabled || false;
        } catch (error) {
            console.error('Error fetching user weather preferences:', error);
            return false;
        }
    }

    async updateUserPreference(userEmail, enabled) {
        try {
            await pool.query(
                `UPDATE users 
                 SET weather_preferences = jsonb_set(
                     COALESCE(weather_preferences, '{}'::jsonb),
                     '{weatherEnabled}',
                     $1::jsonb
                 )
                 WHERE email = $2`,
                [JSON.stringify(enabled), userEmail]
            );
            return true;
        } catch (error) {
            console.error('Error updating user weather preferences:', error);
            return false;
        }
    }

    async getWeatherAlerts(bounds) {
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/3.0/onecall?` +
                `lat=${bounds.center.lat}&lon=${bounds.center.lng}&` +
                `exclude=current,minutely,hourly,daily&appid=${this.apiKey}`
            );
            
            if (!response.ok) throw new Error('Weather API request failed');
            
            const data = await response.json();
            return this.processAlerts(data.alerts || []);
        } catch (error) {
            console.error('Error fetching weather alerts:', error);
            return [];
        }
    }

    processAlerts(alerts) {
        const currentTime = Date.now();
        const newAlerts = [];

        alerts.forEach(alert => {
            const alertId = `${alert.event}_${alert.start}`;
            if (!this.alerts.has(alertId) && alert.end > currentTime) {
                this.alerts.set(alertId, alert);
                newAlerts.push({
                    id: alertId,
                    event: alert.event,
                    description: alert.description,
                    severity: this.getSeverityLevel(alert.event),
                    start: alert.start,
                    end: alert.end
                });
            }
        });

        return newAlerts;
    }

    getSeverityLevel(event) {
        const severityMap = {
            'Tornado': 'extreme',
            'Hurricane': 'extreme',
            'Severe Thunderstorm': 'severe',
            'Flash Flood': 'severe',
            'Flood': 'moderate',
            'Winter Storm': 'moderate'
        };
        return severityMap[event] || 'normal';
    }
}

module.exports = new WeatherService();