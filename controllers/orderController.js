const Order = require('../models/order');
const Cart = require('../models/cart');
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../services/emailService');
const { sendOrderConfirmationSMS, sendOrderStatusSMS } = require('../services/smsService');

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .populate('items.product');

        res.json({
            success: true,
            data: orders
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching orders'
        });
    }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('user', 'name email phone')
            .populate('items.product');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if user owns this order
        if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this order'
            });
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order'
        });
    }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
    try {
        const { items, paymentMethod, shippingAddress, couponCode } = req.body;

        // Get cart and clear it
        const cart = await Cart.findOne({ user: req.user._id });
        if (cart) {
            cart.items = [];
            await cart.save();
        }

        const order = await Order.create({
            user: req.user._id,
            items,
            paymentMethod,
            shippingAddress,
            couponCode,
            pricing: {
                subtotal: req.body.pricing.subtotal,
                discount: req.body.pricing.discount || 0,
                shipping: req.body.pricing.shipping || 0,
                tax: req.body.pricing.tax || 0,
                total: req.body.pricing.total
            }
        });

        // Send confirmation email and SMS
        try {
            await sendOrderConfirmation(order);
            await sendOrderConfirmationSMS(order);
        } catch (notifError) {
            console.error('Notification error:', notifError);
            // Don't fail order creation if notification fails
        }

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating order'
        });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const { status, trackingId, deliveredAt } = req.body;

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    'status.current': status,
                    'tracking.trackingId': trackingId,
                    deliveredAt
                },
                $push: {
                    'status.history': {
                        status,
                        timestamp: new Date(),
                        note: req.body.note || ''
                    }
                }
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Send status update notification
        try {
            await sendOrderStatusUpdate(order, status);
            await sendOrderStatusSMS(order, status);
        } catch (notifError) {
            console.error('Notification error:', notifError);
        }

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating order status'
        });
    }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Check if user owns this order
        if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this order'
            });
        }

        // Check if order can be cancelled
        if (order.status.current === 'delivered' || order.status.current === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled'
            });
        }

        order.status.current = 'cancelled';
        order.status.history.push({
            status: 'cancelled',
            timestamp: new Date(),
            note: req.body.reason || 'Cancelled by user'
        });

        await order.save();

        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling order'
        });
    }
};

module.exports = {
    getOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
    cancelOrder
};
