/**
 * Production Email Diagnostic Script
 * Run this on your production server to diagnose email issues
 * Usage: node scripts/prod-email-check.js
 */

require('dotenv').config();

console.log('🔍 Production Email Diagnostic Check\n');
console.log('='.repeat(60));

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('   EMAIL_HOST:', process.env.EMAIL_HOST || '❌ Not set');
console.log('   EMAIL_PORT:', process.env.EMAIL_PORT || '❌ Not set');
console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Not set');
console.log('   EMAIL_SECURE:', process.env.EMAIL_SECURE || 'false (TLS)');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');

// Check if credentials look valid
const passValid = process.env.EMAIL_PASS && process.env.EMAIL_PASS.startsWith('xsmtpsib-');
console.log('\n✅ Credential Check:');
console.log('   Brevo API format:', passValid ? '✅ Valid' : '❌ Invalid (should start with xsmtpsib-)');

// Test network connectivity
const net = require('net');
const tls = require('tls');
const dns = require('dns');

const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const port = parseInt(process.env.EMAIL_PORT || '587');
const useSSL = process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465';

console.log('\n🌐 Network Tests:');

// Test DNS
console.log('\n   Testing DNS resolution...');
dns.resolve4(host, (err, addresses) => {
  if (err) {
    console.log('   ❌ DNS Resolution: FAILED -', err.message);
    console.log('\n   💡 Solution: Use EMAIL_HOST=185.154.61.4 (IP address)');
    testPort(false);
  } else {
    console.log('   ✅ DNS Resolution: OK -', addresses.join(', '));
    testPort(false);
  }
});

function testPort(tryAlternative) {
  // Test configured port
  console.log(`\n   Testing ${useSSL ? 'SSL' : 'TLS'} port ${port}...`);
  
  const socket = useSSL ? new tls.TLSSocket() : new net.Socket();
  let connected = false;
  
  const timeout = setTimeout(() => {
    if (!connected) {
      console.log(`   ❌ Port ${port}: Connection timeout`);
      if (tryAlternative) {
        suggestAlternative();
      } else {
        showFinalHelp();
      }
    }
  }, 15000);
  
  socket.on('connect', () => {
    connected = true;
    clearTimeout(timeout);
    console.log(`   ✅ Port ${port}: Connection successful`);
    console.log('\n✅ Email configuration should work!');
    console.log('\n📧 Test sending with: node scripts/quick-email-test.js your@email.com');
    socket.end();
  });
  
  socket.on('error', (err) => {
    clearTimeout(timeout);
    console.log(`   ❌ Port ${port}: ${err.message}`);
    console.log(`   Error code: ${err.code}`);
    
    if (tryAlternative) {
      suggestAlternative();
    } else {
      showFinalHelp();
    }
  });
  
  socket.connect({ host, port });
}

function suggestAlternative() {
  const altPort = useSSL ? 587 : 465;
  const altSSL = !useSSL;
  
  console.log('\n💡 Suggestion: Try alternative configuration');
  console.log(`   Current: Port ${port} (${useSSL ? 'SSL' : 'TLS'})`);
  console.log(`   Try: Port ${altPort} (${altSSL ? 'SSL' : 'TLS'})`);
  console.log('\n   Update .env:');
  console.log(`   EMAIL_PORT=${altPort}`);
  console.log(`   EMAIL_SECURE=${altSSL ? 'true' : 'false'}`);
  console.log('\n   Then restart your server');
  
  showFinalHelp();
}

function showFinalHelp() {
  console.log('\n' + '='.repeat(60));
  console.log('\n🔍 Additional Troubleshooting:');
  console.log('1. Check if hosting provider blocks SMTP ports');
  console.log('2. Try: EMAIL_HOST=185.154.61.4 (direct IP)');
  console.log('3. Check Brevo dashboard: https://app.brevo.com/');
  console.log('4. Run: node scripts/test-email.js for full test');
  console.log('\n📖 See: docs/PRODUCTION_EMAIL_GUIDE.md for more help');
}
