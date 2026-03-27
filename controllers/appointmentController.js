const Appointment = require('../models/appointment');
const Doctor = require('../models/doctor');
const { sendAppointmentConfirmation, sendAppointmentReminder, sendAppointmentStatusUpdate } = require('../services/emailService');
const { sendAppointmentConfirmationSMS, sendAppointmentStatusSMS } = require('../services/smsService');

// @desc    Get user's appointments
// @route   GET /api/appointments/my
// @access  Private
const getMyAppointments = async (req, res) => {
    try {
        const { status, upcoming } = req.query;
        
        let query = { patient: req.user._id };
        
        if (status) {
            query.status = status;
        }
        
        if (upcoming === 'true') {
            query.appointmentDate = { $gte: new Date() };
            query.status = { $in: ['Pending', 'Confirmed'] };
        }
        
        const appointments = await Appointment.find(query)
            .sort({ appointmentDate: -1, appointmentTime: -1 })
            .populate('doctor', 'name title specializations image contact');
        
        res.json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Get my appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments'
        });
    }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
const getAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('doctor', 'name title specializations image contact stats experience qualifications')
            .populate('patient', 'name email phone');
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        // Check if user owns this appointment or is admin
        if (
            appointment.patient._id.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this appointment'
            });
        }
        
        res.json({
            success: true,
            appointment
        });
    } catch (error) {
        console.error('Get appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointment'
        });
    }
};

// @desc    Cancel appointment
// @route   PUT /api/appointments/:id/cancel
// @access  Private
const cancelAppointment = async (req, res) => {
    try {
        const { reason } = req.body;
        
        const appointment = await Appointment.findOne({
            _id: req.params.id,
            patient: req.user._id
        });
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        // Check if appointment can be cancelled
        if (['Completed', 'Cancelled'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel this appointment'
            });
        }
        
        await appointment.cancel(req.user._id, reason || 'Cancelled by patient');
        
        // Populate doctor info for notification
        await appointment.populate('doctor', 'name contact');
        
        res.json({
            success: true,
            message: 'Appointment cancelled successfully',
            appointment
        });
    } catch (error) {
        console.error('Cancel appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling appointment'
        });
    }
};

// @desc    Reschedule appointment
// @route   PUT /api/appointments/:id/reschedule
// @access  Private
const rescheduleAppointment = async (req, res) => {
    try {
        const { appointmentDate, appointmentTime } = req.body;
        
        if (!appointmentDate || !appointmentTime) {
            return res.status(400).json({
                success: false,
                message: 'New date and time are required'
            });
        }
        
        const appointment = await Appointment.findOne({
            _id: req.params.id,
            patient: req.user._id
        });
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        // Check if appointment can be rescheduled
        if (['Completed', 'Cancelled'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reschedule this appointment'
            });
        }
        
        // Check if new slot is available
        const existingAppointment = await Appointment.findOne({
            doctor: appointment.doctor,
            _id: { $ne: appointment._id },
            appointmentDate: new Date(appointmentDate),
            appointmentTime,
            status: { $in: ['Pending', 'Confirmed'] }
        });
        
        if (existingAppointment) {
            return res.status(400).json({
                success: false,
                message: 'This time slot is no longer available'
            });
        }
        
        // Update appointment
        appointment.appointmentDate = new Date(appointmentDate);
        appointment.appointmentTime = appointmentTime;
        appointment.status = 'Pending'; // Reset to pending for confirmation
        await appointment.save();
        
        // Populate doctor info for notification
        await appointment.populate('doctor', 'name contact');
        await appointment.populate('patient', 'name email phone');
        
        // Send rescheduled notification
        try {
            await sendAppointmentStatusUpdate(appointment, appointment.patient, 'Rescheduled');
        } catch (emailError) {
            console.error('Failed to send reschedule email:', emailError);
        }
        
        try {
            await sendAppointmentStatusSMS(appointment, appointment.patientDetails?.phone, 'Rescheduled');
        } catch (smsError) {
            console.error('Failed to send reschedule SMS:', smsError);
        }
        
        res.json({
            success: true,
            message: 'Appointment rescheduled successfully',
            appointment
        });
    } catch (error) {
        console.error('Reschedule appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error rescheduling appointment'
        });
    }
};

