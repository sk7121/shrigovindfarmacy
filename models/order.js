const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: String,
        image: String,
        price: Number,
        quantity: Number,
        subtotal: Number
    }],
    address: {
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        landmark: String
    },
    payment: {
        method: {
            type: String,
            enum: ['cod', 'upi', 'card', 'netbanking', 'razorpay', 'phonepe', 'googlepay'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed'],
            default: 'pending'
        },
        transactionId: String,
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String
    },
    pricing: {
        subtotal: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        delivery: { type: Number, default: 0 },
        gst: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'assigned', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },
    tracking: {
        type: {
            orderId: String,
            estimatedDelivery: Date,
            shippedAt: Date,
            deliveredAt: Date,
            cancelledAt: Date,
            cancellationReason: String
        },
        default: {}
    },
    coupon: {
        code: String,
        discount: Number
    },
    deliveryAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryAgent'
    },
    deliveryOTP: {
        code: String,
        expiresAt: Date,
        generatedAt: Date,
        verifiedAt: Date
    },
    deliveryProof: {
        image: String,
        uploadedAt: Date
    }
}, {
    timestamps: true
});

// Generate unique order ID
orderSchema.pre('save', async function () {
    if (!this.tracking) {
        this.tracking = {};
    }

    if (!this.tracking.orderId) {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.random().toString(36).substr(2, 6).toUpperCase();

        this.tracking.orderId = `ORD${year}${month}${day}${random}`;
    }
});

// Static method to get orders by status
orderSchema.statics.getOrdersByStatus = function (status) {
    return this.find({ status }).populate('user', 'name email phone').populate('items.product');
};

// Method to update order status
orderSchema.methods.updateStatus = function (newStatus, reason = '') {
    this.status = newStatus;

    if (newStatus === 'delivered') {
        this.tracking.deliveredAt = new Date();
    } else if (newStatus === 'shipped') {
        this.tracking.shippedAt = new Date();
        // Set estimated delivery to 3 days from now
        this.tracking.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else if (newStatus === 'cancelled') {
        this.tracking.cancelledAt = new Date();
        this.tracking.cancellationReason = reason;
    }

    return this.save();
};

// Method to calculate totals
orderSchema.methods.calculateTotals = function () {
    let subtotal = 0;
    this.items.forEach(item => {
        item.subtotal = item.price * item.quantity;
        subtotal += item.subtotal;
    });

    this.pricing.subtotal = subtotal;
    this.pricing.gst = subtotal * 0.05; // 5% GST
    this.pricing.total = subtotal + this.pricing.gst - this.pricing.discount + this.pricing.delivery;
};

module.exports = mongoose.model('Order', orderSchema);
