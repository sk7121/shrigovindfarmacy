const Doctor = require('../models/doctor');
const Appointment = require('../models/appointment');
const { sendAppointmentConfirmation, sendAppointmentReminder, sendAppointmentStatusUpdate } = require('../services/emailService');
const { sendAppointmentConfirmationSMS, sendAppointmentStatusSMS } = require('../services/smsService');

// @desc    Get all doctors (public)
// @route   GET /api/doctors
// @access  Public
const getAllDoctors = async (req, res) => {
    try {
        const { specialization, language, featured } = req.query;
        
        let query = { isActive: true };
        
        if (specialization) {
            query.specializations = { $in: [specialization] };
        }
        
        if (language) {
            query.languages = { $in: [language] };
        }
        
        if (featured === 'true') {
            query.featured = true;
        }
        
        const doctors = await Doctor.find(query)
            .sort({ featured: -1, 'stats.averageRating': -1, createdAt: -1 });
        
        // Update availability status for all doctors
        doctors.forEach(doctor => {
            if (typeof doctor.updateAvailabilityStatus === 'function') {
                doctor.updateAvailabilityStatus();
            }
        });

        await Promise.all(doctors.map(async d => {
            try {
                await d.save({ validateModifiedOnly: false });
            } catch (saveErr) {
                console.error('Error saving doctor availability:', saveErr.message);
            }
        }));
        
        res.json({
            success: true,
            count: doctors.length,
            doctors
        });
    } catch (error) {
        console.error('Get all doctors error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctors'
        });
    }
};

// @desc    Get doctor by slug
// @route   GET /api/doctors/:slug
// @access  Public
const getDoctorBySlug = async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ 
            slug: req.params.slug,
            isActive: true 
        });
        
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        // Update availability status
        if (typeof doctor.updateAvailabilityStatus === 'function') {
            doctor.updateAvailabilityStatus();
            await doctor.save({ validateModifiedOnly: false });
        }

        res.json({
            success: true,
            doctor
        });
    } catch (error) {
        console.error('Get doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctor details'
        });
    }
};

// @desc    Get doctor by ID
// @route   GET /api/doctors/id/:id
// @access  Public
const getDoctorById = async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ 
            _id: req.params.id,
            isActive: true 
        });
        
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        // Update availability status
        if (typeof doctor.updateAvailabilityStatus === 'function') {
            doctor.updateAvailabilityStatus();
            await doctor.save({ validateModifiedOnly: false });
        }

        res.json({
            success: true,
            doctor
        });
    } catch (error) {
        console.error('Get doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctor details'
        });
    }
};

// @desc    Get available time slots for a doctor
// @route   GET /api/doctors/:id/availability
// @access  Public
const getDoctorAvailability = async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found or inactive'
            });
        }
        
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required'
            });
        }
        
        const requestedDate = new Date(date);
        const dayName = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Find availability for the requested day
        const dayAvailability = doctor.availability.find(a => a.day === dayName);
        
        if (!dayAvailability || !dayAvailability.isAvailable) {
            return res.json({
                success: true,
                available: false,
                message: 'Doctor is not available on this day',
                slots: []
            });
        }
        
        // Get existing appointments for the date
        const existingAppointments = await Appointment.find({
            doctor: doctor._id,
            appointmentDate: {
                $gte: new Date(requestedDate.setHours(0, 0, 0, 0)),
                $lte: new Date(requestedDate.setHours(23, 59, 59, 999))
            },
            status: { $in: ['Pending', 'Confirmed'] }
        });
        
        // Generate available slots (simplified logic)
        const slots = generateAvailableSlots(dayAvailability, existingAppointments);
        
        res.json({
            success: true,
            available: slots.length > 0,
            slots
        });
    } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching availability'
        });
    }
};

// Helper function to generate available time slots
function generateAvailableSlots(availability, existingAppointments) {
    const slots = [];
    const slotDuration = 30; // 30 minutes per slot
    
    // Parse start and end times
    const startTime = parseTime(availability.startTime || '9:00 AM');
    const endTime = parseTime(availability.endTime || '1:00 PM');
    
    // Get booked times
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    
    let currentTime = startTime;
    while (currentTime < endTime) {
        const timeString = formatTime(currentTime);
        if (!bookedTimes.includes(timeString)) {
            slots.push({
                time: timeString,
                available: true
            });
        }
        currentTime += slotDuration * 60 * 1000; // Add slot duration in milliseconds
    }
    
    return slots;
}

