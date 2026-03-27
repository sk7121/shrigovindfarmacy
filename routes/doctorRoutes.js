const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticate, authenticateVerifiedAPI, isAdmin } = require('../middleware/auth');
const { uploadDoctor } = require('../config/multer');

// Public routes
router.get('/', doctorController.getAllDoctors);
router.get('/slug/:slug', doctorController.getDoctorBySlug);
router.get('/id/:id', doctorController.getDoctorById);
router.get('/:id/availability', doctorController.getDoctorAvailability);

// Protected routes - User
router.post('/:id/appointment', authenticate, doctorController.bookAppointment);
router.post('/:id/review', authenticate, doctorController.submitReview);

// Admin routes
router.post('/admin/new', authenticate, isAdmin, uploadDoctor.single('image'), doctorController.createDoctor);
router.put('/admin/:id', authenticate, isAdmin, uploadDoctor.single('image'), doctorController.updateDoctor);
router.delete('/admin/:id', authenticate, isAdmin, doctorController.deleteDoctor);

// Admin appointments
router.get('/admin/appointments', authenticate, isAdmin, doctorController.getAllAppointments);
router.put('/admin/appointments/:id/status', authenticate, isAdmin, doctorController.updateAppointmentStatus);

module.exports = router;
