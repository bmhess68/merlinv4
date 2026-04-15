require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');
const { generateIncidentReport } = require('../reportGenerator');
const readline = require('readline');
const moment = require('moment-timezone');

const pool = new Pool({
    user: 'wcpd',
    host: 'localhost',
    database: 'incidentdb',
    password: process.env.DB_PASSWORD,
    port: 5432
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const processVehicleData = (vehicles) => {
    const vehicleMap = new Map();

    vehicles.forEach(vehicle => {
        const key = `${vehicle.vehicle_id}_${vehicle.officer_name}`;
        
        if (!vehicleMap.has(key)) {
            vehicleMap.set(key, {
                vehicle_id: vehicle.vehicle_id,
                officer_name: vehicle.officer_name,
                assignment: vehicle.assignment,
                entry_time: null,
                exit_time: null
            });
        }

        const currentVehicle = vehicleMap.get(key);
        const timestamp = moment(vehicle.timestamp);

        if (vehicle.action === 'enter') {
            if (!currentVehicle.entry_time || timestamp.isBefore(moment(currentVehicle.entry_time))) {
                currentVehicle.entry_time = vehicle.timestamp;
            }
        } else if (vehicle.action === 'exit') {
            if (!currentVehicle.exit_time || timestamp.isAfter(moment(currentVehicle.exit_time))) {
                currentVehicle.exit_time = vehicle.timestamp;
            }
        }
    });

    return Array.from(vehicleMap.values());
};

async function testReport() {
    try {
        rl.question('Enter incident ID: ', async (incident_id) => {
            console.log(`Generating report for incident ${incident_id}...`);
            
            try {
                const reportData = await generateIncidentReport(incident_id, pool);
                
                // Format and print the report
                console.log('\n=== INCIDENT REPORT ===\n');
                console.log(`Incident ID: ${reportData.incident.incident_id}`);
                console.log(`Name: ${reportData.incident.name}`);
                console.log(`Type: ${reportData.incident.type_incident}`);
                console.log(`Location: (${reportData.incident.location_lat}, ${reportData.incident.location_long})`);
                console.log(`Created By: ${reportData.incident.created_by_name || 'Unknown'}`);
                
                console.log('\n=== VEHICLES ===\n');
                const processedVehicles = processVehicleData(reportData.vehicles);
                processedVehicles.forEach(vehicle => {
                    const entryTime = vehicle.entry_time ? 
                        moment(vehicle.entry_time).tz('America/New_York').format('HH:mm:ss') : 
                        'Unknown';
                    const exitTime = vehicle.exit_time ? 
                        moment(vehicle.exit_time).tz('America/New_York').format('HH:mm:ss') : 
                        'Still Active';

                    console.log(`• Vehicle ID: ${vehicle.vehicle_id} - ${vehicle.officer_name} entered at ${entryTime} [${vehicle.assignment}] and ${vehicle.exit_time ? 'left incident at ' + exitTime : 'remains active'}`);
                });
                
                console.log('\n=== MARKERS ===\n');
                reportData.markers.forEach(marker => {
                    console.log(`• ${marker.name} (${marker.color})`);
                });
                
                console.log('\n=== CLOSING DETAILS ===\n');
                if (reportData.closeIncident) {
                    console.log(`Disposition: ${reportData.closeIncident.disposition || 'N/A'}`);
                    console.log(`Notes: ${reportData.closeIncident.notes || 'N/A'}`);
                    console.log(`Closed By: ${reportData.closeIncident.created_by_name || 'Unknown'}`);
                } else {
                    console.log('Incident not closed');
                }
                
            } catch (error) {
                console.error('Error generating report:', error);
            } finally {
                rl.close();
                pool.end();
            }
        });
    } catch (error) {
        console.error('Error:', error);
        pool.end();
    }
}

testReport();