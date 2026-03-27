const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authenticateVerifiedAPI, isAdmin } = require('../middleware/auth');

// User routes - Get and manage own appointments
router.get('/my', authenticate, appointmentController.getMyAppointments);
router.get('/:id', authenticate, appointmentController.getAppointment);
router.put('/:id/cancel', authenticate, appointmentController.cancelAppointment);
router.put('/:id/reschedule', authenticate, appointmentController.rescheduleAppointment);
router.post('/:id/auto-reschedule', authenticate, appointmentController.autoRescheduleMissedAppointment);

// Doctor/Admin routes
router.get('/doctor/:doctorId', authenticate, appointmentController.getDoctorAppointments);
router.put('/:id/confirm', authenticate, appointmentController.confirmAppointment);
router.put('/:id/complete', authenticate, appointmentController.completeAppointment);

// Stats (Doctor/Admin only)
router.get('/stats/overview', authenticate, appointmentController.getAppointmentStats);

module.exports = router;
