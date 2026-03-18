const express = require('express');
const router = express.Router();
const {
    getDeliveryDetails,
    generateDeliveryOTP,
    verifyDeliveryOTP,
    completeDelivery,
    getDeliveryOTP
} = require('../controllers/deliveryController');
const { authenticate, isDeliveryAgent } = require('../middleware/auth');
const { uploadProfile } = require('../config/multer');

// All routes are protected and require delivery agent authentication
router.use(authenticate);
router.use(isDeliveryAgent);

// Get delivery details
router.get('/:id', getDeliveryDetails);

// Get OTP for delivery
router.get('/:orderId/otp', getDeliveryOTP);

// Generate delivery OTP
router.post('/:orderId/generate-otp', generateDeliveryOTP);

// Verify delivery OTP
router.post('/:orderId/verify-otp', verifyDeliveryOTP);

// Complete delivery with image upload and OTP verification
router.post('/:orderId/complete', uploadProfile.single('deliveryProof'), completeDelivery);

module.exports = router;
