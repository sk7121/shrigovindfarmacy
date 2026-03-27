/**
 * Registration Flow Email Test
 * This simulates the exact registration flow
 */

require('dotenv').config();
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const mongoose = require('mongoose');
const OTP = require('../models/otp');
const { sendOTPEmail } = require('../services/emailService');

const testEmail = process.argv[2] || 'sksharma19121@gmail.com';
const normalizedName = testEmail.toLowerCase().trim();

console.log('🧪 REGISTRATION FLOW EMAIL TEST');
console.log('================================\n');
console.log('Test email:', testEmail);
console.log('Normalized:', normalizedName);
console.log('');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
  .then(() => {
    console.log('✅ Connected to MongoDB\n');
    runTest();
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

async function runTest() {
  try {
    // Step 1: Clean up any existing OTPs for this email
    console.log('📋 STEP 1: Cleaning up existing OTPs');
    console.log('------------------------------------');
    const deleted = await OTP.deleteMany({
      email: normalizedName,
      purpose: 'email_verification',
      isUsed: false
    });
    console.log(`Deleted ${deleted.deletedCount} existing OTP(s)\n`);

    // Step 2: Generate OTP (simulating registration flow)
    console.log('📋 STEP 2: Generating OTP');
    console.log('-------------------------');
    const { otp, expiresAt } = await OTP.createOTP(
      normalizedName,
      'email_verification',
      10
    );
    console.log('Generated OTP:', otp);
    console.log('Expires at:', expiresAt);
    console.log('');

    // Step 3: Send OTP email (exactly like registration flow)
    console.log('📋 STEP 3: Sending OTP Email');
    console.log('-----------------------------');
    console.log('Sending to:', normalizedName);
    console.log('Purpose: email_verification');
    console.log('');

    const emailResult = await sendOTPEmail(
      normalizedName,
      otp,
      'email_verification'
    );

    console.log('');
    console.log('Email Result:');
    console.log('  Success:', emailResult.success);
    if (!emailResult.success) {
      console.log('  Message:', emailResult.message);
      console.log('  Code:', emailResult.code);
      console.log('');
      console.log('❌ TEST FAILED: Email sending failed');
      process.exit(1);
    } else {
      console.log('  Message ID:', emailResult.messageId);
      console.log('');
      console.log('✅ TEST PASSED: Email sent successfully!');
      console.log('');
      console.log('📬 Check your inbox at:', testEmail);
      console.log('The OTP is:', otp);
    }

    // Cleanup
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ TEST ERROR:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}
