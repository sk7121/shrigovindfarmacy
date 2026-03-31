const VideoCall = require('../models/videoCall');
const Appointment = require('../models/appointment');
const Doctor = require('../models/doctor');
const User = require('../models/user');
const crypto = require('crypto');

// Generate unique room ID
function generateRoomId() {
    return 'room_' + crypto.randomBytes(8).toString('hex');
}

// @desc    Start video call session
// @route   POST /api/video-call/start
// @access  Private (Doctor)
const startVideoCall = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'Appointment ID is required'
            });
        }

        // Get appointment
        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name')
            .populate('patient', 'name email phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if there's already an active call
        const existingCall = await VideoCall.findOne({
            appointment: appointmentId,
            status: { $in: ['waiting', 'active'] }
        });

        if (existingCall) {
            return res.json({
                success: true,
                message: 'Video call session already exists',
                call: existingCall
            });
        }

        // Create new video call session
        const roomId = generateRoomId();
        const videoCall = await VideoCall.create({
            appointment: appointmentId,
            doctor: appointment.doctor._id,
            patient: appointment.patient._id,
            roomId: roomId,
            status: 'waiting'
        });

        // Update appointment status to Confirmed if it was Pending
        if (appointment.status === 'Pending') {
            await appointment.confirm();
        }

        res.json({
            success: true,
            message: 'Video call session created',
            call: videoCall,
            patient: {
                name: appointment.patient.name,
                phone: appointment.patient.phone,
                email: appointment.patient.email
            }
        });
    } catch (error) {
        console.error('Start video call error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting video call'
        });
    }
};

// @desc    Join video call
// @route   POST /api/video-call/join
// @access  Private
const joinVideoCall = async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: 'Room ID is required'
            });
        }

        const videoCall = await VideoCall.findOne({ roomId })
            .populate('appointment', 'status appointmentDate appointmentTime')
            .populate('doctor', 'name')
            .populate('patient', 'name');

        if (!videoCall) {
            return res.status(404).json({
                success: false,
                message: 'Video call room not found'
            });
        }

        // Check if user is authorized to join
        const isDoctor = req.doctor && videoCall.doctor._id.toString() === req.doctor._id.toString();
        const isPatient = req.user && videoCall.patient._id.toString() === req.user._id.toString();

        if (!isDoctor && !isPatient && req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to join this call'
            });
        }

        // Update call status to active if waiting
        if (videoCall.status === 'waiting') {
            await videoCall.start();
        }

        res.json({
            success: true,
            message: 'Joined video call',
            call: videoCall,
            role: isDoctor ? 'doctor' : 'patient'
        });
    } catch (error) {
        console.error('Join video call error:', error);
        res.status(500).json({
            success: false,
            message: 'Error joining video call'
        });
    }
};

// @desc    End video call
// @route   POST /api/video-call/end
// @access  Private (Doctor)
const endVideoCall = async (req, res) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: 'Room ID is required'
            });
        }

        const videoCall = await VideoCall.findOne({ roomId });

        if (!videoCall) {
            return res.status(404).json({
                success: false,
                message: 'Video call room not found'
            });
        }

        // End the call
        await videoCall.end();

        // Update appointment status to Completed
        const appointment = await Appointment.findById(videoCall.appointment);
        if (appointment && appointment.status !== 'Completed') {
            await appointment.complete('', '');
        }

        res.json({
            success: true,
            message: 'Video call ended',
            call: videoCall
        });
    } catch (error) {
        console.error('End video call error:', error);
        res.status(500).json({
            success: false,
            message: 'Error ending video call'
        });
    }
};

// @desc    Submit rating for video call
// @route   POST /api/video-call/rating
// @access  Private (Patient)
const submitRating = async (req, res) => {
    try {
        const { roomId, rating, review } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: 'Room ID is required'
            });
        }

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        const videoCall = await VideoCall.findOne({ roomId })
            .populate('patient');

        if (!videoCall) {
            return res.status(404).json({
                success: false,
                message: 'Video call room not found'
            });
        }

        // Check if user is the patient
        if (videoCall.patient._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the patient can submit a rating'
            });
        }

        // Add rating
        await videoCall.addRating(rating, review || '');

        // Update doctor stats
        const doctor = await Doctor.findById(videoCall.doctor);
        if (doctor) {
            await doctor.addReview(
                req.user.name,
                rating,
                review || '',
                true
            );
        }

        res.json({
            success: true,
            message: 'Rating submitted successfully',
            call: videoCall
        });
    } catch (error) {
        console.error('Submit rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting rating'
        });
    }
};

// @desc    Get video call details
// @route   GET /api/video-call/:roomId
// @access  Private
const getVideoCallDetails = async (req, res) => {
    try {
        const { roomId } = req.params;

        const videoCall = await VideoCall.findOne({ roomId })
            .populate('appointment', 'status appointmentDate appointmentTime reason')
            .populate('doctor', 'name title specializations')
            .populate('patient', 'name email phone');

        if (!videoCall) {
            return res.status(404).json({
                success: false,
                message: 'Video call room not found'
            });
        }

        res.json({
            success: true,
            call: videoCall
        });
    } catch (error) {
        console.error('Get video call details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching video call details'
        });
    }
};

// @desc    Get active video calls for doctor
// @route   GET /api/video-call/doctor/active
// @access  Private (Doctor)
const getDoctorActiveCalls = async (req, res) => {
    try {
        const calls = await VideoCall.find({
            doctor: req.doctor._id,
            status: { $in: ['waiting', 'active'] }
        })
        .populate('appointment', 'status appointmentDate appointmentTime')
        .populate('patient', 'name phone')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: calls.length,
            calls
        });
    } catch (error) {
        console.error('Get doctor active calls error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching active calls'
        });
    }
};

module.exports = {
    startVideoCall,
    joinVideoCall,
    endVideoCall,
    submitRating,
    getVideoCallDetails,
    getDoctorActiveCalls
};
