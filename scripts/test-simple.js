/**
 * Simple COD Flow Test
 * Direct database test to verify the flow works
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const Order = require('../models/order');
const Delivery = require('../models/delivery');

async function test() {
    console.log('🧪 Testing COD Flow - Database Verification\n');
    
    try {
        // Connect
        const mongoUri = process.env.MONGO_URL;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');
        
        // Get latest orders
        console.log('📦 Latest Orders:');
        const orders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name email');
        
        if (orders.length === 0) {
            console.log('   No orders found in database');
            console.log('\n📝 To test the flow:');
            console.log('1. Visit: http://localhost:3000/home');
            console.log('2. Register an account');
            console.log('3. Add products to cart');
            console.log('4. Checkout with COD');
            console.log('5. Run this script again');
        } else {
            for (const order of orders) {
                const i = orders.indexOf(order);
                console.log(`\n   ${i + 1}. Order: ${order.tracking.orderId}`);
                console.log(`      Status: ${order.status}`);
                console.log(`      Payment: ${order.payment.method}`);
                console.log(`      Total: ₹${order.pricing.total}`);
                console.log(`      Customer: ${order.user?.name || 'Unknown'}`);
                console.log(`      Created: ${new Date(order.createdAt).toLocaleString()}`);
                
                // Check delivery
                const delivery = await Delivery.findOne({ order: order._id })
                    .populate('assignedTo');
                
                if (delivery) {
                    console.log(`      Delivery Status: ${delivery.status}`);
                    console.log(`      Assigned To: ${delivery.assignedTo?.name || 'Unassigned'}`);
                    if (delivery.deliveryOTP) {
                        console.log(`      OTP Generated: Yes`);
                    }
                    if (delivery.otpVerified) {
                        console.log(`      OTP Verified: Yes ✅`);
                    }
                    if (delivery.deliveryProof?.image || order.deliveryProof?.image) {
                        console.log(`      Proof Uploaded: Yes ✅`);
                    }
                } else {
                    console.log(`      Delivery: Not created yet`);
                }
            }
            
            console.log('\n\n📋 Delivery Flow Status:');
            const pendingOrders = await Order.countDocuments({ 
                status: { $in: ['pending', 'confirmed'] } 
            });
            const processingOrders = await Order.countDocuments({ 
                status: { $in: ['processing', 'assigned'] } 
            });
            const outForDelivery = await Order.countDocuments({ 
                status: 'out_for_delivery' 
            });
            const delivered = await Order.countDocuments({ 
                status: 'delivered' 
            });
            
            console.log(`   📭 Pending/Confirmed: ${pendingOrders}`);
            console.log(`   🔄 Processing/Assigned: ${processingOrders}`);
            console.log(`   🚚 Out for Delivery: ${outForDelivery}`);
            console.log(`   ✅ Delivered: ${delivered}`);
        }
        
        // Get delivery agents
        console.log('\n\n👨‍💼 Delivery Agents:');
        const DeliveryAgent = require('../models/deliveryAgent');
        const agents = await DeliveryAgent.find({ isActive: true });
        
        if (agents.length === 0) {
            console.log('   No delivery agents found');
            console.log('\n📝 To create an agent:');
            console.log('Visit: http://localhost:3000/auth/delivery-agent/register');
        } else {
            for (const agent of agents) {
                const i = agents.indexOf(agent);
                console.log(`\n   ${i + 1}. ${agent.name}`);
                console.log(`      Email: ${agent.email}`);
                console.log(`      Phone: ${agent.phone}`);
                console.log(`      Vehicle: ${agent.vehicleType} - ${agent.vehicleNumber}`);
                console.log(`      Status: ${agent.currentStatus}`);
                console.log(`      Total Deliveries: ${agent.stats.totalDeliveries}`);
            }
        }
        
        console.log('\n✅ Test complete!\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

test();
