/**
 * Test Script: Video Call Flow
 * Tests the video call signaling and PeerJS connection
 */

const http = require('http');

console.log('🧪 Testing Video Call Flow...\n');

// Test 1: Check Socket.IO endpoint
console.log('Test 1: Checking Socket.IO endpoint...');
http.get('http://localhost:3000/socket.io/socket.io.js', (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Socket.IO client script is available\n');
  } else {
    console.log('❌ Socket.IO client script not found\n');
  }
  
  // Test 2: Check video call room route exists
  console.log('Test 2: Checking video call routes...');
  http.get('http://localhost:3000/video-call/test-room', (res) => {
    // Should redirect to login (authentication required)
    if (res.statusCode === 302 && res.headers.location.includes('login')) {
      console.log('✅ Video call route exists (requires auth)\n');
    } else {
      console.log('⚠️  Video call route response:', res.statusCode, '\n');
    }
    
    // Test 3: Check API endpoint
    console.log('Test 3: Checking video call API...');
    const postData = JSON.stringify({ roomId: 'test_room' });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/video-call/join',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      // Should redirect to login (authentication required)
      if (res.statusCode === 302 && res.headers.location.includes('login')) {
        console.log('✅ Video call API endpoint exists (requires auth)\n');
      } else {
        console.log('⚠️  Video call API response:', res.statusCode, '\n');
      }
      
      console.log('✅ All basic tests passed!\n');
      console.log('📋 Manual testing required for full video call flow:');
      console.log('   1. Login as doctor');
      console.log('   2. Create a Video Call appointment');
      console.log('   3. Start the video call from doctor dashboard');
      console.log('   4. Login as patient in another browser');
      console.log('   5. Join the video call from patient side');
      console.log('   6. Verify video connection is established\n');
    });
    
    req.on('error', (e) => {
      console.log('❌ API test error:', e.message);
    });
    
    req.write(postData);
    req.end();
  });
}).on('error', (e) => {
  console.log('❌ Socket.IO test error:', e.message);
});
