const Appointment = require('../models/appointment');
const Doctor = require('../models/doctor');
const { sendAppointmentStatusUpdate } = require('../services/emailService');
const { sendAppointmentStatusSMS } = require('../services/smsService');

/**
 * Check and mark missed appointments as No-Show
 * Runs every 15 minutes to catch appointments that have passed
 */
async function markMissedAppointmentsAsNoShow() {
    try {
        const now = new Date();
        
        // Find appointments that are:
        // - Pending or Confirmed
        // - Scheduled time has passed (with 15 minute grace period)
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        
        const missedAppointments = await Appointment.find({
            status: { $in: ['Pending', 'Confirmed'] },
            appointmentDate: { $lte: fifteenMinutesAgo }
        }).populate('doctor', 'name contact');

        if (missedAppointments.length === 0) {
            console.log(`[${new Date().toISOString()}] No missed appointments found`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Found ${missedAppointments.length} missed appointments to process`);

        for (const appointment of missedAppointments) {
            try {
                const oldStatus = appointment.status;
                appointment.status = 'No-Show';
                await appointment.save();

                console.log(`✅ Marked appointment ${appointment._id} as No-Show`);

                // Populate for notifications
                await appointment.populate('doctor', 'name contact');
                await appointment.populate('patient', 'name email phone');

                // Send notification to patient
                try {
                    await sendAppointmentStatusUpdate(
                        appointment,
                        appointment.patient,
                        'No-Show',
                        `Your appointment scheduled for ${appointment.appointmentDate.toLocaleDateString()} at ${appointment.appointmentTime} was marked as No-Show. You can auto-reschedule to the next available slot.`
                    );
                    console.log(`📧 Sent No-Show email to ${appointment.patient.email}`);
                } catch (emailError) {
                    console.error('Failed to send No-Show email:', emailError);
                }

                try {
                    await sendAppointmentStatusSMS(
                        appointment,
                        appointment.patientDetails?.phone,
                        'No-Show - You can auto-reschedule to next available slot'
                    );
                    console.log(`📱 Sent No-Show SMS to ${appointment.patientDetails?.phone}`);
                } catch (smsError) {
                    console.error('Failed to send No-Show SMS:', smsError);
                }

            } catch (err) {
                console.error(`Error processing appointment ${appointment._id}:`, err);
            }
        }

        console.log(`[${new Date().toISOString()}] Completed processing missed appointments`);
    } catch (error) {
        console.error('[SCHEDULER] Error in markMissedAppointmentsAsNoShow:', error);
    }
}

/**
 * Send reminder for upcoming appointments (1 hour before)
 */
async function sendAppointmentReminders() {
    try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

        // Find appointments in the next 1-2 hours that are confirmed
        const upcomingAppointments = await Appointment.find({
            status: 'Confirmed',
            appointmentDate: {
                $gte: oneHourFromNow,
                $lte: twoHoursFromNow
            }
        }).populate('doctor', 'name').populate('patient', 'name email phone');

        for (const appointment of upcomingAppointments) {
            try {
                // Check if reminder already sent (you could add a reminderSent flag to the model)
                console.log(`🔔 Reminder: Appointment ${appointment._id} is coming up soon`);
                
                // Send reminder email/SMS here if needed
                // await sendAppointmentReminder(appointment, appointment.patient);
            } catch (err) {
                console.error(`Error sending reminder for appointment ${appointment._id}:`, err);
            }
        }
    } catch (error) {
        console.error('[SCHEDULER] Error in sendAppointmentReminders:', error);
    }
}

/**
 * Initialize the scheduler
 * Call this function from app.js to start the scheduled tasks
 */
function initializeAppointmentScheduler() {
    console.log('🕐 Initializing appointment scheduler...');
    
    // Run the missed appointment check every 15 minutes
    setInterval(() => {
        markMissedAppointmentsAsNoShow();
    }, 15 * 60 * 1000); // 15 minutes

    // Run immediately on startup
    setTimeout(() => {
        markMissedAppointmentsAsNoShow();
    }, 5000);

    // Send reminders every 30 minutes
    setInterval(() => {
        sendAppointmentReminders();
    }, 30 * 60 * 1000); // 30 minutes

    console.log('✅ Appointment scheduler initialized');
}

module.exports = {
    initializeAppointmentScheduler,
    markMissedAppointmentsAsNoShow,
    sendAppointmentReminders
};
