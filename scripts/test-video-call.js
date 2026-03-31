/**
 * Test Script: Create Video Call Appointment
 * 
 * This script creates a test appointment with Video Call type
 * to test the video consultation flow.
 * 
 * Usage: node scripts/test-video-call.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Import models
const User = require('../models/user');
const Doctor = require('../models/doctor');
const Appointment = require('../models/appointment');

async function createTestData() {
    try {
        console.log('\n🔍 Checking for existing test data...\n');

        // Check if test patient exists
        let testPatient = await User.findOne({ email: 'testpatient@example.com' });
        
        if (!testPatient) {
            console.log('📝 Creating test patient account...');
            const hashedPassword = await bcrypt.hash('password123', 10);
            testPatient = await User.create({
                name: 'Test Patient',
                email: 'testpatient@example.com',
                password: hashedPassword,
                phone: '9876543210',
                role: 'user',
                isEmailVerified: true,
                address: {
                    street: 'Test Street',
                    city: 'Test City',
                    state: 'Test State',
                    pincode: '123456'
                }
            });
            console.log('✅ Test patient created:', testPatient.email);
        } else {
            console.log('✅ Test patient exists:', testPatient.email);
        }

        // Check if test doctor exists
        let testDoctor = await Doctor.findOne({ 
            contact: { $elemMatch: { phone: '9999999999' } } 
        });
        
        if (!testDoctor) {
            console.log('📝 Creating test doctor account...');
            
            // Create user account for doctor
            const hashedPassword = await bcrypt.hash('password123', 10);
            const doctorUser = await User.create({
                name: 'Dr. Test Doctor',
                email: 'testdoctor@example.com',
                password: hashedPassword,
                phone: '9999999999',
                role: 'doctor',
                isEmailVerified: true
            });

            testDoctor = await Doctor.create({
                user: doctorUser._id,
                name: 'Dr. Test Doctor',
                title: 'MD',
                specializations: ['General Physician'],
                languages: ['English', 'Hindi'],
                consultationModes: ['Online', 'WhatsApp', 'Video Call'],
                experience: 10,
                consultationFee: {
                    firstVisit: 500,
                    followUp: 300,
                    currency: 'INR'
                },
                contact: {
                    phone: '9999999999',
                    whatsapp: '9999999999',
                    email: 'testdoctor@example.com'
                },
                availability: [{
                    day: 'Monday',
                    isAvailable: true,
                    startTime: '9:00 AM',
                    endTime: '5:00 PM'
                }, {
                    day: 'Tuesday',
                    isAvailable: true,
                    startTime: '9:00 AM',
                    endTime: '5:00 PM'
                }, {
                    day: 'Wednesday',
                    isAvailable: true,
                    startTime: '9:00 AM',
                    endTime: '5:00 PM'
                }, {
                    day: 'Thursday',
                    isAvailable: true,
                    startTime: '9:00 AM',
                    endTime: '5:00 PM'
                }, {
                    day: 'Friday',
                    isAvailable: true,
                    startTime: '9:00 AM',
                    endTime: '5:00 PM'
                }],
                isActive: true,
                isAvailableNow: true,
                stats: {
                    totalConsultations: 0,
                    patientsTreated: 0,
                    averageRating: 5.0,
                    totalReviews: 0
                }
            });
            console.log('✅ Test doctor created:', testDoctor.email);
        } else {
            console.log('✅ Test doctor exists:', testDoctor.name);
        }

        // Create test video call appointment
        console.log('\n📝 Creating test video call appointment...');
        
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const appointment = await Appointment.create({
            doctor: testDoctor._id,
            patient: testPatient._id,
            patientDetails: {
                name: testPatient.name,
                email: testPatient.email,
                phone: testPatient.phone,
                age: 30,
                gender: 'Male'
            },
            appointmentType: 'Video Call',
            appointmentDate: tomorrow,
            appointmentTime: '10:00 AM',
            reason: 'Test video consultation for fever and headache',
            symptoms: ['Fever', 'Headache'],
            status: 'Confirmed',
            consultationFee: 500,
            paymentStatus: 'Unpaid'
        });

        console.log('✅ Video call appointment created!');
        console.log('\n📋 Appointment Details:');
        console.log('   ID:', appointment._id);
        console.log('   Date:', tomorrow.toLocaleDateString('en-IN'));
        console.log('   Time:', appointment.appointmentTime);
        console.log('   Type:', appointment.appointmentType);
        console.log('   Status:', appointment.status);
        console.log('   Patient:', testPatient.name);
        console.log('   Doctor:', testDoctor.name);

        console.log('\n✅ Test data setup complete!\n');
        console.log('📝 Test Credentials:');
        console.log('   Doctor Email: testdoctor@example.com');
        console.log('   Doctor Password: password123');
        console.log('   Patient Email: testpatient@example.com');
        console.log('   Patient Password: password123\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error creating test data:', error);
        process.exit(1);
    }
}

createTestData();
