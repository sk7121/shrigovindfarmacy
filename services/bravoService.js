/**
 * Bravo SMS OTP Service
 * Integration with Bravo SMS API for sending SMS OTPs
 * Documentation: https://www.bravo-sms.com/ (replace with actual docs)
 */

const axios = require("axios");

// Bravo SMS Configuration
const BRAVO_CONFIG = {
  apiKey: process.env.BRAVO_API_KEY,
  senderId: process.env.BRAVO_SENDER_ID || "SGPHAR",
  baseUrl: process.env.BRAVO_BASE_URL || "https://api.bravo-sms.com",
  mockMode: process.env.BRAVO_MOCK_MODE === "true" || process.env.NODE_ENV === "test",
};

/**
 * Generate a random numeric OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} - Generated OTP
 */
const generateOTP = (length = 6) => {
  const chars = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += chars[Math.floor(Math.random() * chars.length)];
  }
  return otp;
};

/**
 * Validate Indian phone number
 * @param {string} phone - Phone number to validate
 * @returns {object} - { isValid, cleanedPhone }
 */
const validatePhone = (phone) => {
  if (!phone) return { isValid: false, error: "Phone number is required" };

  // Remove all non-numeric characters
  const cleaned = phone.replace(/[^0-9]/g, "");

  // Handle different formats
  let normalized = cleaned;
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    normalized = cleaned.substring(2); // Remove country code
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    normalized = cleaned.substring(1); // Remove leading 0
  }

  // Must be 10 digits for Indian numbers
  if (normalized.length !== 10) {
    return {
      isValid: false,
      error: "Invalid phone number. Must be 10 digits",
    };
  }

  return { isValid: true, cleanedPhone: normalized };
};

/**
 * Send OTP via Bravo SMS API
 * @param {string} phone - Recipient phone number (10 digits)
 * @param {string} otp - OTP to send
 * @param {string} purpose - Purpose of OTP (optional)
 * @returns {Promise<object>} - { success, messageId, error }
 */
async function sendOTPViaBravo(phone, otp, purpose = "verification") {
  try {
    // Validate phone number
    const validation = validatePhone(phone);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const cleanedPhone = validation.cleanedPhone;

    // Check if mock mode is enabled
    if (BRAVO_CONFIG.mockMode) {
      console.log("🧪 Bravo SMS Mock Mode - OTP would be:", otp);
      return {
        success: true,
        messageId: "mock-" + Date.now(),
        mock: true,
        message: "Mock mode enabled - OTP generated but not sent",
      };
    }

    // Check if Bravo SMS is configured
    if (!BRAVO_CONFIG.apiKey || BRAVO_CONFIG.apiKey === "your-bravo-api-key-here") {
      console.log("⚠️ Bravo SMS not configured - OTP would be:", otp);
      return {
        success: true,
        messageId: "mock-" + Date.now(),
        mock: true,
        message: "Bravo SMS not configured - OTP generated but not sent",
      };
    }

    // Prepare the OTP message
    const message = `Shri Govind Pharmacy: Your OTP is ${otp}. Valid for 10 minutes. Do not share this with anyone.`;

    // Bravo SMS API endpoint (adjust based on actual Bravo API documentation)
    const smsUrl = `${BRAVO_CONFIG.baseUrl}/send`;

    const payload = {
      api_key: BRAVO_CONFIG.apiKey,
      to: cleanedPhone,
      message: message,
      sender_id: BRAVO_CONFIG.senderId,
      type: "transactional",
    };

    console.log("📤 Sending OTP via Bravo SMS to: +91" + cleanedPhone);
    const response = await axios.post(smsUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("📥 Bravo SMS Response:", JSON.stringify(response.data, null, 2));

    // Adjust response parsing based on actual Bravo API response format
    if (response.data && (response.data.success || response.data.status === "success" || response.data.status === 200)) {
      console.log(
        `✅ OTP sent via Bravo SMS to: +91${cleanedPhone}`,
        "Message ID:",
        response.data.message_id || response.data.id || response.data.sms_id,
      );
      return {
        success: true,
        messageId: response.data.message_id || response.data.id || response.data.sms_id,
        provider: "Bravo",
      };
    } else {
      console.log("⚠️ Bravo SMS returned non-success:", response.data);
      throw new Error(response.data.message || response.data.error || "Bravo SMS API failed");
    }
  } catch (error) {
    console.error("❌ Bravo SMS send error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.message || "Failed to send OTP",
      details: error.response?.data,
    };
  }
}

/**
 * Send OTP using Bravo SMS
 * This is a wrapper that handles the complete flow
 * @param {string} phone - Phone number
 * @param {string} purpose - Purpose (email_verification, password_reset, phone_verification, delivery_otp)
 * @param {number} expiryMinutes - OTP expiry time
 * @returns {Promise<object>} - { success, otp, expiresAt, messageId, error }
 */
async function sendBravoOTP(phone, purpose = "phone_verification", expiryMinutes = 10) {
  try {
    // Generate OTP
    const otp = generateOTP(6);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Send via Bravo SMS
    const result = await sendOTPViaBravo(phone, otp, purpose);

    if (result.success) {
      return {
        success: true,
        otp, // Return OTP for storage in DB
        expiresAt,
        messageId: result.messageId,
        provider: "Bravo",
        message: "OTP sent successfully",
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to send OTP",
      };
    }
  } catch (error) {
    console.error("❌ sendBravoOTP error:", error);
    return {
      success: false,
      error: error.message || "Server error while sending OTP",
    };
  }
}

/**
 * Resend OTP via Bravo SMS
 * @param {string} phone - Phone number
 * @param {string} purpose - Purpose of OTP
 * @returns {Promise<object>}
 */
async function resendBravoOTP(phone, purpose = "phone_verification") {
  return await sendBravoOTP(phone, purpose);
}

/**
 * Get Bravo SMS configuration status
 * @returns {object}
 */
function getBravoConfig() {
  return {
    configured: !!BRAVO_CONFIG.apiKey,
    senderId: BRAVO_CONFIG.senderId,
    baseUrl: BRAVO_CONFIG.baseUrl,
    hasApiKey: !!BRAVO_CONFIG.apiKey,
  };
}

module.exports = {
  sendOTPViaBravo,
  sendBravoOTP,
  resendBravoOTP,
  generateOTP,
  validatePhone,
  getBravoConfig,
  BRAVO_CONFIG,
};