// @desc    Get appointments for a doctor (Doctor/Admin only)
// @route   GET /api/appointments/doctor/:doctorId
// @access  Private (Doctor/Admin)
const getDoctorAppointments = async (req, res) => {
    try {
        const { status, date } = req.query;
        
        let query = { doctor: req.params.doctorId };
        
        if (status) {
            query.status = status;
        }
        
        if (date) {
            const selectedDate = new Date(date);
            query.appointmentDate = {
                $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
                $lte: new Date(selectedDate.setHours(23, 59, 59, 999))
            };
        }
        
        const appointments = await Appointment.find(query)
            .sort({ appointmentDate: -1, appointmentTime: -1 })
            .populate('patient', 'name email phone');
        
        res.json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Get doctor appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments'
        });
    }
};

// @desc    Confirm appointment (Doctor/Admin only)
// @route   PUT /api/appointments/:id/confirm
// @access  Private (Doctor/Admin)
const confirmAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        if (appointment.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending appointments can be confirmed'
            });
        }
        
        await appointment.confirm();
        
        // Populate for notifications
        await appointment.populate('doctor', 'name contact');
        await appointment.populate('patient', 'name email phone');
        
        // Send confirmation notification
        try {
            await sendAppointmentConfirmation(appointment, appointment.patient);
        } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
        }
        
        try {
            await sendAppointmentConfirmationSMS(appointment, appointment.patientDetails?.phone);
        } catch (smsError) {
            console.error('Failed to send confirmation SMS:', smsError);
        }
        
        res.json({
            success: true,
            message: 'Appointment confirmed successfully',
            appointment
        });
    } catch (error) {
        console.error('Confirm appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error confirming appointment'
        });
    }
};

// @desc    Complete appointment with notes (Doctor only)
// @route   PUT /api/appointments/:id/complete
// @access  Private (Doctor)
const completeAppointment = async (req, res) => {
    try {
        const { notes, prescription, followUpRequired, followUpDate } = req.body;
        
        const appointment = await Appointment.findById(req.params.id);
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        if (!['Confirmed', 'Pending'].includes(appointment.status)) {
            return res.status(400).json({
                success: false,
                message: 'Only confirmed appointments can be completed'
            });
        }
        
        await appointment.complete(notes || '', prescription || '');
        
        if (followUpRequired) {
            appointment.followUpRequired = true;
            appointment.followUpDate = followUpDate ? new Date(followUpDate) : null;
            await appointment.save();
        }
        
        // Populate for notifications
        await appointment.populate('doctor', 'name contact');
        await appointment.populate('patient', 'name email phone');
        
        // Send completion notification
        try {
            await sendAppointmentStatusUpdate(appointment, appointment.patient, 'Completed');
        } catch (emailError) {
            console.error('Failed to send completion email:', emailError);
        }
        
        res.json({
            success: true,
            message: 'Appointment completed successfully',
            appointment
        });
    } catch (error) {
        console.error('Complete appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing appointment'
        });
    }
};

// @desc    Get appointment statistics
// @route   GET /api/appointments/stats
// @access  Private (Doctor/Admin)
const getAppointmentStats = async (req, res) => {
    try {
        const { doctorId } = req.query;
        
        let query = {};
        if (doctorId) {
            query.doctor = doctorId;
        }
        
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        // Total appointments
        const total = await Appointment.countDocuments(query);
        
        // Pending appointments
        const pending = await Appointment.countDocuments({ ...query, status: 'Pending' });
        
        // Confirmed appointments
        const confirmed = await Appointment.countDocuments({ ...query, status: 'Confirmed' });
        
        // Completed today
        const completedToday = await Appointment.countDocuments({
            ...query,
            status: 'Completed',
            appointmentDate: { $gte: today }
        });
        
        // Completed this week
        const completedWeek = await Appointment.countDocuments({
            ...query,
            status: 'Completed',
            appointmentDate: { $gte: weekAgo }
        });
        
        // Completed this month
        const completedMonth = await Appointment.countDocuments({
            ...query,
            status: 'Completed',
            appointmentDate: { $gte: monthAgo }
        });
        
        // Cancelled this month
        const cancelledMonth = await Appointment.countDocuments({
            ...query,
            status: 'Cancelled',
            cancelledAt: { $gte: monthAgo }
        });
        
        // No-show this month
        const noShowMonth = await Appointment.countDocuments({
            ...query,
            status: 'No-Show',
            appointmentDate: { $gte: monthAgo }
        });
        
        res.json({
            success: true,
            stats: {
                total,
                pending,
                confirmed,
                completedToday,
                completedWeek,
                completedMonth,
                cancelledMonth,
                noShowMonth
            }
        });
    } catch (error) {
        console.error('Get appointment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching statistics'
        });
    }
};

