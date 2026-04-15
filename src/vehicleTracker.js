// vehicleTracker.js
const fetch = require('node-fetch');
const turf = require('@turf/turf');
const { pool } = require('./db');

let vehicleProcessingInterval = null;
let currentFDVehicleData = { type: 'FeatureCollection', features: [] };

const fetchLatestVehicleData = async () => {
    try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/locations`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching vehicle data:', error);
        return null;
    }
};

const fetchLatestFDVehicleData = async () => {
    try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/FDLocations`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching FD vehicle data:', error);
        return null;
    }
};

const startVehicleProcessingIfNeeded = async () => {
    if (!vehicleProcessingInterval) {
        console.log('Starting vehicle processing interval');
        vehicleProcessingInterval = setInterval(async () => {
            try {
                // First check if there are any active incidents
                const incidents = await getIncidents();
                const activeIncidents = incidents.filter(incident => incident.active);
                
                if (activeIncidents.length === 0) {
                    console.log('No active incidents - skipping vehicle processing');
                    return;
                }

                console.log(`Processing vehicles for ${activeIncidents.length} active incidents...`);
                const policeVehicles = await fetchLatestVehicleData();
                const fdVehicles = await fetchLatestFDVehicleData();
                
                console.log(`Found ${policeVehicles?.features?.length || 0} police vehicles and ${fdVehicles?.features?.length || 0} FD vehicles`);
                
                await processVehicles(policeVehicles, 'police');
                await processVehicles(fdVehicles, 'fd');
            } catch (error) {
                console.error('Error in vehicle processing interval:', error);
            }
        }, 30000);  // Runs every 30 seconds
    }
};

const checkAndStartVehicleProcessing = async () => {
    try {
        console.log('Checking for active incidents...');
        const result = await pool.query('SELECT * FROM incidents WHERE active = TRUE');
        console.log(`Found ${result.rows.length} active incidents`);
        
        if (result.rows.length > 0) {
            console.log('Active incidents found, starting vehicle processing');
            startVehicleProcessingIfNeeded();
        } else {
            console.log('No active incidents found');
        }
    } catch (error) {
        console.error('Error checking for active incidents:', error.message);
    }
};

function cleanup() {
    if (vehicleProcessingInterval) {
        clearInterval(vehicleProcessingInterval);
        vehicleProcessingInterval = null;
    }
}

async function stopVehicleProcessingIfNoActiveIncidents() {
    const incidents = await getIncidents();
    if (incidents.length === 0) {
        cleanup();
    }
}

const processVehicles = async (vehicles, vehicleType = 'police') => {
    try {
        // Get active incidents only
        const incidents = await getIncidents();
        const activeIncidents = incidents.filter(incident => incident.active);
        
        if (!activeIncidents || activeIncidents.length === 0) {
            return;
        }

        if (!vehicles || vehicles.type !== 'FeatureCollection') {
            console.warn(`Invalid ${vehicleType} vehicle data format`);
            return;
        }

        for (const feature of vehicles.features) {
            const vehicle = {
                displayName: feature.properties.displayName,
                latitude: feature.geometry.coordinates[1],
                longitude: feature.geometry.coordinates[0],
                officer_name: feature.properties.officer_name,
                assignment: feature.properties.assignment,
            };

            for (const incident of activeIncidents) {
                const vehiclePoint = turf.point([vehicle.longitude, vehicle.latitude]);
                const incidentCircle = turf.circle(
                    [incident.location_long, incident.location_lat], 
                    incident.radius, 
                    { units: 'miles' }
                );

                const isInside = turf.booleanPointInPolygon(vehiclePoint, incidentCircle);

                const { rows: existingEntries } = await pool.query(
                    `SELECT action FROM incident_vehicles 
                     WHERE incident_id = $1 AND vehicle_id = $2 AND vehicle_type = $3 
                     ORDER BY timestamp DESC LIMIT 1`,
                    [incident.incident_id, vehicle.displayName, vehicleType]
                );

                const lastAction = existingEntries.length > 0 ? existingEntries[0].action : null;

                if (isInside && lastAction !== 'entered') {
                    console.log(`${vehicleType.toUpperCase()} Vehicle ${vehicle.displayName} entered incident ${incident.incident_id}`);
                    await logVehicleEntryExit(vehicle, incident, 'entered', vehicleType);
                } else if (!isInside && lastAction === 'entered') {
                    console.log(`${vehicleType.toUpperCase()} Vehicle ${vehicle.displayName} exited incident ${incident.incident_id}`);
                    await logVehicleEntryExit(vehicle, incident, 'exited', vehicleType);
                }
            }
        }
    } catch (error) {
        console.error(`Error processing ${vehicleType} vehicles:`, error.message);
    }
};

async function getIncidents() {
    try {
        const result = await pool.query(`
            SELECT 
                incident_id,
                name,
                type_incident,
                location_lat,
                location_long,
                radius,
                active
            FROM incidents 
            WHERE active = true
            ORDER BY date DESC, time DESC
        `);
        return result.rows;
    } catch (error) {
        console.error('Error fetching incidents from DB:', error);
        throw error;
    }
}

const logVehicleEntryExit = async (vehicle, incident, status, vehicleType) => {
    try {
        await pool.query(
            `INSERT INTO incident_vehicles (
                incident_id, 
                vehicle_id, 
                action, 
                location, 
                officer_name, 
                assignment,
                vehicle_type
            )
            VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8)`,
            [
                incident.incident_id,
                vehicle.displayName,
                status,
                vehicle.longitude,
                vehicle.latitude,
                vehicle.officer_name || 'Unknown',
                vehicle.assignment || 'Unknown',
                vehicleType
            ]
        );
    } catch (error) {
        console.error('Error logging vehicle entry/exit:', error.message);
    }
};

module.exports = {
    startVehicleProcessingIfNeeded,
    stopVehicleProcessingIfNoActiveIncidents,
    checkAndStartVehicleProcessing,
    logVehicleEntryExit,
    getIncidents,
    processVehicles,
    cleanup
};
