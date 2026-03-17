const OTP = require("../models/otp");
const User = require("../models/user");
const DeliveryAgent = require("../models/deliveryAgent");
const { sendOTPEmail } = require("../services/emailService");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// @desc    Send OTP for email verification or password reset
// @route   POST /api/otp/send
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email, purpose = "email_verification" } = req.body;

    // Validate email
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Check if user exists for password reset
    if (purpose === "password_reset") {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email address",
        });
      }
    }

    // Check if email already verified (for new registration)
    if (purpose === "email_verification") {
      const existingUser = await User.findOne({ email, isEmailVerified: true });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "This email is already verified. Please login instead.",
        });
      }
    }

    // Generate and save OTP
    const { otp, expiresAt } = await OTP.createOTP(email, purpose, 10);

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp, purpose);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "OTP sent successfully to your email",
      expiresAt,
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error sending OTP. Please try again.",
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/otp/verify
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose = "email_verification" } = req.body;
    const redirect = req.query.redirect || req.body.redirect; // Get redirect from query or body

    console.log(
      "[OTP Verify] Email:",
      email,
      "Purpose:",
      purpose,
      "OTP:",
      otp,
      "Redirect:",
      redirect,
    );
    console.log(
      "[OTP Verify] Session pendingRegistration:",
      req.session.pendingRegistration,
    );

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      });
    }

    // Verify OTP
    const result = await OTP.verifyOTP(email, otp, purpose);

    if (!result.success) {
      console.log("[OTP Verify] OTP verification failed:", result.message);
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    console.log("[OTP Verify] OTP verified successfully");

    // For email verification during registration
    if (purpose === "email_verification") {
      // Check if there's a pending registration in session
      const pendingRegistration = req.session.pendingRegistration;

      if (!pendingRegistration) {
        console.log("[OTP Verify] No pending registration found in session");
        // Check if user already exists and just needs email verification
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          existingUser.isEmailVerified = true;
          existingUser.emailVerifiedAt = new Date();
          await existingUser.save();

          // Generate tokens for existing user
          const accessToken = jwt.sign(
            { userId: existingUser._id, email: existingUser.email },
            process.env.ACCESS_SECRET,
            { expiresIn: "15m" },
          );

          const refreshToken = jwt.sign(
            { userId: existingUser._id },
            process.env.REFRESH_SECRET,
            { expiresIn: "7d" },
          );

          existingUser.refreshToken = refreshToken;
          await existingUser.save();

          res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            maxAge: 15 * 60 * 1000,
          });

          res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          });

          return res.json({
            success: true,
            message: "Email verified successfully!",
            redirect: redirect || "/home",
          });
        }

        return res.status(400).json({
          success: false,
          message: "No pending registration found. Please register again.",
        });
      }

      if (pendingRegistration.email !== email) {
        console.log(
          "[OTP Verify] Email mismatch:",
          pendingRegistration.email,
          "vs",
          email,
        );
        return res.status(400).json({
          success: false,
          message: "Email mismatch. Please register again.",
        });
      }

      console.log("[OTP Verify] Creating user account...");
      // Create the user account now that OTP is verified
      const newUser = await User.create({
        name: pendingRegistration.name,
        email: pendingRegistration.email,
        password: pendingRegistration.password,
        address: pendingRegistration.address,
        phone: pendingRegistration.phone,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      });

      console.log("[OTP Verify] User created:", newUser._id);

      // Clear pending registration from session
      req.session.pendingRegistration = null;

      // Generate tokens
      const accessToken = jwt.sign(
        { userId: newUser._id, email: newUser.email },
        process.env.ACCESS_SECRET,
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign(
        { userId: newUser._id },
        process.env.REFRESH_SECRET,
        { expiresIn: "7d" },
      );

      newUser.refreshToken = refreshToken;
      await newUser.save();

      console.log("[OTP Verify] Tokens generated, setting cookies...");
      console.log("[OTP Verify] Session ID:", req.sessionID);

      // Set cookies
      res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 15 * 60 * 1000,
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      console.log("[OTP Verify] Cookies set successfully");
      console.log("[OTP Verify] Registration complete, redirecting to /home");
      return res.json({
        success: true,
        message: "Email verified successfully! Account created.",
        redirect: "/home",
      });
    }

    // For password reset
    if (purpose === "password_reset") {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Store email in session for password reset
      req.session.passwordResetEmail = email;

      console.log("[OTP Verify] Password reset OTP verified for:", email);
      return res.json({
        success: true,
        message: "OTP verified successfully! You can now reset your password.",
        redirect: "/reset-password",
      });
    }

    res.json({
      success: true,
      message: "Email verified successfully!",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP. Please try again.",
    });
  }
};

// @desc    Resend OTP
// @route   POST /api/otp/resend
// @access  Public
const resendOTP = async (req, res) => {
  try {
    const { email, purpose = "email_verification" } = req.body;

    // Validate email
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // For registration, check if there's a pending registration
    if (purpose === "email_verification") {
      const pendingRegistration = req.session.pendingRegistration;
      if (pendingRegistration && pendingRegistration.email === email) {
        // Allow resend for pending registration
      } else {
        // Check if email already verified
        const existingUser = await User.findOne({
          email,
          isEmailVerified: true,
        });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "This email is already verified. No need to resend OTP.",
          });
        }
      }
    }

    // Check rate limiting - only 3 resends per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOTPs = await OTP.countDocuments({
      email,
      purpose,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentOTPs >= 3) {
      return res.status(429).json({
        success: false,
        message:
          "Too many OTP requests. Please wait 1 hour before trying again.",
      });
    }

    // Generate and save new OTP
    const { otp, expiresAt } = await OTP.createOTP(email, purpose, 10);

    // Send OTP via email
    const emailResult = await sendOTPEmail(email, otp, purpose);

    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "OTP resent successfully to your email",
      expiresAt,
      expiresIn: "10 minutes",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error resending OTP. Please try again.",
    });
  }
};

// @desc    Check OTP status (without verifying)
// @route   POST /api/otp/check
// @access  Public
const checkOTP = async (req, res) => {
  try {
    const { email, otp, purpose = "email_verification" } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      });
    }

    // Check OTP validity
    const result = await OTP.checkOTP(email, otp, purpose);

    res.json(result);
  } catch (error) {
    console.error("Check OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking OTP. Please try again.",
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
  checkOTP,
};
