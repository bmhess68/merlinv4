/**
 * Test script to verify API endpoints are working
 * Tests both OSRM and Overpass API endpoints
 */

const testEndpoints = async () => {
  console.log('Testing API endpoints...');
  
  // Test OSRM endpoint
  try {
    console.log('Testing OSRM endpoint at http://192.168.2.109:5000...');
    const osrmResponse = await fetch('http://192.168.2.109:5000/route/v1/driving/-73.955,40.811;-73.9854,40.7488');
    
    if (osrmResponse.ok) {
      const osrmData = await osrmResponse.json();
      console.log('✅ OSRM API working!', osrmData.code);
    } else {
      console.error('❌ OSRM API returned error:', osrmResponse.status, osrmResponse.statusText);
    }
  } catch (error) {
    console.error('❌ OSRM API error:', error.message);
  }
  
  // Test Overpass endpoint
  try {
    console.log('Testing Overpass endpoint at http://192.168.2.109:8080/api/interpreter...');
    const query = 'data=[out:json];node(40.7,-74.0,40.8,-73.9)[highway=traffic_signals];out;';
    
    const overpassResponse = await fetch('http://192.168.2.109:8080/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });
    
    if (overpassResponse.ok) {
      const overpassData = await overpassResponse.json();
      console.log('✅ Overpass API working!', overpassData.elements ? 
        `Found ${overpassData.elements.length} elements` : 'No elements returned');
    } else {
      console.error('❌ Overpass API returned error:', overpassResponse.status, overpassResponse.statusText);
    }
  } catch (error) {
    console.error('❌ Overpass API error:', error.message);
  }
};

// Execute the tests
testEndpoints(); 