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
        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if order is out for delivery or assigned
        if (!['out_for_delivery', 'assigned', 'processing'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: 'Order is not ready for delivery'
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

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Delivery proof image is required'
            });
        }

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP verification is required'
            });
        }

        const order = await Order.findById(req.params.orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Verify OTP first
        if (!order.deliveryOTP || !order.deliveryOTP.code || order.deliveryOTP.code !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or unverified OTP'
            });
        }

        if (new Date() > new Date(order.deliveryOTP.expiresAt)) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Upload image to Cloudinary (handled by multer middleware)
        const imageUrl = req.file.path || req.file.secure_url;

        // Update order with delivery proof and mark as delivered
        order.deliveryProof = {
            image: imageUrl,
            uploadedAt: new Date()
        };

        order.deliveryOTP.verifiedAt = new Date();
        order.status = 'delivered';
        order.tracking.deliveredAt = new Date();

        // Add status history entry
        if (!order.status) {
            order.status = {
                current: 'delivered',
                history: []
            };
        } else if (typeof order.status === 'string') {
            order.status = {
                current: 'delivered',
                history: [{
                    status: order.status,
                    timestamp: new Date()
                }]
            };
        } else {
            order.status.current = 'delivered';
        }

        if (order.status.history) {
            order.status.history.push({
                status: 'delivered',
                timestamp: new Date(),
                note: 'Delivered with proof image and OTP verification'
            });
        }

        await order.save();

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
        console.error('Complete delivery error:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing delivery'
        });
    }
};

// @desc    Get OTP for delivery (display to agent)
// @route   GET /api/delivery/:orderId/otp
// @access  Private (Delivery Agent)
const getDeliveryOTP = async (req, res) => {
    try {
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
