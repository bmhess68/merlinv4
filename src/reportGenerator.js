const fs = require('fs');
const path = require('path');
const axios = require('axios');
const moment = require('moment-timezone');

// Helper function to send report via Slack DM
const sendReportViaSlack = async (userIds, message) => {
    const token = process.env.SLACK_BOT_TOKEN; // Ensure this token is correctly set in your environment variables
    if (!token) {
        throw new Error('SLACK_BOT_TOKEN not found in environment variables');
    }

    for (const userId of userIds) {
        try {
            const response = await axios.post('https://slack.com/api/chat.postMessage', {
                channel: userId,
                text: message.text // Ensure that only text is being sent
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.data.ok) {
                console.error(`Failed to send message to user ${userId}:`, response.data.error);
            } else {
                console.log(`Message sent to user ${userId}`);
            }
        } catch (error) {
            console.error(`Error sending message to user ${userId}:`, error.message);
        }
    }
};

// Helper function to format time to EST
const formatTimeEST = (time) => {
    if (typeof time === 'string' && time.match(/^\d{2}:\d{2}:\d{2}$/)) {
        const today = moment().format('YYYY-MM-DD');
        time = `${today} ${time}`;
    }
    return moment(time).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
};

const processVehicleData = (vehicles) => {
    const vehicleMap = new Map();

    vehicles.forEach(vehicle => {
        const key = vehicle.vehicle_id; // Use vehicle_id as the key since it contains the full identifier
        
        if (!vehicleMap.has(key)) {
            vehicleMap.set(key, {
                vehicle_id: vehicle.vehicle_id,
                entry_time: null,
                exit_time: null,
                assignment: vehicle.assignment || ''
            });
        }

        const currentVehicle = vehicleMap.get(key);
        const timestamp = moment(vehicle.timestamp);

        if (vehicle.action === 'entered') {
            if (!currentVehicle.entry_time || timestamp.isBefore(moment(currentVehicle.entry_time))) {
                currentVehicle.entry_time = vehicle.timestamp;
            }
        } else if (vehicle.action === 'exited') {
            if (!currentVehicle.exit_time || timestamp.isAfter(moment(currentVehicle.exit_time))) {
                currentVehicle.exit_time = vehicle.timestamp;
            }
        }
    });

    return Array.from(vehicleMap.values());
};

// Helper function to format the report data to plain text
const formatReportForTxt = (reportData) => {
    const { incident, vehicles, markers, closeIncident } = reportData;

    let reportTxt = `Westchester/Putnam Real Time Crime - MERLIN Report\n\n`;

    reportTxt += `Incident ID: ${incident.incident_id}\n`;
    reportTxt += `Name: ${incident.name}\n`;
    reportTxt += `Type: ${incident.type_incident}\n`;
    reportTxt += `Location: (${incident.location_lat}, ${incident.location_long})\n`;
    reportTxt += `Radius: ${incident.radius} miles\n`;
    reportTxt += `Date/Time Created: ${formatTimeEST(incident.date)}\n`;
    reportTxt += `Created By: ${incident.created_by_name || 'Unknown'}\n`;
    reportTxt += `Notes: ${incident.notes || 'N/A'}\n\n`;

    reportTxt += `\nVehicles:\n`;
    const processedVehicles = processVehicleData(vehicles);
    processedVehicles.forEach(vehicle => {
        const entryTime = vehicle.entry_time ? 
            moment(vehicle.entry_time).tz('America/New_York').format('HH:mm:ss') : 
            'Unknown';
        const exitTime = vehicle.exit_time ? 
            moment(vehicle.exit_time).tz('America/New_York').format('HH:mm:ss') : 
            'Still Active';

        reportTxt += `• ${vehicle.vehicle_id} entered at ${entryTime} ${vehicle.assignment ? `[${vehicle.assignment}]` : ''} and ${vehicle.exit_time ? 'left incident at ' + exitTime : 'remains active'}\n`;
    });

    reportTxt += `\nMarkers:\n`;
    markers.forEach(marker => {
        const { geometry } = marker.geojson;
        let locationText = "";

        if (geometry.type === 'Point') {
            locationText = `(${geometry.coordinates[1]}, ${geometry.coordinates[0]})`;
        } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
            locationText = `First Coordinate: (${geometry.coordinates[0][0][1]}, ${geometry.coordinates[0][0][0]})`;
        }

        reportTxt += `• Marker ID: ${marker.id}, Name: ${marker.name}, Color: ${marker.color}, Location: ${locationText}, Type: ${geometry.type}, Created By: ${marker.created_by_name || 'Unknown'}, Timestamp: ${formatTimeEST(marker.datetime_added)}\n`;
    });

    reportTxt += `\nClosing Details:\n`;
    reportTxt += `Disposition: ${closeIncident.disposition || 'N/A'}\n`;
    reportTxt += `Notes: ${closeIncident.notes || 'N/A'}\n`;
    reportTxt += `Created By: ${closeIncident.created_by_name || 'Unknown'}\n`;
    reportTxt += `Email Requested: ${closeIncident.email_requested ? 'Yes' : 'No'}\n`;
    reportTxt += `Email Address: ${closeIncident.email_address || 'N/A'}\n`;
    if (incident.inc_close_datetime && moment(incident.inc_close_datetime).isValid()) {
        reportTxt += `Incident Closed At: ${formatTimeEST(incident.inc_close_datetime)}\n`;
    }

    return reportTxt;
};

