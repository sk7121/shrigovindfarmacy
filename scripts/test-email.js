/**
 * Email Test Script
 * Tests multiple SMTP configurations to find one that works
 * Run: node scripts/test-email.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

// Multiple configurations to try
const configurations = [
  {
    name: 'Brevo SMTP (Port 587, TLS)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false
  },
  {
    name: 'Brevo SMTP (Port 465, SSL)',
    host: 'smtp-relay.brevo.com',
    port: 465,
    secure: true
  },
  {
    name: 'Sendinblue SMTP (Port 587, TLS)',
    host: 'smtp.sendinblue.com',
    port: 587,
    secure: false
  },
  {
    name: 'Brevo Direct IP (Port 587)',
    host: '185.154.61.4',
    port: 587,
    secure: false
  }
];

const testEmail = process.env.EMAIL_USER || 'a3d374001@smtp-brevo.com';
const testPass = process.env.EMAIL_PASS;
const testFrom = process.env.EMAIL_FROM || 'sksharma19121@gmail.com';
const testTo = process.env.TEST_EMAIL || testFrom; // Send to yourself for testing

console.log('📧 Email Configuration Test\n');
console.log('Testing', configurations.length, 'configurations...\n');
console.log('From:', testFrom);
console.log('To:', testTo || 'Not set (will skip send test)');
console.log('='.repeat(60));

async function testConfig(config) {
  console.log(`\n🔍 Testing: ${config.name}`);
  console.log(`   Host: ${config.host}:${config.port}`);
  
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 8000,
    socketTimeout: 8000,
    auth: {
      user: testEmail,
      pass: testPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Test connection
    await transporter.verify();
    console.log(`   ✅ Connection: SUCCESS`);
    
    // Try to send test email if testTo is set
    if (testTo) {
      try {
        const info = await transporter.sendMail({
          from: `"Shri Govind Pharmacy Test" <${testFrom}>`,
          to: testTo,
          subject: '🧪 SMTP Test Email',
          text: `This is a test email from ${config.name}\n\nTimestamp: ${new Date().toISOString()}\n\nIf you received this, the configuration works!`,
          html: `
            <h2>🧪 SMTP Test Email</h2>
            <p><strong>Configuration:</strong> ${config.name}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p>If you received this, the configuration works! ✅</p>
            <hr>
            <p><em>Shri Govind Pharmacy - Email System Test</em></p>
          `
        });
        console.log(`   ✅ Email Sent: SUCCESS (Message ID: ${info.messageId})`);
        return { success: true, config, messageId: info.messageId };
      } catch (sendErr) {
        console.log(`   ⚠️ Email Send: FAILED - ${sendErr.message}`);
        return { success: 'sent_but_error', config, error: sendErr.message };
      }
    } else {
      console.log(`   ℹ️ Email Send: SKIPPED (set TEST_EMAIL env to test sending)`);
      return { success: 'connected', config };
    }
  } catch (err) {
    console.log(`   ❌ Connection: FAILED - ${err.message}`);
    console.log(`   Error Code: ${err.code || 'N/A'}`);
    return { success: false, config, error: err.message };
  }
}

async function runTests() {
  const results = [];
  
  for (const config of configurations) {
    const result = await testConfig(config);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary\n');
  
  const successful = results.filter(r => r.success === true);
  const connected = results.filter(r => r.success === 'connected' || r.success === 'sent_but_error');
  const failed = results.filter(r => r.success === false);
  
  if (successful.length > 0) {
    console.log('✅ WORKING CONFIGURATIONS:');
    successful.forEach(r => {
      console.log(`   - ${r.config.name}`);
    });
    console.log('\n💡 Recommended: Use the first working configuration in your .env file');
  } else if (connected.length > 0) {
    console.log('⚠️ PARTIALLY WORKING:');
    connected.forEach(r => {
      console.log(`   - ${r.config.name} (connected but send failed)`);
    });
  } else {
    console.log('❌ ALL CONFIGURATIONS FAILED');
    console.log('\n🔍 Troubleshooting:');
    console.log('   1. Check your Brevo API credentials');
    console.log('   2. Verify sender email is confirmed in Brevo dashboard');
    console.log('   3. Check firewall/network settings');
    console.log('   4. Try from a different network');
    console.log('   5. Contact your hosting provider about SMTP blocking');
  }
  
  console.log('\n📋 Detailed Results:');
  results.forEach((r, i) => {
    const status = r.success === true ? '✅' : r.success === false ? '❌' : '⚠️';
    console.log(`   ${i + 1}. ${status} ${r.config.name}: ${r.error || 'OK'}`);
  });
}

runTests().catch(console.error);
