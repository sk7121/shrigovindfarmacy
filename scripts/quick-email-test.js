/**
 * Quick Email Test - Run after server starts
 * Usage: node scripts/quick-email-test.js test@example.com
 */

require('dotenv').config();

const testEmail = process.argv[2] || 'sksharma19121@gmail.com';

console.log('📧 Quick Email Test');
console.log('Sending to:', testEmail);
console.log('');

// Load the email service (this will initialize transporter)
const { sendOTPEmail } = require('../services/emailService');

// Generate a random OTP
const otp = Math.floor(100000 + Math.random() * 900000).toString();

console.log('Test OTP:', otp);
console.log('');

sendOTPEmail(testEmail, otp, 'email_verification')
  .then(result => {
    console.log('');
    if (result.success) {
      console.log('✅ SUCCESS! Email sent.');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ FAILED:', result.message);
      console.log('Error code:', result.code);
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.log('');
    console.log('❌ ERROR:', err.message);
    console.log('Code:', err.code);
    process.exit(1);
  });
