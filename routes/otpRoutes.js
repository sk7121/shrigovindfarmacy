const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP, checkOTP } = require('../controllers/otpController');
const { authLimiter } = require('../middleware/rateLimiter');

// All OTP routes are rate limited for security
router.post('/send', authLimiter, sendOTP);
router.post('/verify', authLimiter, verifyOTP);
router.post('/resend', authLimiter, resendOTP);
router.post('/check', authLimiter, checkOTP);

module.exports = router;
