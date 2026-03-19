/**
 * MSG91 OTP Service
 * Official MSG91 OTP API integration for sending SMS OTPs
 * Documentation: https://docs.msg91.com/collection/msg91-api-integration/67c4e158cf310e007e08b652
 */

const axios = require("axios");

// MSG91 Configuration
const MSG91_CONFIG = {
  authKey: process.env.MSG91_AUTH_KEY,
  senderId: process.env.MSG91_SENDER_ID || "SGPHAR",
  countryCode: process.env.MSG91_COUNTRY_CODE || "91", // Default India
  baseUrl: "https://api.msg91.com/api",
  mockMode: process.env.MSG91_MOCK_MODE === "true" || process.env.NODE_ENV === "test",
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
 * Send OTP via MSG91 API
 * Uses MSG91's official OTP endpoint
 * @param {string} phone - Recipient phone number (10 digits)
 * @param {string} otp - OTP to send
 * @param {string} purpose - Purpose of OTP (optional)
 * @returns {Promise<object>} - { success, messageId, error }
 */
async function sendOTPViaMSG91(phone, otp, purpose = "verification") {
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
    if (MSG91_CONFIG.mockMode) {
      console.log("🧪 MSG91 Mock Mode - OTP would be:", otp);
      return {
        success: true,
        messageId: "mock-" + Date.now(),
        mock: true,
        message: "Mock mode enabled - OTP generated but not sent",
      };
    }

    // Check if MSG91 is configured
    if (!MSG91_CONFIG.authKey || MSG91_CONFIG.authKey === "your-msg91-auth-key-here") {
      console.log("⚠️ MSG91 not configured - OTP would be:", otp);
      return {
        success: true,
        messageId: "mock-" + Date.now(),
        mock: true,
        message: "MSG91 not configured - OTP generated but not sent",
      };
    }

    // Prepare the OTP message
    const message = `Shri Govind Pharmacy: Your OTP is ${otp}. Valid for 10 minutes. Do not share this with anyone.`;

    // Option 1: Using MSG91's dedicated OTP API (v5)
    const otpUrl = `${MSG91_CONFIG.baseUrl}/v5/otp`;

    const otpPayload = {
      authkey: MSG91_CONFIG.authKey,
      mobiles: cleanedPhone,
      otp: otp,
      expiry: 10,
      sender: MSG91_CONFIG.senderId,
      channel: 4,
      type: "transactional",
    };

    // Option 2: Using regular SMS API (fallback)
    const smsUrl = `${MSG91_CONFIG.baseUrl}/sendhttp.php`;
    const smsPayload = {
      authkey: MSG91_CONFIG.authKey,
      mobiles: cleanedPhone,
      message: message,
      sender: MSG91_CONFIG.senderId,
      route: "4",
      country: MSG91_CONFIG.countryCode,
    };

    // Try OTP API first
    try {
      console.log("📤 Sending OTP via MSG91 OTP API to: +91" + cleanedPhone);
      const response = await axios.post(otpUrl, otpPayload, {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      });

      console.log("📥 MSG91 OTP API Response:", JSON.stringify(response.data, null, 2));

      if (response.data && (response.data.success || response.data.status === 200 || response.data.type === "success")) {
        console.log(
          `✅ OTP sent via MSG91 OTP API to: +91${cleanedPhone}`,
          "Message ID:",
          response.data.id || response.data.message_id,
        );
        return {
          success: true,
          messageId: response.data.id || response.data.message_id,
          provider: "MSG91",
          method: "OTP_API",
        };
      } else {
        console.log("⚠️ MSG91 OTP API returned non-success:", response.data);
        throw new Error(response.data.message || response.data.errors || "MSG91 OTP API failed");
      }
    } catch (otpApiError) {
      console.log(
        "⚠️ MSG91 OTP API failed, trying SMS API:",
        otpApiError.response?.data || otpApiError.message,
      );

      // Fallback to SMS API
      try {
        console.log("📤 Sending OTP via MSG91 SMS API to: +91" + cleanedPhone);
        const response = await axios.get(smsUrl, {
          params: smsPayload,
        });

        console.log("📥 MSG91 SMS API Response:", JSON.stringify(response.data, null, 2));

        if (response.data && (response.data.type === "success" || response.data.status === 200)) {
          console.log(
            `✅ OTP sent via MSG91 SMS API to: +91${cleanedPhone}`,
            "Message ID:",
            response.data.message_id,
          );
          return {
            success: true,
            messageId: response.data.message_id,
            provider: "MSG91",
            method: "SMS_API",
          };
        } else {
          console.log("⚠️ MSG91 SMS API returned non-success:", response.data);
          throw new Error(response.data.message || response.data.errors || "MSG91 SMS API failed");
        }
      } catch (smsApiError) {
        console.log("❌ MSG91 SMS API also failed:", smsApiError.response?.data || smsApiError.message);
        throw smsApiError;
      }
    }
  } catch (error) {
    console.error("❌ MSG91 OTP send error:", error.message);
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
 * Send OTP using MSG91's verified sender
 * This is a wrapper that handles the complete flow
 * @param {string} phone - Phone number
 * @param {string} purpose - Purpose (email_verification, password_reset, phone_verification, delivery_otp)
 * @param {number} expiryMinutes - OTP expiry time
 * @returns {Promise<object>} - { success, otp, expiresAt, messageId, error }
 */
async function sendMSG91OTP(phone, purpose = "phone_verification", expiryMinutes = 10) {
  try {
    // Generate OTP
    const otp = generateOTP(6);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Send via MSG91
    const result = await sendOTPViaMSG91(phone, otp, purpose);

    if (result.success) {
      return {
        success: true,
        otp, // Return OTP for storage in DB
        expiresAt,
        messageId: result.messageId,
        provider: "MSG91",
        message: "OTP sent successfully",
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to send OTP",
      };
    }
  } catch (error) {
    console.error("❌ sendMSG91OTP error:", error);
    return {
      success: false,
      error: error.message || "Server error while sending OTP",
    };
  }
}

/**
 * Resend OTP via MSG91
 * @param {string} phone - Phone number
 * @param {string} purpose - Purpose of OTP
 * @returns {Promise<object>}
 */
async function resendMSG91OTP(phone, purpose = "phone_verification") {
  return await sendMSG91OTP(phone, purpose);
}

/**
 * Get MSG91 configuration status
 * @returns {object}
 */
function getMSG91Config() {
  return {
    configured: !!MSG91_CONFIG.authKey,
    senderId: MSG91_CONFIG.senderId,
    countryCode: MSG91_CONFIG.countryCode,
    hasAuthKey: !!MSG91_CONFIG.authKey,
  };
}

module.exports = {
  sendOTPViaMSG91,
  sendMSG91OTP,
  resendMSG91OTP,
  generateOTP,
  validatePhone,
  getMSG91Config,
  MSG91_CONFIG,
};
