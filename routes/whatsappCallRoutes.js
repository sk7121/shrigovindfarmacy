const express = require('express');
const router = express.Router();
const whatsappCallController = require('../controllers/whatsappCallController');
const { authenticate } = require('../middleware/auth');

// Middleware to authenticate doctor
const authenticateDoctor = async (req, res, next) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

        const Doctor = require('../models/doctor');
        const doctor = await Doctor.findOne({
            _id: decoded.userId,
            isActive: true
        });

        if (!doctor) {
            return res.status(401).json({
                success: false,
                message: 'Doctor not found or inactive'
            });
        }

        req.doctor = doctor;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
};

// Start WhatsApp call (Doctor or Patient)
router.post('/:appointmentId/start', authenticate, whatsappCallController.startWhatsAppCall);

// Mark appointment as attended (Doctor only)
router.post('/:appointmentId/attend', authenticateDoctor, whatsappCallController.markAppointmentAttended);

// Submit rating (Patient only)
router.post('/:appointmentId/rate', authenticate, whatsappCallController.submitRating);

// Get call status (Doctor or Patient)
router.get('/:appointmentId/status', authenticate, whatsappCallController.getCallStatus);

module.exports = router;
