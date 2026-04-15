const io = require('socket.io-client');
const socket = io('https://merlin.westchesterrtc.com');

// Add connection status logs
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
});

const testAlerts = {
    fire: {
        call_type: "STRUCTURE FIRE",
        address: "123 Main Street",
        cross_street: "Oak Avenue",
        area: "Downtown",
        time_out: new Date().toISOString(),
        comments: "Smoke showing from second floor. Multiple calls received.",
        event_number: "F23-" + Math.floor(Math.random() * 10000),
        alarm_level: 2,
        latitude: 41.0340,
        longitude: -73.7638
    },
    ems: {
        call_type: "CARDIAC ARREST",
        address: "456 Elm Street",
        cross_street: "Pine Road",
        area: "North Side",
        time_out: new Date().toISOString(),
        comments: "Unconscious person, CPR in progress",
        event_number: "E23-" + Math.floor(Math.random() * 10000),
        alarm_level: 1,
        latitude: 41.0360,
        longitude: -73.7658
    },
    mva: {
        call_type: "MOTOR VEHICLE ACCIDENT",
        address: "789 Post Road",
        cross_street: "Maple Avenue",
        area: "East Side",
        time_out: new Date().toISOString(),
        comments: "Two car MVA with injuries, airbag deployment",
        event_number: "M23-" + Math.floor(Math.random() * 10000),
        alarm_level: 1,
        latitude: 41.0380,
        longitude: -73.7678
    }
};

// Get the alert type from command line argument
const alertType = process.argv[2]?.toLowerCase();

if (!alertType || !testAlerts[alertType]) {
    console.log('Please specify alert type: fire, ems, or mva');
    console.log('Usage: node testCADAlerts.js <type>');
    process.exit(1);
}

// Log the alert details
console.log('\nSending test alert:');
console.log('------------------');
console.log(`Type: ${alertType.toUpperCase()}`);
console.log(`Call Type: ${testAlerts[alertType].call_type}`);
console.log(`Address: ${testAlerts[alertType].address}`);
console.log(`Cross Street: ${testAlerts[alertType].cross_street}`);
console.log(`Area: ${testAlerts[alertType].area}`);
console.log(`Time: ${new Date(testAlerts[alertType].time_out).toLocaleTimeString()}`);
console.log(`Event #: ${testAlerts[alertType].event_number}`);
console.log(`Location: ${testAlerts[alertType].latitude}, ${testAlerts[alertType].longitude}`);
console.log('------------------\n');

// Emit the test alert
socket.emit('new-cad-alert', testAlerts[alertType]);

// Wait longer to see the connection status
setTimeout(() => {
    console.log('Test alert sent!');
    process.exit(0);
}, 2000);