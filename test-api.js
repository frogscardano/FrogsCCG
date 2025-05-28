// Simple test script to verify API endpoints work
const http = require('http');

// Test the main API endpoint
function testAPI() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
}

// Test collections endpoint
function testCollections() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/collections/test-address',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`Collections Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Collections Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with collections request: ${e.message}`);
  });

  req.end();
}

console.log('Testing API endpoints...');
setTimeout(() => {
  testAPI();
  setTimeout(() => {
    testCollections();
  }, 1000);
}, 2000); 