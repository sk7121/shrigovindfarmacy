/**
 * Migration Script: Remove "Video Call" from consultationModes
 * 
 * This script removes "Video Call" from all doctors' consultationModes arrays
 * to fix Mongoose validation errors after removing it from the enum.
 * 
 * Usage: node scripts/remove-video-call-from-doctors.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shrigovindfarmacy';

async function migrate() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get Doctor model
        const Doctor = require('../models/doctor');

        // Method 1: Direct MongoDB update (faster)
        console.log('\n🔄 Running direct MongoDB update...');
        const directResult = await mongoose.connection.collection('doctors').updateMany(
            { consultationModes: 'Video Call' },
            { $pull: { consultationModes: 'Video Call' } }
        );
        
        console.log(`\n✅ Direct update completed:`);
        console.log(`   - Matched: ${directResult.matchedCount} document(s)`);
        console.log(`   - Modified: ${directResult.modifiedCount} document(s)`);

        // Method 2: Also update via Mongoose (triggers hooks)
        console.log('\n🔄 Running Mongoose update (to trigger hooks)...');
        const doctorsWithVideoCall = await Doctor.find({
            consultationModes: 'Video Call'
        });

        if (doctorsWithVideoCall.length === 0) {
            console.log('✅ No doctors found with "Video Call" - all clean!');
        } else {
            console.log(`📊 Found ${doctorsWithVideoCall.length} doctor(s) needing update via Mongoose`);
            
            for (const doctor of doctorsWithVideoCall) {
                console.log(`   🔄 Updating: ${doctor.name}`);
                await doctor.save();
            }
        }

        console.log(`\n✅ Migration completed successfully!`);
        console.log(`   - "Video Call" removed from consultationModes`);
        console.log(`   - All doctors now comply with new enum validation`);

        await mongoose.disconnect();
        console.log('\n📡 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run migration
migrate();
