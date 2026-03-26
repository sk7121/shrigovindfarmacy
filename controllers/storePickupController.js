const StorePickup = require('../models/storePickup');
const Order = require('../models/order');
const { sendOrderStatusSMS } = require('../services/smsService');

// @desc    Get all orders pending store pickup
// @route   GET /admin/store-pickups
// @access  Private/Admin
const getPendingStorePickups = async (req, res) => {
    try {
        // Get orders that are out for delivery but not yet picked up from store
        const pendingOrders = await Order.find({
            status: 'out_for_delivery',
            deliveryAgent: { $exists: true } // Has delivery agent assigned
        })
        .populate('user', 'name phone email')
        .populate('deliveryAgent', 'name phone')
        .sort({ createdAt: -1 });

        // Get ALL store pickup records (including pending ones with OTP)
        const pickupRecords = await StorePickup.find({
            order: { $in: pendingOrders.map(o => o._id) },
            status: { $in: ['pending_pickup', 'otp_generated'] }
        })
        .populate('order', 'tracking.orderId user status pricing')
        .select('+pickupOTP') // Include OTP
        .sort({ createdAt: -1 });

        // Find orders without pickup records (OTP not generated yet)
        const ordersWithoutPickup = pendingOrders.filter(order => {
            return !pickupRecords.find(record => record.order && record.order._id.equals(order._id));
        });

        res.render('admin/store-pickups/index', {
            pendingOrders: ordersWithoutPickup,
            pickupRecords: pickupRecords,
            page: 'pending'
        });
    } catch (err) {
        console.error('Error fetching pending store pickups:', err);
        res.status(500).send('Error loading store pickups');
    }
};

// @desc    Get all store pickup records
// @route   GET /admin/store-pickups/all
// @access  Private/Admin
const getAllStorePickups = async (req, res) => {
    try {
        const pickups = await StorePickup.find({})
            .populate('order', 'tracking.orderId user status')
            .populate('store', 'name email')
            .populate('pickedUpBy.verifiedBy', 'name email')
            .select('+verificationCode')
            .sort({ createdAt: -1 });

        res.render('admin/store-pickups/index', {
            pickups,
            page: 'all'
        });
    } catch (err) {
        console.error('Error fetching all store pickups:', err);
        res.status(500).send('Error loading store pickups');
    }
};

