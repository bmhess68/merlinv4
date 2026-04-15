const fetch = require('node-fetch');

const BASE_URL = 'https://merlin.westchesterrtc.com';

const endpoints = [
    // Incidents
    '/api/incidents',
    '/api/incidents/1',
    
    // Roster
    '/api/roster/assignments',
    '/api/roster/incident-vehicles',
    
    // Admin
    '/api/admin/status/merlin',
    '/api/admin/status/zello',
    '/api/admin/all-logs',
    
    // Other endpoints
    '/api/weather',
    '/api/markers',
    '/api/drawn-items',
    '/api/address-search',
    
    // Vehicle locations
    '/FDLocations',
    '/locations'
];

async function testEndpoint(endpoint) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        const status = response.status;
        const secure = status === 401 || status === 403; // 401 Unauthorized or 403 Forbidden is good
        
        console.log(`${endpoint}: ${status} ${response.statusText} - ${secure ? '✅ Secure' : '❌ INSECURE'}`);
        
        if (!secure) {
            try {
                const data = await response.text();
                console.log(`  Response data: ${data.substring(0, 100)}...`);
            } catch (e) {
                console.log('  Could not read response data');
            }
        }
        
        return { endpoint, status, secure };
    } catch (error) {
        console.log(`${endpoint}: Error - ${error.message}`);
        return { endpoint, error: error.message, secure: false };
    }
}

async function runTests() {
    console.log('\nTesting API Security...\n');
    
    const results = await Promise.all(endpoints.map(testEndpoint));
    
    console.log('\nSummary:');
    const insecureEndpoints = results.filter(r => !r.secure);
    
    if (insecureEndpoints.length > 0) {
        console.log('\n❌ Insecure Endpoints:');
        insecureEndpoints.forEach(({ endpoint, status }) => {
            console.log(`  - ${endpoint} (Status: ${status})`);
        });
    } else {
        console.log('\n✅ All endpoints are secure!');
    }
    
    console.log(`\nTotal endpoints tested: ${endpoints.length}`);
    console.log(`Secure: ${results.filter(r => r.secure).length}`);
    console.log(`Insecure: ${insecureEndpoints.length}`);
}

// Run the tests
runTests().catch(console.error); 