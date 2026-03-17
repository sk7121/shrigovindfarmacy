const nodemailer = require("nodemailer");

// Create transporter with proper error handling
const createTransporter = () => {
  const config = {
    host: process.env.EMAIL_HOST || process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
    },
  };

  // Only create transporter if credentials exist
  if (
    !config.auth.user ||
    !config.auth.pass ||
    config.auth.user === "your-email@gmail.com" ||
    config.auth.pass === "your-app-password"
  ) {
    console.log("⚠️  Email not configured - notifications will be skipped");
    return null;
  }

  const transporter = nodemailer.createTransport(config);

  // Verify transporter
  transporter.verify((error, success) => {
    if (error) {
      console.log("❌ Email configuration error:", error.message);
    } else {
      console.log("✅ Email server ready to send messages");
    }
  });

  return transporter;
};

const transporter = createTransporter();

// Send Order Confirmation Email
async function sendOrderConfirmation(order, user) {
  if (!transporter) {
    console.log("⚠️  Email not sent - transporter not configured");
    return;
  }

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || "noreply@shrigovindpharmacy.com"}>`,
    to: user.email,
    subject: "Order Confirmation - " + order.tracking.orderId,
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1c8125, #145a1a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .logo { font-size: 24px; font-weight: bold; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                    .order-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .order-id { font-size: 20px; font-weight: bold; color: #1c8125; }
                    .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    .items-table th { background: #f1f1f1; padding: 10px; text-align: left; }
                    .items-table td { padding: 10px; border-bottom: 1px solid #eee; }
                    .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    .btn { display: inline-block; padding: 12px 30px; background: #1c8125; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🌿 Shri Govind Pharmacy</div>
                        <p>Authentic Ayurvedic Products</p>
                    </div>
                    <div class="content">
                        <h2>Thank you for your order, ${user.name}!</h2>
                        <p>Your order has been confirmed and will be processed shortly.</p>
                        
                        <div class="order-box">
                            <div class="order-id">Order ID: ${order.tracking.orderId}</div>
                            <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString("en-IN")}</p>
                            <p><strong>Delivery Address:</strong><br>
                            ${order.address.fullName}<br>
                            ${order.address.address}<br>
                            ${order.address.city}, ${order.address.state} - ${order.address.pincode}</p>
                        </div>
                        
                        <h3>Order Items</h3>
                        <table class="items-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.items
                                  .map(
                                    (item) => `
                                    <tr>
                                        <td>${item.name}</td>
                                        <td>${item.quantity}</td>
                                        <td>₹${item.subtotal}</td>
                                    </tr>
                                `,
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                        
                        <div class="total">
                            Total: ₹${Math.round(order.pricing.total)}
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="${process.env.BASE_URL || "http://localhost:3000"}/user/orders/${order._id}" class="btn">Track Your Order</a>
                        </div>
                        
                        <p style="margin-top: 30px;">
                            <strong>Need Help?</strong><br>
                            Email: support@shrigovindpharmacy.com<br>
                            Phone: +91 9413010731
                        </p>
                    </div>
                    <div class="footer">
                        <p>© 2025 Shri Govind Pharmacy. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Order confirmation email sent to:", user.email);
    return { success: true };
  } catch (error) {
    console.log("❌ Error sending order confirmation:", error.message);
    return { success: false, error: error.message };
  }
}

// Send Order Status Update Email
async function sendOrderStatusUpdate(order, user, newStatus) {
  if (!transporter) {
    console.log("⚠️  Email not sent - transporter not configured");
    return;
  }

  const statusMessages = {
    confirmed: "Your order has been confirmed",
    processing: "Your order is being processed",
    shipped: "Your order has been shipped",
    out_for_delivery: "Your order is out for delivery",
    delivered: "Your order has been delivered",
    cancelled: "Your order has been cancelled",
    refunded: "Your refund has been processed",
  };

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || "noreply@shrigovindpharmacy.com"}>`,
    to: user.email,
    subject: `Order Update - ${order.tracking.orderId}`,
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1c8125, #145a1a); color: white; padding: 20px; text-align: center; border-radius: 10px; }
                    .content { padding: 30px 20px; }
                    .status-box { background: #f8f9fa; padding: 20px; border-left: 4px solid #1c8125; margin: 20px 0; }
                    .btn { display: inline-block; padding: 12px 30px; background: #1c8125; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🌿 Order Update</h2>
                    </div>
                    <div class="content">
                        <p>Dear ${user.name},</p>
                        <div class="status-box">
                            <h3>${statusMessages[newStatus] || "Order status updated"}</h3>
                            <p><strong>Order ID:</strong> ${order.tracking.orderId}</p>
                            <p><strong>New Status:</strong> ${newStatus.replace("_", " ").toUpperCase()}</p>
                            ${order.tracking.estimatedDelivery ? `<p><strong>Estimated Delivery:</strong> ${new Date(order.tracking.estimatedDelivery).toLocaleDateString("en-IN")}</p>` : ""}
                        </div>
                        <p style="text-align: center;">
                            <a href="${process.env.BASE_URL || "http://localhost:3000"}/user/orders/${order._id}" class="btn">View Order Details</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Order status email sent to:", user.email);
    return { success: true };
  } catch (error) {
    console.log("❌ Error sending status update:", error.message);
    return { success: false, error: error.message };
  }
}

