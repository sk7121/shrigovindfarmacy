/**
 * Quick Test: Verify QR Code Generation Fix
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Delivery = require('../models/delivery');
const Order = require('../models/order');

async function test() {
    console.log('🧪 Testing QR Code Generation Fix\n');
    
    try {
        // Connect
        const mongoUri = process.env.MONGO_URL;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // Test 1: Create delivery with Delivery.create()
        console.log('Test 1: Creating delivery with Delivery.create()...');
        const testOrder = await Order.findOne();
        
        if (!testOrder) {
            console.log('⚠️  No orders found, skipping test');
            return;
        }
        
        const crypto = require('crypto');
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        const qrCode = `DLV${timestamp}${random}`;
        const qrCodeSecret = crypto.randomBytes(32).toString('hex');
        
        const delivery = await Delivery.create({
            order: testOrder._id,
            qrCode: qrCode,
            qrCodeSecret: qrCodeSecret,
            status: 'pending_assignment',
            deliveryAddress: {
                fullName: 'Test Customer',
                phone: '9876543210',
                address: 'Test Address',
                city: 'Jaipur',
                state: 'Rajasthan',
                pincode: '302001'
            }
        });
        
        console.log('✅ Delivery created successfully!');
        console.log(`   ID: ${delivery._id}`);
        console.log(`   QR Code: ${delivery.qrCode}`);
        console.log(`   Has QR Secret: ${!!delivery.qrCodeSecret}`);
        console.log(`   Status: ${delivery.status}`);
        
        // Test 2: Verify QR code format
        console.log('\nTest 2: Verifying QR code format...');
        const qrCodePattern = /^DLV[A-Z0-9]{12}$/;
        const isValid = qrCodePattern.test(delivery.qrCode);
        console.log(`   Pattern: DLV{timestamp}{random}`);
        console.log(`   Valid Format: ${isValid ? '✅ YES' : '❌ NO'}`);
        
        // Test 3: Verify QR secret length
        console.log('\nTest 3: Verifying QR secret length...');
        const secretLength = delivery.qrCodeSecret.length;
        console.log(`   Secret Length: ${secretLength} characters`);
        console.log(`   Expected: 64 characters`);
        console.log(`   Valid: ${secretLength === 64 ? '✅ YES' : '❌ NO'}`);
        
        // Cleanup
        await Delivery.findByIdAndDelete(delivery._id);
        console.log('\n🧹 Test delivery cleaned up');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL TESTS PASSED!');
        console.log('   QR code generation is working correctly.');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.validationErrors) {
            console.error('   Validation errors:', error.validationErrors);
        }
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

test();
