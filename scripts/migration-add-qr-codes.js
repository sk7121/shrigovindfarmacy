/**
 * Migration Script: Add QR Codes to Existing Deliveries
 * 
 * This script finds all deliveries missing qrCode or qrCodeSecret
 * and generates them.
 * 
 * Usage: node scripts/migration-add-qr-codes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const Delivery = require('../models/delivery');

async function migrate() {
    console.log('🚀 Starting QR Code Migration...\n');
    
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('❌ Error: MONGO_URL not found in .env file');
            process.exit(1);
        }
        
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // Find deliveries missing QR codes
        const deliveriesWithoutQR = await Delivery.find({
            $or: [
                { qrCode: { $exists: false } },
                { qrCode: null },
                { qrCodeSecret: { $exists: false } },
                { qrCodeSecret: null }
            ]
        });
        
        console.log(`📊 Found ${deliveriesWithoutQR.length} deliveries missing QR codes\n`);
        
        if (deliveriesWithoutQR.length === 0) {
            console.log('✅ All deliveries already have QR codes!');
            return;
        }
        
        // Update each delivery
        let updated = 0;
        let failed = 0;
        
        for (const delivery of deliveriesWithoutQR) {
            try {
                // Generate QR code and secret
                const timestamp = Date.now().toString(36).toUpperCase();
                const random = crypto.randomBytes(4).toString('hex').toUpperCase();
                const qrCode = `DLV${timestamp}${random}`;
                const qrCodeSecret = crypto.randomBytes(32).toString('hex');
                
                // Update delivery
                delivery.qrCode = qrCode;
                delivery.qrCodeSecret = qrCodeSecret;
                await delivery.save();
                
                updated++;
                console.log(`✅ Updated: ${delivery._id} - QR Code: ${qrCode}`);
            } catch (error) {
                failed++;
                console.error(`❌ Failed to update ${delivery._id}:`, error.message);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`   Total found: ${deliveriesWithoutQR.length}`);
        console.log(`   ✅ Updated: ${updated}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log('='.repeat(60));
        
        if (failed === 0) {
            console.log('\n🎉 Migration completed successfully!');
        } else {
            console.log(`\n⚠️  Migration completed with ${failed} errors`);
        }
        
    } catch (error) {
        console.error('\n❌ Migration error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Database connection closed');
    }
}

// Run migration
migrate();