// Send Welcome Email
async function sendWelcomeEmail(user) {
  if (!transporter) {
    console.log("⚠️  Email not sent - transporter not configured");
    return;
  }

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || "noreply@shrigovindpharmacy.com"}>`,
    to: user.email,
    subject: "Welcome to Shri Govind Pharmacy!",
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1c8125, #145a1a); color: white; padding: 30px; text-align: center; border-radius: 10px; }
                    .content { padding: 30px 20px; }
                    .btn { display: inline-block; padding: 12px 30px; background: #1c8125; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>🌿 Welcome to Shri Govind Pharmacy!</h2>
                    </div>
                    <div class="content">
                        <p>Dear ${user.name},</p>
                        <p>Thank you for creating an account with us. We're excited to have you as part of our family!</p>
                        <p>Explore our wide range of authentic Ayurvedic products and enjoy:</p>
                        <ul>
                            <li>✅ 100% Authentic Products</li>
                            <li>✅ Fast Pan-India Delivery</li>
                            <li>✅ Free Ayurvedic Doctor Consultation</li>
                            <li>✅ Easy Returns & Refunds</li>
                        </ul>
                        <p style="text-align: center;">
                            <a href="${process.env.BASE_URL || "http://localhost:3000"}/home#product" class="btn">Start Shopping</a>
                        </p>
                        <p>Use code <strong>WELCOME20</strong> for 20% off on your first order!</p>
                    </div>
                </div>
            </body>
            </html>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Welcome email sent to:", user.email);
    return { success: true };
  } catch (error) {
    console.log("❌ Error sending welcome email:", error.message);
    return { success: false, error: error.message };
  }
}

// Send OTP Verification Email
async function sendOTPEmail(
  email,
  otp,
  purpose = "email_verification",
  userName = "",
) {
  if (!transporter) {
    console.log("⚠️  Email not sent - transporter not configured");
    return { success: false, message: "Email service not configured" };
  }

  const purposeConfig = {
    email_verification: {
      subject: "Email Verification OTP - Shri Govind Pharmacy",
      title: "🌿 Verify Your Email",
      message:
        "Thank you for registering! Please use the following OTP to verify your email address:",
      action: "Verify Email",
    },
    password_reset: {
      subject: "Password Reset OTP - Shri Govind Pharmacy",
      title: "🔐 Password Reset OTP",
      message:
        "You requested to reset your password. Please use the following OTP:",
      action: "Reset Password",
    },
    phone_verification: {
      subject: "Phone Verification OTP - Shri Govind Pharmacy",
      title: "📱 Verify Your Phone",
      message: "Please use the following OTP to verify your phone number:",
      action: "Verify Phone",
    },
  };

  const config = purposeConfig[purpose] || purposeConfig.email_verification;
  const expiryMinutes = 10;

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || "noreply@shrigovindpharmacy.com"}>`,
    to: email,
    subject: config.subject,
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 30px; text-align: center; }
                    .logo { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
                    .tagline { font-size: 14px; opacity: 0.9; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 18px; color: #1a1a1a; margin-bottom: 15px; }
                    .message { font-size: 16px; color: #555; margin-bottom: 25px; }
                    .otp-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px dashed #4ade80; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; }
                    .otp-code { font-size: 36px; font-weight: 800; color: #22c55e; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 15px 0; }
                    .otp-label { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 2px; }
                    .expiry-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 6px; }
                    .expiry-text { color: #856404; font-size: 14px; }
                    .expiry-time { font-weight: bold; color: #d68910; }
                    .info-box { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 6px; }
                    .info-text { color: #0d47a1; font-size: 14px; margin: 5px 0; }
                    .footer { background: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e9ecef; }
                    .footer-text { color: #6c757d; font-size: 13px; margin: 8px 0; }
                    .social-links { margin-top: 15px; }
                    .social-link { display: inline-block; margin: 0 8px; color: #4ade80; text-decoration: none; font-size: 14px; }
                    .security-note { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 13px; color: #92400e; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🌿 Shri Govind Pharmacy</div>
                        <div class="tagline">Your Health, Our Priority</div>
                    </div>

                    <div class="content">
                        <h2 style="color: #1a1a1a; margin-bottom: 20px;">${config.title}</h2>

                        ${userName ? `<p class="greeting">Dear ${userName},</p>` : ""}

                        <p class="message">${config.message}</p>

                        <div class="otp-box">
                            <div class="otp-label">Your OTP Code</div>
                            <div class="otp-code">${otp}</div>
                            <div style="font-size: 14px; color: #666; margin-top: 10px;">Valid for ${expiryMinutes} minutes</div>
                        </div>

                        <div class="expiry-box">
                            <p class="expiry-text">⏰ This OTP will expire in <span class="expiry-time">${expiryMinutes} minutes</span></p>
                        </div>

                        <div class="info-box">
                            <p class="info-text">💡 <strong>Tip:</strong> Do not share this OTP with anyone. Our team will never ask for your password or OTP.</p>
                        </div>

                        <div class="security-note">
                            <strong>🔒 Security Note:</strong> If you didn't request this OTP, please ignore this email or contact our support team.
                        </div>
                    </div>

                    <div class="footer">
                        <p class="footer-text">© ${new Date().getFullYear()} Shri Govind Pharmacy. All rights reserved.</p>
                        <p class="footer-text">📍 Shop No. 123, Main Market, City - 123456</p>
                        <p class="footer-text">📞 +91 98765 43210 | ✉️ support@shrigovindpharmacy.com</p>
                        <div class="social-links">
                            <a href="#" class="social-link">Facebook</a> •
                            <a href="#" class="social-link">Instagram</a> •
                            <a href="#" class="social-link">Twitter</a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ ${config.action} OTP sent to: ${email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ ${config.action} OTP email failed:`, error.message);
    return { success: false, message: error.message };
  }
}

// Send Password Reset Link Email
async function sendPasswordResetEmail(user, resetUrl) {
  if (!transporter) {
    console.log("⚠️  Email not sent - transporter not configured");
    return { success: false, message: "Email service not configured" };
  }

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || "noreply@shrigovindpharmacy.com"}>`,
    to: user.email,
    subject: "Password Reset - Shri Govind Pharmacy",
    html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
                    .header { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 30px; text-align: center; }
                    .logo { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
                    .tagline { font-size: 14px; opacity: 0.9; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 18px; color: #1a1a1a; margin-bottom: 15px; }
                    .message { font-size: 16px; color: #555; margin-bottom: 25px; }
                    .button { display: inline-block; background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; transition: all 0.3s; }
                    .button:hover { background: linear-gradient(135deg, #22c55e, #16a34a); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4); }
                    .link-box { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin: 20px 0; word-break: break-all; }
                    .link-text { font-size: 13px; color: #666; font-family: 'Courier New', monospace; }
                    .expiry-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 6px; }
                    .expiry-text { color: #856404; font-size: 14px; }
                    .expiry-time { font-weight: bold; color: #d68910; }
                    .info-box { background: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 6px; }
                    .info-text { color: #0d47a1; font-size: 14px; margin: 5px 0; }
                    .footer { background: #f8f9fa; padding: 25px; text-align: center; border-top: 1px solid #e9ecef; }
                    .footer-text { color: #6c757d; font-size: 13px; margin: 8px 0; }
                    .social-links { margin-top: 15px; }
                    .social-link { display: inline-block; margin: 0 8px; color: #4ade80; text-decoration: none; font-size: 14px; }
                    .security-note { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 13px; color: #92400e; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">🌿 Shri Govind Pharmacy</div>
                        <div class="tagline">Your Health, Our Priority</div>
                    </div>

                    <div class="content">
                        <h2 style="color: #1a1a1a; margin-bottom: 20px;">🔐 Password Reset Request</h2>

                        <p class="greeting">Hello ${user.name || "there"},</p>

                        <p class="message">We received a request to reset your password. Click the button below to reset your password:</p>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>

                        <p class="message">Or copy and paste this link into your browser:</p>
                        <div class="link-box">
                            <div class="link-text">${resetUrl}</div>
                        </div>

                        <div class="expiry-box">
                            <p class="expiry-text">⏰ This link will expire in <span class="expiry-time">1 hour</span></p>
                        </div>

                        <div class="info-box">
                            <p class="info-text">💡 <strong>Tip:</strong> If you can't click the button, copy and paste the entire URL into your browser's address bar.</p>
                        </div>

                        <div class="security-note">
                            <strong>🔒 Security Note:</strong> If you didn't request this password reset, please ignore this email or contact our support team immediately. Your password will remain unchanged.
                        </div>
                    </div>

                    <div class="footer">
                        <p class="footer-text">© ${new Date().getFullYear()} Shri Govind Pharmacy. All rights reserved.</p>
                        <p class="footer-text">📍 Shop No. 123, Main Market, City - 123456</p>
                        <p class="footer-text">📞 +91 98765 43210 | ✉️ support@shrigovindpharmacy.com</p>
                        <div class="social-links">
                            <a href="#" class="social-link">Facebook</a> •
                            <a href="#" class="social-link">Instagram</a> •
                            <a href="#" class="social-link">Twitter</a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${user.email}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Password reset email failed:`, error.message);
    return { success: false, message: error.message };
  }
}

async function sendCancellationRequestNotification(cancellationRequest) {
  if (!transporter) {
    console.log(
      "⚠️  Cancellation request notification not sent - transporter not configured",
    );
    return;
  }

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || "noreply@shrigovindpharmacy.com"}>`,
    to: process.env.ADMIN_EMAIL || "admin@shrigovindpharmacy.com",
    subject: "New Cancellation Request - " + cancellationRequest.trackingId,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>New Cancellation Request</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1c8125; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .request-details { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
                .status-badge { display: inline-block; padding: 5px 10px; background: #ffc107; color: #000; border-radius: 3px; }
                .footer { text-align: center; padding: 20px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔔 New Cancellation Request</h1>
                </div>
                <div class="content">
                    <p>A new cancellation request has been submitted and requires your attention.</p>

                    <div class="request-details">
                        <h3>Request Details:</h3>
                        <p><strong>Request ID:</strong> ${cancellationRequest.trackingId}</p>
                        <p><strong>Order ID:</strong> ${cancellationRequest.order.tracking?.orderId || cancellationRequest.order._id}</p>
                        <p><strong>Customer:</strong> ${cancellationRequest.user.name} (${cancellationRequest.user.email})</p>
                        <p><strong>Reason:</strong> ${cancellationRequest.reason}</p>
                        <p><strong>Description:</strong> ${cancellationRequest.description}</p>
                        <p><strong>Refund Amount:</strong> ₹${cancellationRequest.refundAmount}</p>
                        <p><strong>Status:</strong> <span class="status-badge">${cancellationRequest.status}</span></p>
                        <p><strong>Requested At:</strong> ${new Date(cancellationRequest.createdAt).toLocaleString()}</p>
                    </div>

                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${process.env.ADMIN_PANEL_URL || "http://localhost:3000"}/admin/cancellations" style="background: #1c8125; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review Request</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Shri Govind Pharmacy - Admin Notification</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Cancellation request notification sent to admin`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(
      `❌ Cancellation request notification failed:`,
      error.message,
    );
    return { success: false, message: error.message };
  }
}

async function sendCancellationStatusUpdate(cancellationRequest) {
  if (!transporter) {
    console.log(
      "⚠️  Cancellation status update not sent - transporter not configured",
    );
    return;
  }

  const statusMessages = {
    approved: "Your cancellation request has been approved",
    rejected: "Your cancellation request has been rejected",
    assigned: "A delivery agent has been assigned to pick up your items",
    otp_generated: "OTP has been generated for item pickup",
    picked_up: "Your items have been successfully picked up",
    refunded: "Your refund has been processed successfully",
  };

  const mailOptions = {
    from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || "noreply@shrigovindpharmacy.com"}>`,
    to: cancellationRequest.user.email,
    subject: `Cancellation Request Update - ${cancellationRequest.trackingId}`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Cancellation Request Update</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #1c8125; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .status-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; text-align: center; }
                .status-approved { background: #d4edda; color: #155724; }
                .status-rejected { background: #f8d7da; color: #721c24; }
                .status-assigned { background: #d1ecf1; color: #0c5460; }
                .status-picked_up { background: #d4edda; color: #155724; }
                .status-refunded { background: #d4edda; color: #155724; }
                .footer { text-align: center; padding: 20px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📦 Cancellation Request Update</h1>
                </div>
                <div class="content">
                    <div class="status-box status-${cancellationRequest.status}">
                        <h3>${statusMessages[cancellationRequest.status] || "Status Update"}</h3>
                    </div>

                    <p><strong>Request ID:</strong> ${cancellationRequest.trackingId}</p>
                    <p><strong>Order ID:</strong> ${cancellationRequest.order.tracking?.orderId || cancellationRequest.order._id}</p>

                    ${cancellationRequest.assignedAgent ? `<p><strong>Assigned Agent:</strong> ${cancellationRequest.assignedAgent.name} (${cancellationRequest.assignedAgent.phone})</p>` : ""}

                    ${cancellationRequest.rejectionReason ? `<p><strong>Rejection Reason:</strong> ${cancellationRequest.rejectionReason}</p>` : ""}

                    ${cancellationRequest.adminNotes ? `<p><strong>Admin Notes:</strong> ${cancellationRequest.adminNotes}</p>` : ""}

                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/user/cancellations/${cancellationRequest._id}" style="background: #1c8125; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a>
                    </div>
                </div>
                <div class="footer">
                    <p>Shri Govind Pharmacy</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ Cancellation status update sent to: ${cancellationRequest.user.email}`,
    );
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Cancellation status update failed:`, error.message);
    return { success: false, message: error.message };
  }
}

module.exports = {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendWelcomeEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  transporter,
};
