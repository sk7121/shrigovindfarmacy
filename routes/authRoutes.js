const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  refreshToken,
  sendOTPLogin,
  verifyOTPLogin,
} = require("../controllers/authController");
const { authLimiter } = require("../middleware/rateLimiter");

// Public routes
router.post("/register", register);
router.post("/login", authLimiter, login);
router.post("/admin/login", authLimiter, login); // Admin login uses same controller
router.post("/logout", logout);
router.post("/refresh-token", refreshToken);

// OTP Login routes
router.post("/otp-login/send", authLimiter, sendOTPLogin);
router.post("/otp-login/verify", authLimiter, verifyOTPLogin);

module.exports = router;
