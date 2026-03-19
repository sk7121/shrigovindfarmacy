/**
 * SMS Notification Service
 * Configure with your SMS provider (Bravo SMS, MSG91, Twilio, TextLocal, etc.)
 */

// Example configuration for different providers
const SMS_CONFIG = {
  // Default provider
  provider: process.env.SMS_PROVIDER || "bravo",

  // Bravo SMS credentials
  bravo: {
    apiKey: process.env.BRAVO_API_KEY,
    senderId: process.env.BRAVO_SENDER_ID || "SGPHAR",
    baseUrl: process.env.BRAVO_BASE_URL || "https://api.bravo-sms.com",
  },

  // Twilio credentials
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  // MSG91 (India)
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY,
    senderId: process.env.MSG91_SENDER_ID || "SGPHAR",
  },

  // TextLocal (India)
  textlocal: {
    apiKey: process.env.TEXTLOCAL_API_KEY,
    senderId: process.env.TEXTLOCAL_SENDER_ID || "SGPHAR",
  },
};

// Send SMS using configured provider
async function sendSMS(phone, message) {
  // Validate Indian phone number
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (cleanPhone.length !== 10) {
    console.log("❌ Invalid phone number:", phone);
    return { success: false, error: "Invalid phone number" };
  }

  // Add country code if not present
  const fullPhone = cleanPhone.startsWith("91")
    ? cleanPhone
    : "91" + cleanPhone;

  try {
    switch (SMS_CONFIG.provider) {
      case "bravo":
        return await sendViaBravo(cleanPhone, message);
      case "twilio":
        return await sendViaTwilio(fullPhone, message);
      case "msg91":
        return await sendViaMSG91(cleanPhone, message);
      case "textlocal":
        return await sendViaTextLocal(fullPhone, message);
      default:
        console.log("⚠️ SMS Provider not configured. Message:", message);
        return {
          success: true,
          message: "SMS not sent (provider not configured)",
        };
    }
  } catch (error) {
    console.log("❌ SMS send error:", error.message);
    return { success: false, error: error.message };
  }
}

// Send via Bravo SMS
async function sendViaBravo(phone, message) {
  if (!SMS_CONFIG.bravo.apiKey || SMS_CONFIG.bravo.apiKey === "your-bravo-api-key-here") {
    console.log("⚠️ Bravo SMS not configured. Message:", message);
    return { success: true, message: "Bravo SMS not configured (mock mode)" };
  }

  const axios = require("axios");
  const url = `${SMS_CONFIG.bravo.baseUrl}/send`;

  const payload = {
    api_key: SMS_CONFIG.bravo.apiKey,
    to: phone,
    message: message,
    sender_id: SMS_CONFIG.bravo.senderId,
    type: "transactional",
  };

  const response = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (response.data && (response.data.success || response.data.status === "success")) {
    console.log("✅ SMS sent via Bravo SMS");
    return { success: true, messageId: response.data.message_id };
  } else {
    throw new Error(response.data.message || "Bravo SMS API error");
  }
}

// Send via Twilio
async function sendViaTwilio(phone, message) {
  if (!SMS_CONFIG.twilio.accountSid || !SMS_CONFIG.twilio.authToken) {
    throw new Error("Twilio credentials not configured");
  }

  const twilio = require("twilio");
  const client = twilio(
    SMS_CONFIG.twilio.accountSid,
    SMS_CONFIG.twilio.authToken,
  );

  const result = await client.messages.create({
    body: message,
    from: SMS_CONFIG.twilio.fromNumber,
    to: "+" + phone,
  });

  console.log("✅ SMS sent via Twilio:", result.sid);
  return { success: true, messageId: result.sid };
}

// Send via MSG91
async function sendViaMSG91(phone, message) {
  if (!SMS_CONFIG.msg91.authKey) {
    throw new Error("MSG91 credentials not configured");
  }

  const axios = require("axios");
  const url = `https://api.msg91.com/api/sendhttp.php?authkey=${SMS_CONFIG.msg91.authKey}&mobiles=${phone}&message=${encodeURIComponent(message)}&sender=${SMS_CONFIG.msg91.senderId}&route=4&country=91`;

  const response = await axios.get(url);

  if (response.data.type === "success") {
    console.log("✅ SMS sent via MSG91");
    return { success: true, messageId: response.data.message_id };
  } else {
    throw new Error(response.data.message || "MSG91 API error");
  }
}

