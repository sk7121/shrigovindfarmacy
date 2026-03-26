const mongoose = require('mongoose');
const Order = require('../models/order');
const Delivery = require('../models/delivery');
const OTP = require('../models/otp');
const User = require('../models/user');
const DeliveryAgent = require('../models/deliveryAgent');
const { sendOrderStatusUpdate } = require('../services/emailService');
const { sendOrderStatusSMS } = require('../services/smsService');

// @desc    Get delivery details for agent with customer information
// @route   GET /api/delivery/:id
// @access  Private (Delivery Agent)
const getDeliveryDetails = async (req, res) => {
    try {
        // Validate delivery ID
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid delivery ID'
            });
        }

        const delivery = await Delivery.findById(req.params.id)
            .populate('order')
            .populate('assignedTo');

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: 'Delivery not found'
            });
        }

        // Check if delivery is assigned to this agent
        if (delivery.assignedTo && delivery.assignedTo._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this delivery'
            });
        }

        // Ensure delivery address is populated from order if not set
        if (!delivery.deliveryAddress.fullName && delivery.order && delivery.order.address) {
            delivery.deliveryAddress = {
                fullName: delivery.order.address.fullName,
                phone: delivery.order.address.phone,
                address: delivery.order.address.address,
                city: delivery.order.address.city,
                state: delivery.order.address.state,
                pincode: delivery.order.address.pincode,
                landmark: delivery.order.address.landmark
            };
            await delivery.save();
        }

        res.json({
            success: true,
            data: delivery
        });
    } catch (error) {
        console.error('Get delivery details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching delivery details'
        });
    }
};

// @desc    Generate delivery OTP for order
// @route   POST /api/delivery/:orderId/generate-otp
// @access  Private (Delivery Agent)
const generateDeliveryOTP = async (req, res) => {
    try {
        // Validate order ID
        if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order is picked up (OTP should be generated after agent picks up the order)
        if (!['picked_up', 'out_for_delivery'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'OTP can only be generated after order is picked up by the delivery agent'
            });
        }

        // Check if OTP already exists and is not expired
        if (order.deliveryOTP && order.deliveryOTP.code && new Date() < new Date(order.deliveryOTP.expiresAt)) {
            return res.json({
                success: true,
                message: 'OTP already generated',
                data: {
                    expiresAt: order.deliveryOTP.expiresAt,
                    expiresIn: '30 minutes',
                    alreadyGenerated: true
                }
            });
        }

        // Generate 6-digit OTP
        const otpCode = OTP.generateOTP(6);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        // Store OTP in order
        order.deliveryOTP = {
            code: otpCode,
            expiresAt,
            generatedAt: new Date()
        };

        await order.save();

        // Send OTP via SMS to customer
        const customerPhone = order.address.phone;
        const customerName = order.address.fullName;
        
        try {
            await sendOrderStatusSMS(order, customerPhone, 'assigned', otpCode);
            console.log('OTP SMS sent to customer:', customerPhone);
        } catch (smsError) {
            console.error('Failed to send OTP SMS:', smsError);
            // Don't fail the request if SMS fails
        }

        res.json({
            success: true,
            message: 'Delivery OTP generated successfully. Please ask customer for this OTP.',
            data: {
                expiresAt,
                expiresIn: '30 minutes'
            }
        });
    } catch (error) {
        console.error('Generate OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating delivery OTP'
        });
    }
};

// @desc    Verify delivery OTP
// @route   POST /api/delivery/:orderId/verify-otp
// @access  Private (Delivery Agent)
const verifyDeliveryOTP = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'Please provide OTP'
            });
        }

        // Validate order ID
        if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if OTP exists and is valid
        if (!order.deliveryOTP || !order.deliveryOTP.code) {
            return res.status(400).json({
                success: false,
                message: 'No OTP generated for this order. Please generate OTP first.'
            });
        }

        // Check if OTP is expired
        if (new Date() > new Date(order.deliveryOTP.expiresAt)) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please generate a new OTP.'
            });
        }

        // Check if already verified
        if (order.deliveryOTP.verifiedAt) {
            return res.status(400).json({
                success: false,
                message: 'OTP already verified'
            });
        }

        // Verify OTP
        if (order.deliveryOTP.code !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // Mark OTP as verified
        order.deliveryOTP.verifiedAt = new Date();
        await order.save();

        res.json({
            success: true,
            message: 'OTP verified successfully'
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying delivery OTP'
        });
    }
};

