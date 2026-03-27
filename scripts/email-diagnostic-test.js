/**
 * Email Diagnostic Test
 * Run this to diagnose OTP email issues
 * Usage: node scripts/email-diagnostic-test.js test@example.com
 */

require('dotenv').config();

const testEmail = process.argv[2] || 'sksharma19121@gmail.com';

console.log('🔍 EMAIL DIAGNOSTIC TEST');
console.log('========================\n');

// Step 1: Check environment variables
console.log('📋 STEP 1: Environment Variables Check');
console.log('--------------------------------------');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST ? '✅ ' + process.env.EMAIL_HOST : '❌ Missing');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT ? '✅ ' + process.env.EMAIL_PORT : '❌ Missing');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ ' + process.env.EMAIL_USER : '❌ Missing');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set (length: ' + process.env.EMAIL_PASS.length + ')' : '❌ Missing');
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE ? '✅ ' + process.env.EMAIL_SECURE : '⚠️  Not set (will auto-detect)');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM ? '✅ ' + process.env.EMAIL_FROM : '⚠️  Not set (will use default)');

if (process.env.EMAIL_PASS) {
  console.log('EMAIL_PASS starts with xsmtpsib-:', process.env.EMAIL_PASS.startsWith('xsmtpsib-') ? '✅ Yes' : '❌ No');
}
console.log('');

// Step 2: Check transporter initialization
console.log('📋 STEP 2: Transporter Initialization');
console.log('--------------------------------------');

const nodemailer = require('nodemailer');

const useSSL = process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_PORT === '465';
const config = {
  host: (process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim(),
  port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || (useSSL ? '465' : '587')),
  secure: useSSL,
  auth: {
    user: (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim(),
    pass: (process.env.EMAIL_PASS || process.env.SMTP_PASS || '').trim(),
  },
  connectionTimeout: 30000,
  socketTimeout: 30000,
  pool: true,
  maxConnections: 1,
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  }
};

console.log('Configuration:');
console.log('  Host:', config.host);
console.log('  Port:', config.port);
console.log('  Secure:', config.secure ? 'SSL' : 'TLS');
console.log('  User:', config.auth.user || '❌ MISSING');
console.log('  Pass length:', config.auth.pass ? config.auth.pass.length : 0);

// Check if credentials are valid
const hasValidCredentials = (
  config.auth.user &&
  config.auth.pass &&
  config.auth.user !== 'your-email@gmail.com' &&
  config.auth.pass !== 'your-app-password' &&
  config.auth.pass.startsWith('xsmtpsib-')
);

console.log('');
console.log('Credentials validation:');
console.log('  User exists:', config.auth.user ? '✅' : '❌');
console.log('  Pass exists:', config.auth.pass ? '✅' : '❌');
console.log('  Pass starts with xsmtpsib-:', config.auth.pass?.startsWith('xsmtpsib-') ? '✅' : '❌');
console.log('  Overall:', hasValidCredentials ? '✅ Valid' : '❌ Invalid');
console.log('');

if (!hasValidCredentials) {
  console.log('⚠️  WARNING: Email credentials appear invalid!');
  console.log('The EMAIL_PASS must start with "xsmtpsib-" for Brevo SMTP.');
  console.log('');
  console.log('📝 To fix this:');
  console.log('1. Go to Brevo dashboard (https://app.brevo.com/)');
  console.log('2. Navigate to: Settings > SMTP & API');
  console.log('3. Copy your SMTP key (starts with xsmtpsib-)');
  console.log('4. Update .env file: EMAIL_PASS=xsmtpsib-...');
  console.log('5. Restart the server');
  console.log('');
  process.exit(1);
}

// Step 3: Create transporter and test connection
console.log('📋 STEP 3: Creating Transporter & Testing Connection');
console.log('----------------------------------------------------');

const transporter = nodemailer.createTransport(config);

transporter.verify()
  .then(() => {
    console.log('✅ Transporter verified successfully!\n');
    
    // Step 4: Send test email
    console.log('📋 STEP 4: Sending Test OTP Email');
    console.log('-----------------------------------');
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Test OTP:', otp);
    console.log('Sending to:', testEmail);
    console.log('');
    
    const mailOptions = {
      from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || 'noreply@shrigovindpharmacy.com'}>`,
      to: testEmail,
      subject: 'Email Verification OTP - Shri Govind Pharmacy',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 30px; text-align: center; }
            .logo { font-size: 28px; font-weight: bold; }
            .content { padding: 40px 30px; }
            .otp-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px dashed #4ade80; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; }
            .otp-code { font-size: 36px; font-weight: 800; color: #22c55e; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 15px 0; }
            .footer { background: #f8f9fa; padding: 25px; text-align: center; color: #6c757d; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🌿 Shri Govind Pharmacy</div>
              <div>Your Health, Our Priority</div>
            </div>
            <div class="content">
              <h2>🌿 Verify Your Email</h2>
              <p>Thank you for registering! Please use the following OTP to verify your email address:</p>
              <div class="otp-box">
                <div style="font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 2px;">Your OTP Code</div>
                <div class="otp-code">${otp}</div>
                <div style="font-size: 14px; color: #666; margin-top: 10px;">Valid for 10 minutes</div>
              </div>
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 6px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">⏰ This OTP will expire in <strong>10 minutes</strong></p>
              </div>
              <div style="background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 6px;">
                <p style="color: #0d47a1; font-size: 14px; margin: 0;">💡 <strong>Tip:</strong> Do not share this OTP with anyone.</p>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Shri Govind Pharmacy. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };
    
    return transporter.sendMail(mailOptions);
  })
  .then(info => {
    console.log('✅ SUCCESS! Email sent.');
    console.log('Message ID:', info.messageId);
    console.log('');
    console.log('📬 Check your inbox at:', testEmail);
    console.log('');
    console.log('✅ ALL TESTS PASSED!');
    process.exit(0);
  })
  .catch(error => {
    console.log('');
    console.log('❌ ERROR:', error.message);
    console.log('Error code:', error.code || 'N/A');
    console.log('');
    
    if (error.code === 'EAUTH') {
      console.log('🔍 AUTHENTICATION ERROR:');
      console.log('  - Check if EMAIL_USER is correct');
      console.log('  - Verify EMAIL_PASS starts with "xsmtpsib-"');
      console.log('  - Ensure your Brevo account is active');
      console.log('  - Check if SMTP is enabled in Brevo dashboard');
    } else if (error.code === 'ECONNECTION' || error.message.includes('timeout')) {
      console.log('🔍 CONNECTION ERROR:');
      console.log('  - Check network connectivity');
      console.log('  - Verify firewall allows port', config.port);
      console.log('  - Try: ping smtp-relay.brevo.com');
      console.log('  - Try alternative port:', config.secure ? '587 (TLS)' : '465 (SSL)');
    } else if (error.message.includes('Sender address not verified')) {
      console.log('🔍 SENDER ERROR:');
      console.log('  - The EMAIL_FROM address must be verified in Brevo');
      console.log('  - Go to: Brevo Dashboard > Settings > Sender Addresses');
      console.log('  - Add and verify your sender email');
    }
    
    console.log('');
    console.log('❌ TEST FAILED');
    process.exit(1);
  });