// @desc    Generate OTP for store pickup
// @route   POST /admin/store-pickups/:orderId/generate-otp
// @access  Private/Admin
const generatePickupOTP = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Check if order exists and is out for delivery
        const order = await Order.findById(orderId)
            .populate('user', 'name phone email')
            .populate('deliveryAgent', 'name phone');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status !== 'out_for_delivery') {
            return res.status(400).json({
                success: false,
                message: 'Order is not out for delivery yet'
            });
        }

        // Check if pickup record already exists
        let pickup = await StorePickup.findOne({ order: orderId }).select('+pickupOTP');

        if (pickup) {
            if (pickup.status === 'picked_up') {
                return res.status(400).json({
                    success: false,
                    message: 'Order has already been picked up'
                });
            }
            
            // Regenerate OTP
            await pickup.generateOTP();
            
            // Send OTP via SMS
            try {
                await sendOrderStatusSMS(order, order.user.phone, 'store_pickup_otp', pickup.pickupOTP);
            } catch (smsErr) {
                console.error('Failed to send OTP SMS:', smsErr);
            }

            return res.json({
                success: true,
                message: 'OTP regenerated successfully',
                otp: pickup.pickupOTP, // In production, don't send OTP in response
                expiresAt: pickup.otpExpiresAt
            });
        }

        // Create new pickup record
        pickup = new StorePickup({
            order: orderId,
            store: req.user._id,
            storeName: 'Shri Govind Pharmacy - Main Store'
        });

        // Generate OTP
        await pickup.generateOTP();

        // Send OTP via SMS
        try {
            await sendOrderStatusSMS(order, order.user.phone, 'store_pickup_otp', pickup.pickupOTP);
        } catch (smsErr) {
            console.error('Failed to send OTP SMS:', smsErr);
        }

        res.json({
            success: true,
            message: 'OTP generated and sent to customer',
            otp: pickup.pickupOTP, // In production, don't send OTP in response
            expiresAt: pickup.otpExpiresAt
        });
    } catch (err) {
        console.error('Error generating pickup OTP:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Verify OTP for store pickup
// @route   POST /admin/store-pickups/:orderId/verify-otp
// @access  Private/Admin
const verifyPickupOTP = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { otp } = req.body; // Using 'otp' key for backward compatibility

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'Verification code is required'
            });
        }

        // Find pickup record
        const pickup = await StorePickup.findOne({ order: orderId }).select('+verificationCode');

        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup record not found'
            });
        }

        if (pickup.status === 'picked_up') {
            return res.status(400).json({
                success: false,
                message: 'Order has already been picked up'
            });
        }

        // Verify code (last 4 digits of order ID)
        const result = pickup.verifyCode(otp, req.user._id);

        if (result.success) {
            await pickup.save();

            // Update order status
            const order = await Order.findById(orderId);
            if (order) {
                order.status = 'delivered';
                order.tracking.deliveredAt = new Date();
                await order.save();

                // Send confirmation SMS
                try {
                    await sendOrderStatusSMS(order, order.user.phone, 'delivered');
                } catch (smsErr) {
                    console.error('Failed to send delivery SMS:', smsErr);
                }
            }

            return res.json({
                success: true,
                message: 'Order picked up successfully'
            });
        } else {
            await pickup.save();
            return res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (err) {
        console.error('Error verifying pickup OTP:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Manual pickup (without OTP)
// @route   POST /admin/store-pickups/:orderId/manual-pickup
// @access  Private/Admin
const manualPickup = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { staffName, staffPhone, reason } = req.body;

        if (!staffName || !staffPhone) {
            return res.status(400).json({
                success: false,
                message: 'Staff name and phone are required'
            });
        }

        // Find pickup record
        let pickup = await StorePickup.findOne({ order: orderId });

        if (!pickup) {
            // Create new pickup record
            pickup = new StorePickup({
                order: orderId,
                store: req.user._id,
                storeName: 'Shri Govind Pharmacy - Main Store',
                status: 'picked_up'
            });
        }

        await pickup.markAsPickedUp(staffName, staffPhone, req.user._id);

        // Update order status
        const order = await Order.findById(orderId);
        if (order) {
            order.status = 'delivered';
            order.tracking.deliveredAt = new Date();
            await order.save();

            // Send confirmation SMS
            try {
                await sendOrderStatusSMS(order, order.user.phone, 'delivered');
            } catch (smsErr) {
                console.error('Failed to send delivery SMS:', smsErr);
            }
        }

        res.json({
            success: true,
            message: 'Order marked as picked up successfully'
        });
    } catch (err) {
        console.error('Error in manual pickup:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Assign pickup (mark as picked up - OTP will be verified during final delivery)
// @route   POST /admin/store-pickups/:orderId/assign
// @access  Private/Admin
const assignPickup = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Check if order exists
        const order = await Order.findById(orderId)
            .populate('user', 'name phone email');
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Find or create pickup record
        let pickup = await StorePickup.findOne({ order: orderId });

        if (!pickup) {
            // Create new pickup record already marked as picked up
            pickup = new StorePickup({
                order: orderId,
                store: req.user._id,
                storeName: 'Shri Govind Pharmacy - Main Store',
                status: 'picked_up',
                pickedUpBy: {
                    name: req.user.name || 'Admin',
                    phone: req.user.phone || 'N/A',
                    verifiedBy: req.user._id,
                    verifiedAt: new Date()
                }
            });

            // Save once
            await pickup.save();
        } else {
            // Update existing pickup using findByIdAndUpdate to avoid parallel save
            await StorePickup.findByIdAndUpdate(pickup._id, {
                status: 'picked_up',
                pickedUpBy: {
                    name: req.user.name || 'Admin',
                    phone: req.user.phone || 'N/A',
                    verifiedBy: req.user._id,
                    verifiedAt: new Date()
                },
                $push: {
                    timeline: {
                        status: 'picked_up',
                        timestamp: new Date(),
                        notes: `Picked up by admin - ${req.user.name || 'Admin'}`,
                        updatedBy: req.user._id
                    }
                }
            });
        }

        // Update order status to picked_up (not delivered yet - agent needs to complete delivery)
        order.status = 'picked_up';
        order.tracking.shippedAt = new Date();

        console.log('\n========== STORE PICKUP: UPDATING ORDER ==========');
        console.log('Order ID:', order._id);
        console.log('New Status:', order.status);
        console.log('OTP Code Before Save:', order.deliveryOTP?.code || 'NONE');
        console.log('OTP verifiedAt Before Save:', order.deliveryOTP?.verifiedAt || 'NOT SET (CORRECT!)');
        console.log('Note: We are NOT setting verifiedAt here - this is correct!');
        console.log('==================================================\n');

        // Note: Do NOT mark OTP as verified here - OTP should only be verified during final delivery
        // if (order.deliveryOTP) {
        //     order.deliveryOTP.verifiedAt = new Date();
        // }

        console.log('🔵 Updating Order:', orderId, 'Status:', order.status);
        await order.save();
        console.log('✅ Order saved successfully');

        // Reload and verify
        const savedOrder = await Order.findById(order._id);
        console.log('\n========== AFTER SAVE VERIFICATION ==========');
        console.log('Order Status:', savedOrder.status);
        console.log('OTP Code:', savedOrder.deliveryOTP?.code || 'NONE');
        console.log('OTP verifiedAt:', savedOrder.deliveryOTP?.verifiedAt || 'NOT SET (CORRECT!)');
        console.log('=============================================\n');

        // Update corresponding Delivery document to picked_up (not delivered yet)
        const Delivery = require('../models/delivery');
        const delivery = await Delivery.findOne({ order: orderId });
        if (delivery) {
            console.log('🔵 Found Delivery document:', delivery._id, 'Current status:', delivery.status);

            // Use findByIdAndUpdate to avoid parallel save error from addTimelineEntry
            await Delivery.findByIdAndUpdate(delivery._id, {
                status: 'picked_up',
                $push: {
                    timeline: {
                        status: 'picked_up',
                        timestamp: new Date(),
                        notes: 'Order picked up by admin - awaiting final delivery',
                        updatedBy: req.user._id
                    }
                }
            });
            console.log('✅ Delivery saved successfully');
        } else {
            console.log('⚠️ No Delivery document found for this order');
        }

        // Send confirmation SMS to customer about pickup
        try {
            await sendOrderStatusSMS(order, order.user.phone, 'picked_up');
        } catch (smsErr) {
            console.error('Failed to send pickup SMS:', smsErr);
        }

        res.json({
            success: true,
            message: 'Order marked as picked up successfully. OTP will be verified during final delivery to customer.'
        });
    } catch (err) {
        console.error('Error assigning pickup:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to assign pickup'
        });
    }
};

// @desc    Cancel store pickup
// @route   POST /admin/store-pickups/:orderId/cancel
// @access  Private/Admin
const cancelPickup = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const pickup = await StorePickup.findOne({ order: orderId });

        if (!pickup) {
            return res.status(404).json({
                success: false,
                message: 'Pickup record not found'
            });
        }

        await pickup.cancelPickup(reason);

        // Update order status back to assigned
        const order = await Order.findById(orderId);
        if (order) {
            order.status = 'assigned';
            await order.save();
        }

        res.json({
            success: true,
            message: 'Pickup cancelled successfully'
        });
    } catch (err) {
        console.error('Error cancelling pickup:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

// @desc    Get pickup statistics
// @route   GET /admin/store-pickups/api/stats
// @access  Private/Admin
const getPickupStats = async (req, res) => {
    try {
        const pending = await StorePickup.countDocuments({ status: { $in: ['pending_pickup', 'otp_generated'] } });
        const pickedUp = await StorePickup.countDocuments({ status: 'picked_up' });
        const cancelled = await StorePickup.countDocuments({ status: 'cancelled' });
        const expired = await StorePickup.countDocuments({ status: 'expired' });

        // Today's pickups
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todaysPickups = await StorePickup.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow },
            status: 'picked_up'
        });

        res.json({
            success: true,
            stats: {
                pending,
                pickedUp,
                cancelled,
                expired,
                todaysPickups
            }
        });
    } catch (err) {
        console.error('Error fetching pickup stats:', err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

module.exports = {
    getPendingStorePickups,
    getAllStorePickups,
    generatePickupOTP,
    verifyPickupOTP,
    manualPickup,
    assignPickup,
    cancelPickup,
    getPickupStats
};