// @desc    Upload delivery proof image and mark as delivered
// @route   POST /api/delivery/:orderId/complete
// @access  Private (Delivery Agent)
const completeDelivery = async (req, res) => {
    try {
        const { otp } = req.body;

        console.log('📦 Complete Delivery - Order ID:', req.params.orderId);
        console.log('📷 File received:', !!req.file);
        console.log('🔑 OTP provided:', !!otp);

        // Validate order ID
        if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        if (!req.file) {
            console.error('❌ No file uploaded');
            return res.status(400).json({
                success: false,
                message: 'Delivery proof image is required. Please capture a photo of the delivered package.'
            });
        }

        if (!otp) {
            console.error('❌ No OTP provided');
            return res.status(400).json({
                success: false,
                message: 'OTP verification is required. Please ask the customer for the 6-digit OTP.'
            });
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            console.error('❌ Order not found:', req.params.orderId);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if OTP exists
        if (!order.deliveryOTP || !order.deliveryOTP.code) {
            console.error('❌ No OTP generated for this order');
            return res.status(400).json({
                success: false,
                message: 'No OTP generated for this order. Please generate OTP first using the "Generate OTP" button.'
            });
        }

        // Check if OTP is expired
        if (new Date() > new Date(order.deliveryOTP.expiresAt)) {
            console.error('❌ OTP has expired');
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please generate a new OTP.'
            });
        }

        // Check if OTP was already verified (preferred flow)
        // Check both order.deliveryOTP.verifiedAt and delivery.otpVerified for compatibility
        const DeliveryModel = require('../models/delivery');
        const deliveryRecord = await DeliveryModel.findOne({ order: order._id });
        const isOtpPreVerified = order.deliveryOTP.verifiedAt || (deliveryRecord && deliveryRecord.otpVerified);

        if (isOtpPreVerified) {
            console.log('✅ OTP was already verified (order.verifiedAt:', order.deliveryOTP.verifiedAt, ', delivery.otpVerified:', deliveryRecord?.otpVerified, ')');
        } else {
            console.log('⚠️ OTP not pre-verified, verifying code now...');
            if (order.deliveryOTP.code !== otp) {
                console.error('❌ Invalid OTP code');
                return res.status(400).json({
                    success: false,
                    message: 'Invalid OTP. Please check the OTP provided by the customer and try again.'
                });
            }
            console.log('✅ OTP code verified successfully');
        }

        // Upload image to Cloudinary (handled by multer middleware)
        console.log('📦 File details:', {
            fieldname: req.file?.fieldname,
            originalname: req.file?.originalname,
            mimetype: req.file?.mimetype,
            path: req.file?.path,
            secure_url: req.file?.secure_url,
            cloudinary_id: req.file?.cloudinary_id,
            size: req.file?.size
        });

        if (!req.file || (!req.file.path && !req.file.secure_url && !req.file.cloudinary_id)) {
            console.error('❌ Cloudinary upload failed - no file path:', req.file);
            return res.status(400).json({
                success: false,
                message: 'Failed to upload delivery proof image. Please check your internet connection and try again.'
            });
        }

        const imageUrl = req.file.path || req.file.secure_url;
        console.log('✅ Delivery proof image uploaded:', imageUrl);

        // Update order with delivery proof and mark as delivered
        order.deliveryProof = {
            image: imageUrl,
            uploadedAt: new Date()
        };

        order.deliveryOTP.verifiedAt = new Date();
        
        // Update order status and set delivery agent
        const updateData = {
            status: 'delivered',
            tracking: {
                ...order.tracking,
                deliveredAt: new Date()
            },
            deliveryProof: order.deliveryProof,
            deliveryOTP: order.deliveryOTP
        };
        
        // Set deliveryAgent if not already set
        if (!order.deliveryAgent) {
            const Delivery = require('../models/delivery');
            const delivery = await Delivery.findOne({ order: order._id });
            if (delivery && delivery.assignedTo) {
                updateData.deliveryAgent = delivery.assignedTo;
                console.log('✅ Setting deliveryAgent:', delivery.assignedTo);
            }
        }
        
        await Order.findByIdAndUpdate(order._id, updateData);
        console.log('✅ Order updated to delivered:', order._id);

        // Update delivery record if exists
        const delivery = await Delivery.findOne({ order: order._id });
        if (delivery) {
            delivery.status = 'delivered';
            delivery.actualDelivery = new Date();
            delivery.otpVerified = true;
            delivery.attempts.push({
                attemptNumber: delivery.attempts.length + 1,
                timestamp: new Date(),
                status: 'success',
                notes: 'Delivered with proof image and OTP verification',
                proof: {
                    photo: imageUrl,
                    otp: 'verified'
                }
            });
            await delivery.save();
            console.log('✅ Delivery record updated to delivered:', delivery._id);
            
            // Update agent's stats
            const DeliveryAgent = require('../models/deliveryAgent');
            const agent = await DeliveryAgent.findById(delivery.assignedTo);
            
            if (agent) {
                // Update delivery stats
                agent.stats.successfulDeliveries += 1;
                agent.stats.totalDeliveries += 1;
                agent.currentDeliveries = Math.max(0, agent.currentDeliveries - 1);
                
                // Set agent to idle if no more deliveries
                if (agent.currentDeliveries === 0) {
                    agent.currentStatus = 'idle';
                }
                
                await agent.save();
                console.log('✅ Agent stats updated:', agent.name, '- Successful:', agent.stats.successfulDeliveries, 'Current:', agent.currentDeliveries);
                
                // Update agent's COD tracking if COD order
                if (order.payment.method === 'cod' && order.pricing.total > 0) {
                    // Update COD tracking
                    agent.codTracking.totalCollected += order.pricing.total;
                    agent.codTracking.pendingToPay += order.pricing.total;

                    // Add transaction record
                    agent.codTransactions.push({
                        type: 'collected',
                        amount: order.pricing.total,
                        orderId: order._id,
                        orderTrackingId: order.tracking.orderId,
                        notes: `COD collected for order ${order.tracking.orderId}`
                    });

                    await agent.save();
                    console.log(`💰 COD tracked: ₹${order.pricing.total} for agent ${agent.name}`);
                }
            }
        } else {
            console.warn('⚠️ No delivery record found for order:', order._id);
        }

        // Send notification to customer
        try {
            await sendOrderStatusUpdate(order, 'delivered');
            await sendOrderStatusSMS(order, 'delivered');
        } catch (notifError) {
            console.error('Notification error:', notifError);
        }

        res.json({
            success: true,
            message: 'Delivery completed successfully',
            data: order
        });
    } catch (error) {
        console.error('❌ Complete delivery error:', error);
        console.error('Error stack:', error.stack);
        console.error('Request details:', {
            orderId: req.params.orderId,
            hasFile: !!req.file,
            hasOTP: !!req.body.otp,
            fileDetails: req.file ? {
                fieldname: req.file.fieldname,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                path: req.file.path,
                secure_url: req.file.secure_url
            } : null
        });
        res.status(500).json({
            success: false,
            message: 'Error completing delivery: ' + (error.message || 'Unknown error')
        });
    }
};

// @desc    Get OTP for delivery (display to agent)
// @route   GET /api/delivery/:orderId/otp
// @access  Private (Delivery Agent)
const getDeliveryOTP = async (req, res) => {
    try {
        // Validate order ID
        if (!mongoose.Types.ObjectId.isValid(req.params.orderId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (!order.deliveryOTP || !order.deliveryOTP.code) {
            return res.status(404).json({
                success: false,
                message: 'No OTP generated for this order'
            });
        }

        // Check if OTP is expired
        if (new Date() > new Date(order.deliveryOTP.expiresAt)) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        res.json({
            success: true,
            data: {
                otp: order.deliveryOTP.code,
                expiresAt: order.deliveryOTP.expiresAt,
                verified: !!order.deliveryOTP.verifiedAt
            }
        });
    } catch (error) {
        console.error('Get OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching delivery OTP'
        });
    }
};

module.exports = {
    getDeliveryDetails,
    generateDeliveryOTP,
    verifyDeliveryOTP,
    completeDelivery,
    getDeliveryOTP
};
