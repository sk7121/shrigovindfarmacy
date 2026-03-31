const express = require('express');
const router = express.Router();
const videoCallController = require('../controllers/videoCallController');
const { authenticate, authenticateVerifiedAPI, isAdmin } = require('../middleware/auth');

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

// Doctor routes
router.post('/start', authenticateDoctor, videoCallController.startVideoCall);
router.post('/join', authenticate, videoCallController.joinVideoCall);
router.post('/end', authenticateDoctor, videoCallController.endVideoCall);
router.get('/doctor/active', authenticateDoctor, videoCallController.getDoctorActiveCalls);

// Patient routes
router.post('/rating', authenticate, videoCallController.submitRating);

// Shared routes
router.get('/:roomId', authenticate, videoCallController.getVideoCallDetails);

module.exports = router;
