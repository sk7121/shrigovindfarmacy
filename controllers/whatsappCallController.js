const Appointment = require('../models/appointment');
const Rating = require('../models/rating');
const Doctor = require('../models/doctor');

// @desc    Start WhatsApp video call
// @route   POST /api/whatsapp-call/:appointmentId/start
// @access  Private (Doctor or Patient)
const startWhatsAppCall = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name contact')
            .populate('patient', 'name phone email');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if appointment is confirmed
        if (!['Confirmed', 'Completed'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: 'Can only start call for confirmed appointments'
            });
        }

        // Start the call
        await appointment.startCall();

        // Get patient phone number for WhatsApp
        const patientPhone = appointment.patientDetails?.phone || appointment.patient?.phone;
        const doctorPhone = appointment.doctor?.contact?.phone || appointment.doctor?.contact?.whatsapp;

        res.json({
            success: true,
            message: 'WhatsApp call initiated',
            appointment: {
                _id: appointment._id,
                callStartedAt: appointment.callStartedAt,
                patient: {
                    name: appointment.patient?.name,
                    phone: patientPhone
                },
                doctor: {
                    name: appointment.doctor?.name,
                    phone: doctorPhone
                },
                whatsappLink: `https://wa.me/${patientPhone.replace(/[^0-9]/g, '')}?text=Hello%20Dr.%20${encodeURIComponent(appointment.doctor?.name || 'Doctor')}%2C%20I'm%20ready%20for%20our%20video%20consultation.`
            }
        });
    } catch (error) {
        console.error('Start WhatsApp call error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting WhatsApp call'
        });
    }
};

// @desc    Mark appointment as attended
// @route   POST /api/whatsapp-call/:appointmentId/attend
// @access  Private (Doctor only)
const markAppointmentAttended = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { notes, prescription } = req.body;

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name')
            .populate('patient', 'name email');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Mark as attended
        await appointment.markAttended();

        // Add notes and prescription if provided
        if (notes) {
            appointment.notes = notes;
        }
        if (prescription) {
            appointment.prescription = prescription;
        }
        await appointment.save();

        res.json({
            success: true,
            message: 'Appointment marked as attended',
            appointment: {
                _id: appointment._id,
                status: appointment.status,
                isAttended: appointment.isAttended,
                attendedAt: appointment.attendedAt,
                callDuration: appointment.callDuration
            }
        });
    } catch (error) {
        console.error('Mark attended error:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking appointment as attended'
        });
    }
};

// @desc    Submit rating for doctor
// @route   POST /api/whatsapp-call/:appointmentId/rate
// @access  Private (Patient only)
const submitRating = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { rating, review } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name')
            .populate('patient', 'name');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if patient is the one submitting
        if (appointment.patient._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Only the patient can submit a rating'
            });
        }

        // Check if already rated
        const existingRating = await Rating.findOne({ appointment: appointmentId });
        if (existingRating) {
            return res.status(400).json({
                success: false,
                message: 'You have already rated this consultation'
            });
        }

        // Create rating
        const newRating = await Rating.create({
            doctor: appointment.doctor._id,
            patient: req.user._id,
            appointment: appointmentId,
            rating,
            review: review || '',
            consultationType: appointment.appointmentType,
            isVerifiedConsultation: true
        });

        // Mark appointment as rated
        await appointment.markRated();

        // Update doctor stats
        const doctor = await Doctor.findById(appointment.doctor._id);
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
            rating: newRating
        });
    } catch (error) {
        console.error('Submit rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting rating'
        });
    }
};

// @desc    Get appointment call status
// @route   GET /api/whatsapp-call/:appointmentId/status
// @access  Private
const getCallStatus = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name contact')
            .populate('patient', 'name phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if rating exists
        const existingRating = await Rating.findOne({ appointment: appointmentId });

        res.json({
            success: true,
            status: {
                callStartedAt: appointment.callStartedAt,
                callEndedAt: appointment.callEndedAt,
                callDuration: appointment.callDuration,
                isAttended: appointment.isAttended,
                attendedAt: appointment.attendedAt,
                isRated: appointment.isRated,
                hasRating: !!existingRating,
                rating: existingRating ? {
                    rating: existingRating.rating,
                    review: existingRating.review
                } : null
            }
        });
    } catch (error) {
        console.error('Get call status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching call status'
        });
    }
};

module.exports = {
    startWhatsAppCall,
    markAppointmentAttended,
    submitRating,
    getCallStatus
};
