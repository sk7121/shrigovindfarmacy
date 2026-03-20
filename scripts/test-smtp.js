/**
 * SMTP Connectivity Test Script
 * Run: node scripts/test-smtp.js
 */

const net = require('net');
const tls = require('tls');
const dns = require('dns');

require('dotenv').config();

const SMTP_HOST = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const SMTP_PORT_587 = 587;
const SMTP_PORT_465 = 465;

console.log('🔍 SMTP Connectivity Test\n');
console.log('Target:', SMTP_HOST);
console.log('='.repeat(50));

// Test DNS resolution
console.log('\n📍 Step 1: DNS Resolution');
dns.resolve4(SMTP_HOST, (err, addresses) => {
  if (err) {
    console.log('❌ DNS resolution failed:', err.message);
    console.log('\n💡 Solution: Check your DNS settings or /etc/hosts file');
    return;
  }
  console.log('✅ DNS resolved to:', addresses.join(', '));
  
  // Test port 587
  testPort(SMTP_HOST, SMTP_PORT_587, false, () => {
    // Test port 465
    testPort(SMTP_HOST, SMTP_PORT_465, true, () => {
      console.log('\n' + '='.repeat(50));
      console.log('📋 Summary:');
      console.log('If both ports fail:');
      console.log('  1. Check firewall settings');
      console.log('  2. Verify network connectivity');
      console.log('  3. Contact your network administrator');
      console.log('  4. Try from a different network');
      console.log('\nIf port 587 fails but 465 works:');
      console.log('  Set EMAIL_SECURE=true in your .env file');
    });
  });
});

function testPort(host, port, isSSL, callback) {
  console.log(`\n📍 Step ${isSSL ? '3' : '2'}: Testing Port ${port} (${isSSL ? 'SSL' : 'TLS'})`);
  
  const startTime = Date.now();
  const socket = isSSL 
    ? new tls.TLSSocket()
    : new net.Socket();
  
  let connected = false;
  
  const timeout = setTimeout(() => {
    if (!connected) {
      console.log(`❌ Port ${port}: Connection timeout (>10s)`);
      socket.destroy();
      if (callback) callback();
    }
  }, 10000);
  
  socket.on('connect', () => {
    connected = true;
    const elapsed = Date.now() - startTime;
    console.log(`✅ Port ${port}: Connected in ${elapsed}ms`);
    
    if (isSSL) {
      console.log('   TLS handshake successful');
    } else {
      console.log('   Ready for STARTTLS upgrade');
    }
    
    socket.end();
    clearTimeout(timeout);
    if (callback) callback();
  });
  
  socket.on('error', (err) => {
    clearTimeout(timeout);
    console.log(`❌ Port ${port}: ${err.message}`);
    console.log('   Error code:', err.code);
    
    if (err.code === 'ENOTFOUND') {
      console.log('   💡 DNS resolution failed');
    } else if (err.code === 'ECONNREFUSED') {
      console.log('   💡 Connection refused - server may be down');
    } else if (err.code === 'ETIMEDOUT') {
      console.log('   💡 Connection timed out - firewall may be blocking');
    } else if (err.code === 'ENETUNREACH') {
      console.log('   💡 Network unreachable - check internet connection');
    }
    
    if (callback) callback();
  });
  
  socket.connect({ host, port });
}