// Function to split long messages into chunks
const splitMessageIntoChunks = (message, maxLength = 3800) => {
    const chunks = [];
    let currentIndex = 0;

    while (currentIndex < message.length) {
        let chunk = message.slice(currentIndex, currentIndex + maxLength);
        currentIndex += maxLength;

        // Ensure chunks are split at line breaks where possible
        if (currentIndex < message.length) {
            const lastNewline = chunk.lastIndexOf('\n');
            if (lastNewline > -1) {
                currentIndex -= (chunk.length - lastNewline - 1);
                chunk = chunk.slice(0, lastNewline + 1);
            }
        }

        chunks.push(chunk);
    }

    return chunks;
};

// Function to send the report to Slack via webhook
const sendReportToSlackWebhook = async (reportTxt) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const chunks = splitMessageIntoChunks(reportTxt);

    try {
        for (const chunk of chunks) {
            console.log("Sending the following report chunk to Slack webhook:", chunk);
            const response = await axios.post(webhookUrl, { text: chunk });

            if (response.status === 200) {
                console.log('Report chunk successfully sent to Slack webhook');
            } else {
                console.error(`Failed to send report chunk to Slack webhook: ${response.status} ${response.statusText}`);
            }
        }
    } catch (error) {
        if (error.response) {
            console.error('Error sending report to Slack webhook:', error.response.status);
            console.error('Response data:', error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error:', error.message);
        }
    }
};

// Function to send the report via Slack DM
const sendReportToSlackDM = async (userIds, reportTxt) => {
    const chunks = splitMessageIntoChunks(reportTxt);

    try {
        for (const chunk of chunks) {
            console.log("Sending the following report chunk via Slack DM:", chunk);
            await sendReportViaSlack(userIds, { text: chunk });
            console.log('Report chunk successfully sent via Slack DM.');
        }
    } catch (error) {
        console.error('Error sending report via Slack DM:', error.message);
        throw error;
    }
};

// Updated to accept the pool as a parameter
const gatherUserIdsForIncident = async (incidentId, pool) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT created_by_userid 
            FROM incidents 
            WHERE incident_id = $1
            UNION
            SELECT DISTINCT created_by_userid 
            FROM drawn_items 
            WHERE incident_id = $1
            UNION
            SELECT DISTINCT Created_by_userID 
            FROM closeinc 
            WHERE incident_id = $1
        `, [incidentId]);

        return result.rows.map(row => row.created_by_userid);
    } catch (error) {
        console.error('Error gathering user IDs for incident:', error.message);
        throw error;
    }
};

// Updated to send the same report to both Slack webhook and DM
const generateAndSendIncidentReport = async (incidentId, reportTxt, pool) => {
    try {
        const userIds = await gatherUserIdsForIncident(incidentId, pool);

        if (userIds.length > 0) {
            console.log('Attempting to send report via Slack DM to users:', userIds);
            await sendReportToSlackDM(userIds, reportTxt); // Send the report via Slack DM
        } else {
            console.log('No users found associated with this incident.');
        }

        console.log('Attempting to send report via Slack webhook...');
        await sendReportToSlackWebhook(reportTxt); // Send the same report to Slack webhook
        console.log('Report successfully sent via Slack webhook.');

    } catch (error) {
        console.error('Error generating and sending incident report:', error.message);
        throw error;
    }
};

// Function to generate and save the report
const generateIncidentReport = async (incident_id, pool) => {
    try {
        // Delay to ensure data is written to the database
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Update SELECT to match actual columns
        const incidentData = await pool.query(`
            SELECT 
                incident_id, date, time, startuser, 
                location_lat, location_long, type_incident,
                inc_close_datetime, disposition, email,
                name, notes, radius, active, location,
                incident_commander, staging_manager, communications
            FROM incidents 
            WHERE incident_id = $1`, 
            [incident_id]
        );

        if (!incidentData.rows.length) {
            throw new Error(`No incident found with ID: ${incident_id}`);
        }

        // These queries look correct based on the logs
        const vehicleEntries = await pool.query(`
            SELECT id, incident_id, vehicle_id, action, 
                   location, officer_name, assignment, timestamp
            FROM incident_vehicles 
            WHERE incident_id = $1`, 
            [incident_id]
        );

        const closeIncidentData = await pool.query(`
            SELECT * FROM closeinc 
            WHERE incident_id = $1`, 
            [incident_id]
        );

        const markersData = await pool.query(`
            SELECT * FROM drawn_items 
            WHERE incident_id = $1`, 
            [incident_id]
        );

        const reportData = {
            incident: incidentData.rows[0],
            vehicles: vehicleEntries.rows,
            markers: markersData.rows.map(marker => {
                const { geometry } = marker.geojson;
                let location_lat, location_long;

                if (geometry.type === 'Point') {
                    [location_long, location_lat] = geometry.coordinates;
                } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
                    [location_long, location_lat] = geometry.coordinates[0][0];
                }

                return {
                    ...marker,
                    location_lat,
                    location_long
                };
            }),
            closeIncident: closeIncidentData.rows[0] || {}
        };

        const reportTxt = formatReportForTxt(reportData);

        await generateAndSendIncidentReport(incident_id, reportTxt, pool);

        return reportData;
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
};

const main = async (incidentId, pool) => {
    try {
        await generateIncidentReport(incidentId, pool);
    } catch (error) {
        console.error('Error generating or sending report:', error);
    }
};

module.exports = { generateIncidentReport, main };