// @desc    Auto-reschedule missed appointment to next available slot
// @route   POST /api/appointments/:id/auto-reschedule
// @access  Private
const autoRescheduleMissedAppointment = async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('doctor', 'name contact availability');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        // Check if user owns this appointment or is admin
        if (
            appointment.patient._id.toString() !== req.user._id.toString() &&
            req.user.role !== 'admin'
        ) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to reschedule this appointment'
            });
        }

        // Only allow rescheduling for No-Show or missed appointments
        if (appointment.status !== 'No-Show') {
            return res.status(400).json({
                success: false,
                message: 'Only No-Show appointments can be auto-rescheduled'
            });
        }

        // Find next available slot for the same doctor
        const appointmentDate = new Date(appointment.appointmentDate);
        const currentTimeSlots = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM'];
        
        let foundSlot = null;
        let searchDate = new Date(appointmentDate);
        const maxSearchDays = 30; // Search up to 30 days ahead
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Start searching from the day after the missed appointment
        searchDate.setDate(searchDate.getDate() + 1);

        for (let dayOffset = 0; dayOffset < maxSearchDays; dayOffset++) {
            const currentDate = new Date(searchDate);
            currentDate.setDate(searchDate.getDate() + dayOffset);
            currentDate.setHours(0, 0, 0, 0);
            
            // Skip if date is in the past
            if (currentDate < today) continue;
            
            for (const timeSlot of currentTimeSlots) {
                const existingAppointment = await Appointment.findOne({
                    doctor: appointment.doctor._id,
                    appointmentDate: currentDate,
                    appointmentTime: timeSlot,
                    status: { $in: ['Pending', 'Confirmed'] }
                });

                if (!existingAppointment) {
                    foundSlot = {
                        date: currentDate,
                        time: timeSlot
                    };
                    break;
                }
            }
            
            if (foundSlot) break;
        }

        if (!foundSlot) {
            return res.status(400).json({
                success: false,
                message: 'No available slots found in the next 30 days. Please contact support.'
            });
        }

        // Update appointment with new slot
        const oldDate = appointment.appointmentDate;
        const oldTime = appointment.appointmentTime;
        
        appointment.appointmentDate = foundSlot.date;
        appointment.appointmentTime = foundSlot.time;
        appointment.status = 'Pending';
        await appointment.save();

        // Populate for notifications
        await appointment.populate('doctor', 'name contact');
        await appointment.populate('patient', 'name email phone');

        // Send notification
        try {
            await sendAppointmentStatusUpdate(appointment, appointment.patient, `Auto-Rescheduled from ${oldDate.toLocaleDateString()} ${oldTime} to ${foundSlot.date.toLocaleDateString()} ${foundSlot.time}`);
        } catch (emailError) {
            console.error('Failed to send auto-reschedule email:', emailError);
        }

        try {
            await sendAppointmentStatusSMS(appointment, appointment.patientDetails?.phone, `Auto-Rescheduled to ${foundSlot.date.toLocaleDateString()} ${foundSlot.time}`);
        } catch (smsError) {
            console.error('Failed to send auto-reschedule SMS:', smsError);
        }

        res.json({
            success: true,
            message: `Appointment auto-rescheduled to ${foundSlot.date.toLocaleDateString()} at ${foundSlot.time}`,
            appointment
        });
    } catch (error) {
        console.error('Auto-reschedule appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error auto-rescheduling appointment'
        });
    }
};

module.exports = {
    getMyAppointments,
    getAppointment,
    cancelAppointment,
    rescheduleAppointment,
    getDoctorAppointments,
    confirmAppointment,
    completeAppointment,
    getAppointmentStats,
    autoRescheduleMissedAppointment
};
