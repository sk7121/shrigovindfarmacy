// Test Email Configuration Script
// Run with: node scripts/test-email.js

require('dotenv').config();
const nodemailer = require('nodemailer');

console.log("\n========================================");
console.log("📧 Email Configuration Test");
console.log("========================================\n");

// Check environment variables
console.log("1️⃣  Environment Variables Check:");
console.log("   EMAIL_HOST:", process.env.EMAIL_HOST || "❌ Not set");
console.log("   EMAIL_PORT:", process.env.EMAIL_PORT || "❌ Not set");
console.log("   EMAIL_USER:", process.env.EMAIL_USER || "❌ Not set");
console.log("   EMAIL_PASS:", process.env.EMAIL_PASS ? "✅ Set (hidden)" : "❌ Not set");
console.log("   EMAIL_FROM:", process.env.EMAIL_FROM || "❌ Not set");

// Validate required variables
const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log("\n❌ Missing required environment variables:", missingVars.join(', '));
    console.log("   Please update your .env file\n");
    process.exit(1);
}

console.log("\n2️⃣  Creating Transporter...");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

console.log("   ✅ Transporter created");

console.log("\n3️⃣  Verifying Connection...");

transporter.verify()
    .then(() => {
        console.log("   ✅ Connection successful!");
        console.log("   ✅ SMTP server is ready to send emails\n");
        
        // Ask for test email
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Enter test email address (or press Enter to skip): ', (email) => {
            if (!email) {
                console.log("\n✅ Email configuration test completed!\n");
                readline.close();
                process.exit(0);
            }

            console.log(`\n4️⃣  Sending test email to: ${email}...`);
            
            const mailOptions = {
                from: `"Shri Govind Pharmacy Test" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: email,
                subject: "🧪 Test Email - Shri Govind Pharmacy",
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 30px; text-align: center; border-radius: 10px; }
                            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; margin-top: 0; }
                            .success-box { background: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 20px 0; }
                            .code-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h2>🌿 Shri Govind Pharmacy</h2>
                                <p>Email Configuration Test</p>
                            </div>
                            <div class="content">
                                <div class="success-box">
                                    <h3>✅ Success!</h3>
                                    <p>If you're reading this, your email configuration is working correctly.</p>
                                </div>
                                
                                <div class="code-box">
                                    <p><strong>📧 Email Details:</strong></p>
                                    <ul>
                                        <li><strong>To:</strong> ${email}</li>
                                        <li><strong>From:</strong> ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</li>
                                        <li><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</li>
                                        <li><strong>Provider:</strong> Brevo (Sendinblue)</li>
                                    </ul>
                                </div>
                                
                                <p>This is a test email to verify that the SMTP configuration is working properly for sending OTPs and other transactional emails.</p>
                                
                                <p style="margin-top: 30px;">
                                    <strong>Next Steps:</strong><br>
                                    1. Check your spam/junk folder if you don't see this email<br>
                                    2. Verify the sender email is approved in Brevo dashboard<br>
                                    3. Check Brevo account quota and status
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            transporter.sendMail(mailOptions)
                .then((info) => {
                    console.log("\n   ✅ Email sent successfully!");
                    console.log("   Message ID:", info.messageId);
                    console.log("\n✅ Email configuration test completed!\n");
                    console.log("📬 Check your inbox (and spam folder) for the test email.\n");
                    readline.close();
                    process.exit(0);
                })
                .catch((error) => {
                    console.log("\n   ❌ Failed to send email:");
                    console.log("   Error:", error.message);
                    console.log("   Code:", error.code);
                    console.log("\n🔍 Troubleshooting:");
                    
                    if (error.code === 'EAUTH') {
                        console.log("   • Authentication failed - Check EMAIL_USER and EMAIL_PASS");
                        console.log("   • EMAIL_PASS should start with 'xsmtpsib-' for Brevo");
                    }
                    if (error.code === 'ECONNECTION') {
                        console.log("   • Connection failed - Check network/firewall");
                        console.log("   • Ensure port 587 is not blocked");
                    }
                    if (error.message.includes('Sender address not verified')) {
                        console.log("   • Sender email must be verified in Brevo dashboard");
                        console.log("   • Go to Brevo > Senders & IP > Add/Verify sender");
                    }
                    
                    console.log("\n❌ Test failed. Please fix the issues above.\n");
                    readline.close();
                    process.exit(1);
                });
        });
    })
    .catch((error) => {
        console.log("   ❌ Connection failed!");
        console.log("   Error:", error.message);
        console.log("\n🔍 Troubleshooting:");
        console.log("   • Check if EMAIL_HOST is correct (smtp-relay.brevo.com)");
        console.log("   • Check if EMAIL_PORT is correct (587)");
        console.log("   • Ensure your network allows SMTP connections");
        console.log("   • Verify Brevo account is active\n");
        process.exit(1);
    });
