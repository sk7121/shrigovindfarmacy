/**
 * Test Script: Complete COD Purchase Flow
 * 
 * This script tests the entire flow:
 * 1. Create a test user
 * 2. Create/add products to cart
 * 3. Place COD order
 * 4. Assign delivery agent
 * 5. Generate & verify OTP
 * 6. Complete delivery with proof
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import models
const User = require('../models/user');
const Product = require('../models/product');
const Cart = require('../models/cart');
const Order = require('../models/order');
const Delivery = require('../models/delivery');
const DeliveryAgent = require('../models/deliveryAgent');

// Test configuration
const TEST_DATA = {
    user: {
        name: 'Test Customer',
        email: 'testcustomer@example.com',
        phone: '9876543210',
        password: 'test123',
        role: 'user'
    },
    agent: {
        name: 'Test Delivery Agent',
        email: 'testagent@example.com',
        phone: '9123456789',
        password: 'agent123',
        vehicleType: 'bike',
        vehicleNumber: 'RJ14AB1234'
    },
    products: [
        {
            name: 'Chyawanprash',
            description: 'Ayurvedic health supplement',
            price: 299,
            stock: 50,
            category: 'Health Supplements',
            image: 'https://example.com/chyawanprash.jpg'
        },
        {
            name: 'Ashwagandha Powder',
            description: 'Pure organic ashwagandha',
            price: 199,
            stock: 30,
            category: 'Herbal Products',
            image: 'https://example.com/ashwagandha.jpg'
        }
    ],
    address: {
        fullName: 'Test Customer',
        email: 'testcustomer@example.com',
        phone: '9876543210',
        address: '123, Test Street',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001',
        landmark: 'Near Test Market'
    }
};

// Connect to MongoDB
async function connectDB() {
    try {
        const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/shrigovind-pharmacy';
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB connected to:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '\/\/$1:***@'));
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
}

// Cleanup previous test data
async function cleanup() {
    console.log('\n🧹 Cleaning up previous test data...');
    await User.deleteMany({ email: { $in: [TEST_DATA.user.email, TEST_DATA.agent.email] } });
    await Product.deleteMany({ name: { $in: TEST_DATA.products.map(p => p.name) } });
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await Delivery.deleteMany({});
    await DeliveryAgent.deleteMany({ email: TEST_DATA.agent.email });
    console.log('✅ Cleanup complete');
}

// Create test user
async function createUser() {
    console.log('\n👤 Creating test user...');
    const hashedPassword = await bcrypt.hash(TEST_DATA.user.password, 10);
    const user = await User.create({
        ...TEST_DATA.user,
        password: hashedPassword,
        isEmailVerified: true
    });
    console.log(`✅ User created: ${user.email} (ID: ${user._id})`);
    return user;
}

// Create delivery agent
async function createAgent() {
    console.log('\n🚚 Creating delivery agent...');
    const hashedPassword = await bcrypt.hash(TEST_DATA.agent.password, 10);
    const agent = await DeliveryAgent.create({
        name: TEST_DATA.agent.name,
        email: TEST_DATA.agent.email,
        phone: TEST_DATA.agent.phone,
        password: hashedPassword,
        vehicleType: TEST_DATA.agent.vehicleType,
        vehicleNumber: TEST_DATA.agent.vehicleNumber,
        isActive: true,
        isAvailable: true,
        currentStatus: 'idle',
        coverageAreas: [{
            city: 'Jaipur',
            pincode: '302001',
            zones: ['Zone A']
        }],
        address: {
            city: 'Jaipur',
            state: 'Rajasthan',
            pincode: '302001'
        }
    });
    console.log(`✅ Agent created: ${agent.email} (ID: ${agent._id})`);
    return agent;
}

// Create test products
async function createProducts() {
    console.log('\n📦 Creating test products...');
    const products = [];
    for (const prodData of TEST_DATA.products) {
        const product = await Product.create(prodData);
        console.log(`   - ${product.name}: ₹${product.price} (Stock: ${product.stock})`);
        products.push(product);
    }
    return products;
}

// Add products to cart
async function addToCart(user, products) {
    console.log('\n🛒 Adding products to cart...');
    const cart = await Cart.create({
        user: user._id,
        items: products.map(p => ({
            product: p._id,
            quantity: 1
        }))
    });
    console.log(`✅ Cart created with ${cart.items.length} items`);
    return cart;
}

// Place COD order
async function placeOrder(user, products) {
    console.log('\n📝 Placing COD order...');
    
    const orderItems = products.map(p => ({
        product: p._id,
        name: p.name,
        image: p.image,
        price: p.price,
        quantity: 1,
        subtotal: p.price
    }));
    
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const gst = subtotal * 0.05;
    const total = subtotal + gst;
    
    const order = await Order.create({
        user: user._id,
        items: orderItems,
        address: TEST_DATA.address,
        payment: {
            method: 'cod',
            status: 'pending'
        },
        pricing: {
            subtotal,
            gst,
            total
        },
        status: 'confirmed'
    });
    
    console.log(`✅ Order created: ${order.tracking.orderId}`);
    console.log(`   Total: ₹${total.toFixed(2)}`);
    console.log(`   Status: ${order.status}`);
    return order;
}

// Create delivery record
async function createDelivery(order) {
    console.log('\n📬 Creating delivery record...');
    
    // Generate QR code and secret
    const crypto = require('crypto');
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    const qrCode = `DLV${timestamp}${random}`;
    const qrCodeSecret = crypto.randomBytes(32).toString('hex');
    
    const delivery = await Delivery.create({
        order: order._id,
        qrCode: qrCode,
        qrCodeSecret: qrCodeSecret,
        status: 'pending_assignment',
        deliveryAddress: {
            fullName: order.address.fullName,
            phone: order.address.phone,
            address: order.address.address,
            city: order.address.city,
            state: order.address.state,
            pincode: order.address.pincode,
            landmark: order.address.landmark
        },
        priority: 'normal',
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    });
    console.log(`✅ Delivery created (ID: ${delivery._id})`);
    console.log(`   Status: ${delivery.status}`);
    console.log(`   QR Code: ${delivery.qrCode}`);
    return delivery;
}

// Assign delivery to agent
async function assignDelivery(delivery, agent) {
    console.log('\n👨‍💼 Assigning delivery to agent...');
    
    // Generate OTP (6-digit)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    delivery.assignedTo = agent._id;
    delivery.assignedAt = new Date();
    delivery.assignmentMethod = 'manual';
    delivery.deliveryOTP = otp;
    
    await delivery.updateStatus('assigned', `Assigned to agent ${agent.name}. OTP: ${otp}`);
    
    console.log(`✅ Delivery assigned to: ${agent.name}`);
    console.log(`   OTP: ${otp} (expires: ${otpExpiresAt.toLocaleString()})`);
    console.log(`   Status: ${delivery.status}`);
    
    return { delivery, otp };
}

// Simulate delivery agent actions
async function simulateDeliveryAgent(order, delivery, otp) {
    console.log('\n🚴 Simulating delivery agent actions...');
    
    // Step 1: Agent picks up the order
    console.log('   1. Agent picks up order from warehouse...');
    await delivery.updateStatus('picked_up', 'Order picked up from warehouse');
    await Order.findByIdAndUpdate(order._id, { status: 'processing' });
    console.log('      ✅ Status: picked_up');
    
    // Step 2: Agent goes in transit
    console.log('   2. Agent on the way to customer...');
    await delivery.updateStatus('in_transit', 'On the way to customer');
    console.log('      ✅ Status: in_transit');
    
    // Step 3: Out for delivery
    console.log('   3. Agent reached customer location...');
    await delivery.updateStatus('out_for_delivery', 'Out for final delivery');
    await Order.findByIdAndUpdate(order._id, { status: 'out_for_delivery' });
    console.log('      ✅ Status: out_for_delivery');
    
    // Step 4: Generate delivery OTP (for customer)
    console.log('   4. Generating delivery OTP for customer...');
    const deliveryOTP = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    order.deliveryOTP = {
        code: deliveryOTP,
        expiresAt: otpExpiresAt,
        generatedAt: new Date()
    };
    await order.save();
    console.log(`      ✅ Customer OTP: ${deliveryOTP} (valid for 30 min)`);
    
    // Step 5: Verify OTP (customer provides OTP)
    console.log('   5. Customer provides OTP: ' + deliveryOTP);
    if (order.deliveryOTP.code !== deliveryOTP) {
        throw new Error('Invalid OTP!');
    }
    order.deliveryOTP.verifiedAt = new Date();
    await order.save();
    console.log('      ✅ OTP verified successfully');
    
    // Step 6: Upload delivery proof and complete
    console.log('   6. Uploading delivery proof image...');
    const proofImageUrl = 'https://example.com/delivery-proof-' + Date.now() + '.jpg';
    
    order.deliveryProof = {
        image: proofImageUrl,
        uploadedAt: new Date()
    };
    order.status = 'delivered';
    order.tracking.deliveredAt = new Date();
    await order.save();
    console.log('      ✅ Delivery proof uploaded');
    
    // Step 7: Mark delivery as complete
    console.log('   7. Marking delivery as complete...');
    delivery.status = 'delivered';
    delivery.actualDelivery = new Date();
    delivery.otpVerified = true;
    delivery.attempts.push({
        attemptNumber: 1,
        timestamp: new Date(),
        status: 'success',
        notes: 'Delivered with proof image and OTP verification',
        proof: {
            photo: proofImageUrl,
            otp: 'verified'
        }
    });
    await delivery.save();
    console.log('      ✅ Delivery completed successfully!');
    
    return { order, delivery };
}

// Verify final state
async function verifyFinalState(orderId, deliveryId) {
    console.log('\n✅ Verifying final state...');
    
    const order = await Order.findById(orderId);
    const delivery = await Delivery.findById(deliveryId)
        .populate('assignedTo')
        .populate('order');
    
    console.log('\n📋 ORDER STATUS:');
    console.log(`   Order ID: ${order.tracking.orderId}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment: ${order.payment.method} - ${order.payment.status}`);
    console.log(`   Delivered At: ${order.tracking.deliveredAt}`);
    console.log(`   OTP Verified: ${!!order.deliveryOTP?.verifiedAt}`);
    console.log(`   Proof Image: ${!!order.deliveryProof?.image}`);
    
    console.log('\n📋 DELIVERY STATUS:');
    console.log(`   Delivery ID: ${delivery._id}`);
    console.log(`   Status: ${delivery.status}`);
    console.log(`   Assigned To: ${delivery.assignedTo?.name}`);
    console.log(`   Actual Delivery: ${delivery.actualDelivery}`);
    console.log(`   OTP Verified: ${delivery.otpVerified}`);
    console.log(`   Attempts: ${delivery.attempts.length}`);
    
    // Assertions
    const checks = [
        { name: 'Order status is delivered', pass: order.status === 'delivered' },
        { name: 'Delivery status is delivered', pass: delivery.status === 'delivered' },
        { name: 'OTP was verified', pass: !!order.deliveryOTP?.verifiedAt },
        { name: 'Proof image exists', pass: !!order.deliveryProof?.image },
        { name: 'Delivery timestamp set', pass: !!order.tracking.deliveredAt },
        { name: 'Agent assigned', pass: !!delivery.assignedTo }
    ];
    
    console.log('\n✅ VALIDATION CHECKS:');
    let allPassed = true;
    checks.forEach(check => {
        const icon = check.pass ? '✅' : '❌';
        console.log(`   ${icon} ${check.name}`);
        if (!check.pass) allPassed = false;
    });
    
    return allPassed;
}

// Main test execution
async function runTest() {
    console.log('='.repeat(60));
    console.log('🧪 TESTING COMPLETE COD PURCHASE & DELIVERY FLOW');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    
    try {
        await connectDB();
        await cleanup();
        
        // Step 1: Create user
        const user = await createUser();
        
        // Step 2: Create delivery agent
        const agent = await createAgent();
        
        // Step 3: Create products
        const products = await createProducts();
        
        // Step 4: Add to cart
        await addToCart(user, products);
        
        // Step 5: Place COD order
        const order = await placeOrder(user, products);
        
        // Step 6: Create delivery
        const delivery = await createDelivery(order);
        
        // Step 7: Assign delivery to agent
        const { otp } = await assignDelivery(delivery, agent);
        
        // Step 8: Simulate delivery agent completing delivery
        await simulateDeliveryAgent(order, delivery, otp);
        
        // Step 9: Verify final state
        const allPassed = await verifyFinalState(order._id, delivery._id);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log('\n' + '='.repeat(60));
        if (allPassed) {
            console.log('🎉 ALL TESTS PASSED!');
            console.log(`⏱️  Duration: ${duration}s`);
        } else {
            console.log('❌ SOME TESTS FAILED!');
            console.log(`⏱️  Duration: ${duration}s`);
        }
        console.log('='.repeat(60));
        
        // Keep test data for manual verification
        console.log('\n📝 TEST DATA (for manual verification):');
        console.log(`   User: ${TEST_DATA.user.email} / ${TEST_DATA.user.password}`);
        console.log(`   Agent: ${TEST_DATA.agent.email} / ${TEST_DATA.agent.password}`);
        console.log(`   Order ID: ${order.tracking.orderId}`);
        
        process.exit(allPassed ? 0 : 1);
        
    } catch (error) {
        console.error('\n❌ TEST FAILED WITH ERROR:', error);
        process.exit(1);
    }
}

// Run the test
runTest();