// Send via TextLocal
async function sendViaTextLocal(phone, message) {
  if (!SMS_CONFIG.textlocal.apiKey) {
    throw new Error("TextLocal credentials not configured");
  }

  const axios = require("axios");
  const url = "https://api.textlocal.in/send/";

  const params = new URLSearchParams({
    apikey: SMS_CONFIG.textlocal.apiKey,
    numbers: phone,
    message: message,
    sender: SMS_CONFIG.textlocal.senderId,
  });

  const response = await axios.post(url, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (response.data.status === "success") {
    console.log("✅ SMS sent via TextLocal");
    return { success: true, messageId: response.data.messages[0]?.id };
  } else {
    throw new Error(
      response.data.errors?.[0]?.message || "TextLocal API error",
    );
  }
}

// Send Order Confirmation SMS
async function sendOrderConfirmationSMS(order, phone) {
  const message = `Shri Govind Pharmacy: Order ${order.tracking.orderId} confirmed! Total: ₹${Math.round(order.pricing.total)}. Track: ${process.env.BASE_URL || "http://localhost:3000"}/user/orders/${order._id}`;
  return await sendSMS(phone, message);
}

// Send Order Status Update SMS
async function sendOrderStatusSMS(order, phone, status, otp = null) {
  const statusText = status.replace(/_/g, " ").toUpperCase();
  let message = `Shri Govind Pharmacy: Order ${order.tracking.orderId} is now ${statusText}.`;

  if (status === "assigned" && otp) {
    message += ` Your delivery OTP is ${otp}. Please share this with the delivery agent.`;
  } else if (status === "out_for_delivery" && otp) {
    message += ` Your delivery OTP is ${otp}. Please share this with the delivery agent upon delivery.`;
  } else if (status === "shipped") {
    message += ` Est. delivery: ${new Date(order.tracking.estimatedDelivery).toLocaleDateString("en-IN")}`;
  }

  return await sendSMS(phone, message);
}

// Send OTP SMS
async function sendOTPSMS(phone, otp) {
  const message = `Shri Govind Pharmacy: Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`;
  return await sendSMS(phone, message);
}

async function sendCancellationOTP(agent, otp, trackingId) {
  const message = `Shri Govind Pharmacy - Cancellation Pickup OTP\n\nRequest ID: ${trackingId}\nOTP: ${otp}\n\nUse this OTP to verify item pickup. Valid for 24 hours.\n\nRegards,\nShri Govind Pharmacy`;

  return await sendSMS(agent.phone, message);
}

async function sendCancellationStatusSMS(cancellationRequest, phone, status) {
  let message = `Shri Govind Pharmacy - Cancellation Update\n\nRequest ID: ${cancellationRequest.trackingId}\n`;

  switch (status) {
    case "approved":
      message += `Status: Approved\nYour cancellation request has been approved. A delivery agent will be assigned soon.`;
      break;
    case "assigned":
      message += `Status: Agent Assigned\nAgent: ${cancellationRequest.assignedAgent?.name || "N/A"}\nContact: ${cancellationRequest.assignedAgent?.phone || "N/A"}`;
      break;
    case "otp_generated":
      message += `Status: Ready for Pickup\nA delivery agent has been assigned. Please keep your items ready for pickup.`;
      break;
    case "picked_up":
      message += `Status: Items Picked Up\nYour items have been successfully picked up. Refund will be processed soon.`;
      break;
    case "refunded":
      message += `Status: Refund Processed\nYour refund of ₹${cancellationRequest.refundAmount} has been processed successfully.`;
      break;
    case "rejected":
      message += `Status: Rejected\nReason: ${cancellationRequest.rejectionReason || "N/A"}`;
      break;
    default:
      message += `Status: ${status}`;
  }

  message += `\n\nRegards,\nShri Govind Pharmacy`;

  return await sendSMS(phone, message);
}

module.exports = {
  sendSMS,
  sendOrderConfirmationSMS,
  sendOrderStatusSMS,
  sendOTPSMS,
  sendCancellationOTP,
  sendCancellationStatusSMS,
  SMS_CONFIG,
};