function parseTime(timeStr) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    
    if (hours === '12') {
        hours = '00';
    }
    
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }
    
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return date.getTime();
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const modifier = hours >= 12 ? 'PM' : 'AM';
    
    if (hours > 12) {
        hours -= 12;
    } else if (hours === 0) {
        hours = 12;
    }
    
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${modifier}`;
}

// Helper function to parse time string (e.g., "9:00 AM") to hours and minutes
function parseTime(timeStr) {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const modifier = match[3].toUpperCase();
    
    if (modifier === 'PM' && hours !== 12) {
        hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
        hours = 0;
    }
    
    return { hours, minutes };
}

// @desc    Book appointment with doctor
// @route   POST /api/doctors/:id/appointment
// @access  Private
const bookAppointment = async (req, res) => {
    try {
        const {
            appointmentType,
            appointmentDate,
            appointmentTime,
            reason,
            symptoms,
            medicalHistory,
            currentMedications,
            patientDetails
        } = req.body;

        // Validate required fields
        if (!appointmentType || !appointmentDate || !appointmentTime || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate appointment date and time is in the future
        const selectedDate = new Date(appointmentDate);
        selectedDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Appointment date must be in the future'
            });
        }
        
        // If booking for today, validate time is in the future
        const isToday = selectedDate.getTime() === today.getTime();
        if (isToday) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const timeParsed = parseTime(appointmentTime);
            
            if (!timeParsed) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid time format'
                });
            }
            
            const appointmentTimeInMinutes = timeParsed.hours * 60 + timeParsed.minutes;
            
            if (appointmentTimeInMinutes <= currentTime) {
                return res.status(400).json({
                    success: false,
                    message: 'Appointment time must be in the future. Please select a later time slot.'
                });
            }
        }

        // Check if doctor exists
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found or inactive'
            });
        }

        // Check if slot is already booked
        const existingAppointment = await Appointment.findOne({
            doctor: req.params.id,
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
        
        // Use patient details from request or authenticated user
        const patient = req.user;
        const finalPatientDetails = patientDetails || {
            name: patient.name,
            email: patient.email,
            phone: patient.phone
        };
        
        // Create appointment
        const appointment = await Appointment.create({
            doctor: req.params.id,
            patient: patient._id,
            patientDetails: finalPatientDetails,
            appointmentType,
            appointmentDate: new Date(appointmentDate),
            appointmentTime,
            reason,
            symptoms: symptoms ? (Array.isArray(symptoms) ? symptoms : [symptoms]) : [],
            medicalHistory,
            currentMedications,
            consultationFee: doctor.consultationFee.firstVisit,
            paymentStatus: 'Unpaid'
        });
        
        // Update doctor stats
        doctor.stats.totalConsultations += 1;
        await doctor.save();
        
        // Populate doctor info for response
        await appointment.populate('doctor', 'name title contact');
        
        // Send confirmation email
        try {
            await sendAppointmentConfirmation(appointment, patient);
        } catch (emailError) {
            console.error('Failed to send appointment confirmation email:', emailError);
        }
        
        // Send confirmation SMS
        try {
            await sendAppointmentConfirmationSMS(appointment, finalPatientDetails.phone);
        } catch (smsError) {
            console.error('Failed to send appointment confirmation SMS:', smsError);
        }
        
        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully! We will confirm your appointment soon.',
            appointment
        });
    } catch (error) {
        console.error('Book appointment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error booking appointment'
        });
    }
};

// @desc    Submit review for doctor
// @route   POST /api/doctors/:id/review
// @access  Private
const submitReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }
        
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        // Check if patient has had consultation with doctor
        const hasAppointment = await Appointment.findOne({
            doctor: req.params.id,
            patient: req.user._id,
            status: 'Completed'
        });
        
        // Add review
        await doctor.addReview(
            req.user.name,
            parseInt(rating),
            comment || '',
            !!hasAppointment
        );
        
        res.json({
            success: true,
            message: 'Review submitted successfully',
            doctor
        });
    } catch (error) {
        console.error('Submit review error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting review'
        });
    }
};

// @desc    Admin: Create new doctor
// @route   POST /admin/api/doctors
// @access  Private/Admin
const createDoctor = async (req, res) => {
    try {
        const doctorData = req.body;
        
        // Handle image upload
        if (req.file) {
            doctorData.image = req.file.secure_url || req.file.path;
        }
        
        // Process arrays from form data
        if (typeof doctorData.specializations === 'string') {
            doctorData.specializations = [doctorData.specializations].filter(s => s.trim());
        }
        
        if (typeof doctorData.languages === 'string') {
            doctorData.languages = [doctorData.languages].filter(l => l.trim());
        }
        
        if (typeof doctorData.consultationModes === 'string') {
            doctorData.consultationModes = [doctorData.consultationModes].filter(m => m.trim());
        }
        
        // Process boolean fields
        doctorData.isActive = doctorData.isActive === 'on' || doctorData.isActive === 'true';
        doctorData.featured = doctorData.featured === 'on' || doctorData.featured === 'true';
        
        // Process consultation fees
        if (doctorData.consultationFee) {
            doctorData.consultationFee.firstVisit = Number(doctorData.consultationFee.firstVisit || 0);
            doctorData.consultationFee.followUp = Number(doctorData.consultationFee.followUp || 0);
            doctorData.consultationFee.isFreeFirstVisit = doctorData.consultationFee.isFreeFirstVisit === 'on';
            doctorData.consultationFee.currency = doctorData.consultationFee.currency || 'INR';
        }
        
        const doctor = await Doctor.create(doctorData);
        
        res.status(201).json({
            success: true,
            message: 'Doctor created successfully',
            doctor
        });
    } catch (error) {
        console.error('Create doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating doctor',
            error: error.message
        });
    }
};

// @desc    Admin: Update doctor
// @route   PUT /admin/api/doctors/:id
// @access  Private/Admin
const updateDoctor = async (req, res) => {
    try {
        const doctorData = req.body;
        
        // Handle image upload
        if (req.file) {
            doctorData.image = req.file.secure_url || req.file.path;
        } else {
            delete doctorData.image;
        }
        
        // Process arrays from form data
        if (typeof doctorData.specializations === 'string') {
            doctorData.specializations = [doctorData.specializations].filter(s => s.trim());
        }
        
        if (typeof doctorData.languages === 'string') {
            doctorData.languages = [doctorData.languages].filter(l => l.trim());
        }
        
        if (typeof doctorData.consultationModes === 'string') {
            doctorData.consultationModes = [doctorData.consultationModes].filter(m => m.trim());
        }
        
        // Process boolean fields
        doctorData.isActive = doctorData.isActive === 'on' || doctorData.isActive === 'true';
        doctorData.featured = doctorData.featured === 'on' || doctorData.featured === 'true';
        
        // Process consultation fees
        if (doctorData.consultationFee) {
            doctorData.consultationFee.firstVisit = Number(doctorData.consultationFee.firstVisit || 0);
            doctorData.consultationFee.followUp = Number(doctorData.consultationFee.followUp || 0);
            doctorData.consultationFee.isFreeFirstVisit = doctorData.consultationFee.isFreeFirstVisit === 'on';
            doctorData.consultationFee.currency = doctorData.consultationFee.currency || 'INR';
        }
        
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            doctorData,
            { new: true, runValidators: true }
        );
        
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Doctor updated successfully',
            doctor
        });
    } catch (error) {
        console.error('Update doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating doctor',
            error: error.message
        });
    }
};

// @desc    Admin: Delete doctor
// @route   DELETE /admin/api/doctors/:id
// @access  Private/Admin
const deleteDoctor = async (req, res) => {
    try {
        const doctor = await Doctor.findByIdAndDelete(req.params.id);
        
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Doctor deleted successfully'
        });
    } catch (error) {
        console.error('Delete doctor error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting doctor',
            error: error.message
        });
    }
};

// @desc    Admin: Get all appointments
// @route   GET /admin/api/appointments
// @access  Private/Admin
const getAllAppointments = async (req, res) => {
    try {
        const { status, doctorId, date } = req.query;
        
        let query = {};
        
        if (status) {
            query.status = status;
        }
        
        if (doctorId) {
            query.doctor = doctorId;
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
            .populate('doctor', 'name title specializations')
            .populate('patient', 'name email phone');
        
        res.json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Get all appointments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments'
        });
    }
};

// @desc    Admin: Update appointment status
// @route   PUT /admin/api/appointments/:id/status
// @access  Private/Admin
const updateAppointmentStatus = async (req, res) => {
    try {
        const { status, notes } = req.body;
        
        const appointment = await Appointment.findById(req.params.id);
        
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        if (status === 'Confirmed') {
            await appointment.confirm();
        } else if (status === 'Completed') {
            await appointment.complete(notes || '', '');
        } else if (status === 'Cancelled') {
            await appointment.cancel(req.user._id, req.body.reason || 'Cancelled by admin');
        }
        
        // Populate doctor info for response
        await appointment.populate('doctor', 'name title contact');
        await appointment.populate('patient', 'name email phone');
        
        // Send status update notification
        try {
            await sendAppointmentStatusUpdate(appointment, appointment.patient, status);
        } catch (emailError) {
            console.error('Failed to send status update email:', emailError);
        }
        
        try {
            await sendAppointmentStatusSMS(appointment, appointment.patientDetails?.phone, status);
        } catch (smsError) {
            console.error('Failed to send status update SMS:', smsError);
        }
        
        res.json({
            success: true,
            message: 'Appointment status updated successfully',
            appointment
        });
    } catch (error) {
        console.error('Update appointment status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating appointment status',
            error: error.message
        });
    }
};

module.exports = {
    getAllDoctors,
    getDoctorBySlug,
    getDoctorById,
    getDoctorAvailability,
    bookAppointment,
    submitReview,
    createDoctor,
    updateDoctor,
    deleteDoctor,
    getAllAppointments,
    updateAppointmentStatus
};
