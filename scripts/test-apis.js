#!/usr/bin/env node

/**
 * Test script for all authenticated API endpoints
 * This script verifies that all our API endpoints are working correctly
 * with the proper authentication.
 * 
 * Usage: node test-apis.js
 */

// Import node-fetch v2 (compatible with Node.js v16)
const fetch = require('node-fetch');

// Configuration
const CONFIG = {
  apiKey: '0b760c5caff24c6c7daa3e5400cc0530',
  endpoints: {
    osrm: 'https://osrm.westchesterrtc.com',
    overpass: 'https://overpass.westchesterrtc.com/api/interpreter',
    nominatim: 'https://nominatim.westchesterrtc.com'
  },
  tests: {
    osrm: '/route/v1/driving/-73.989,40.733;-74.012,40.753',
    overpass: '?data=[out:json];node[amenity=restaurant](40.7,-74.0,40.8,-73.9);out count;',
    nominatim: '/search?q=New+York+City&format=json'
  }
};

// Test headers with API key
const headers = {
  'Accept': 'application/json',
  'User-Agent': 'API-Tester/1.0',
  'X-API-Key': CONFIG.apiKey
};

// Helper to format response
function formatResponse(data) {
  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data).length > 500 ? '...' : '');
  }
  return data.toString().substring(0, 500) + (data.toString().length > 500 ? '...' : '');
}

// Test each API endpoint
async function testEndpoints() {
  console.log('🔍 Testing authenticated API endpoints...\n');
  
  // Test OSRM
  try {
    console.log(`Testing OSRM API: ${CONFIG.endpoints.osrm}${CONFIG.tests.osrm}`);
    const osrmResponse = await fetch(`${CONFIG.endpoints.osrm}${CONFIG.tests.osrm}`, { headers });
    
    if (!osrmResponse.ok) {
      throw new Error(`HTTP error: ${osrmResponse.status}`);
    }
    
    const osrmData = await osrmResponse.json();
    console.log('✅ OSRM API test passed!');
    console.log('Response:', formatResponse(osrmData));
  } catch (error) {
    console.error('❌ OSRM API test failed!', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test Overpass
  try {
    console.log(`Testing Overpass API: ${CONFIG.endpoints.overpass}${CONFIG.tests.overpass}`);
    const overpassResponse = await fetch(`${CONFIG.endpoints.overpass}${CONFIG.tests.overpass}`, { headers });
    
    if (!overpassResponse.ok) {
      throw new Error(`HTTP error: ${overpassResponse.status}`);
    }
    
    const overpassData = await overpassResponse.json();
    console.log('✅ Overpass API test passed!');
    console.log('Response:', formatResponse(overpassData));
  } catch (error) {
    console.error('❌ Overpass API test failed!', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test Nominatim
  try {
    console.log(`Testing Nominatim API: ${CONFIG.endpoints.nominatim}${CONFIG.tests.nominatim}`);
    const nominatimResponse = await fetch(`${CONFIG.endpoints.nominatim}${CONFIG.tests.nominatim}`, { headers });
    
    if (!nominatimResponse.ok) {
      throw new Error(`HTTP error: ${nominatimResponse.status}`);
    }
    
    const nominatimData = await nominatimResponse.json();
    console.log('✅ Nominatim API test passed!');
    console.log('Response:', formatResponse(nominatimData));
  } catch (error) {
    console.error('❌ Nominatim API test failed!', error.message);
    
    // If Nominatim is still not working, suggest checking the server
    if (error.message.includes('ECONNREFUSED') || error.message.includes('502') || error.message.includes('504')) {
      console.log('\n⚠️ The Nominatim server might not be fully initialized yet.');
      console.log('Suggestions:');
      console.log('1. Check if the server is running and properly configured');
      console.log('2. Verify that the server has completed initial import');
      console.log('3. Check server logs for any error messages');
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  console.log('API testing complete!');
}

// Run the tests
testEndpoints().catch(error => {
  console.error('Error running tests:', error);
}); 