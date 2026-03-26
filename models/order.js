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
        enum: ['pending', 'confirmed', 'processing', 'assigned', 'shipped', 'out_for_delivery', 'picked_up', 'delivered', 'cancelled', 'refunded'],
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
    deliveryCode: {
        code: String,
        generatedAt: Date,
        expiresAt: Date
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
orderSchema.methods.updateStatus = async function (newStatus, reason = '') {
    console.log('\n========== ORDER STATUS UPDATE ==========');
    console.log('Order ID:', this._id);
    console.log('Old Status:', this.status);
    console.log('New Status:', newStatus);
    console.log('Current OTP Code:', this.deliveryOTP?.code || 'NONE');
    console.log('Current OTP verifiedAt:', this.deliveryOTP?.verifiedAt || 'NOT SET');
    console.log('=========================================\n');

    this.status = newStatus;

    if (newStatus === 'delivered') {
        // Validate that delivery proof image and OTP are provided
        if (!this.deliveryProof || !this.deliveryProof.image) {
            throw new Error('Delivery proof image is mandatory for marking order as delivered');
        }
        if (!this.deliveryOTP || !this.deliveryOTP.code || !this.deliveryOTP.verifiedAt) {
            throw new Error('OTP verification is mandatory for marking order as delivered');
        }
        this.tracking.deliveredAt = new Date();
    } else if (newStatus === 'picked_up') {
        // Order picked up from store/warehouse
        this.tracking.shippedAt = new Date();
        // Set estimated delivery to 3 days from now
        this.tracking.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

        console.log('\n========== PICKED_UP: CHECKING OTP ==========');
        console.log('Has existing OTP?', !!this.deliveryOTP?.code);
        console.log('Existing OTP Code:', this.deliveryOTP?.code);
        console.log('=============================================\n');

        // Generate OTP when order is picked up (only if not already generated)
        if (!this.deliveryOTP || !this.deliveryOTP.code) {
            console.log('\n========== GENERATING NEW OTP ==========');
            const OTP = require('./otp');
            const otpCode = OTP.generateOTP(6);
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            console.log('Generated OTP Code:', otpCode);
            console.log('Expires At:', expiresAt);
            console.log('========================================\n');

            // Use MongoDB update to explicitly set new OTP and unset verifiedAt
            const OrderModel = mongoose.model('Order');
            const updateResult = await OrderModel.findByIdAndUpdate(this._id, {
                $set: {
                    'deliveryOTP.code': otpCode,
                    'deliveryOTP.expiresAt': expiresAt,
                    'deliveryOTP.generatedAt': new Date()
                },
                $unset: {
                    'deliveryOTP.verifiedAt': 1  // Remove any existing verifiedAt
                }
            });

            console.log('\n========== OTP UPDATE RESULT ==========');
            console.log('Update Result:', updateResult);
            console.log('=======================================\n');

            // Send OTP to customer via SMS
            const { sendOrderStatusSMS } = require('../services/smsService');
            if (this.address && this.address.phone) {
                console.log('\n========== SENDING OTP SMS ==========');
                console.log('Customer Phone:', this.address.phone);
                console.log('OTP Code:', otpCode);
                sendOrderStatusSMS(this, this.address.phone, 'picked_up', otpCode)
                    .then(() => console.log('✅ OTP SMS sent successfully'))
                    .catch(err => console.error('⚠️ Failed to send OTP SMS:', err));
                console.log('=====================================\n');
            }
        } else {
            console.log('\n========== OTP ALREADY EXISTS ==========');
            console.log('Skipping OTP generation - OTP already exists');
            console.log('========================================\n');
        }
    } else if (newStatus === 'shipped') {
        this.tracking.shippedAt = new Date();
        // Set estimated delivery to 3 days from now
        this.tracking.estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else if (newStatus === 'cancelled') {
        this.tracking.cancelledAt = new Date();
        this.tracking.cancellationReason = reason;
    }

    const savedOrder = await this.save();
    
    console.log('\n========== ORDER SAVED ==========');
    console.log('Final Status:', savedOrder.status);
    console.log('Final OTP Code:', savedOrder.deliveryOTP?.code || 'NONE');
    console.log('Final OTP verifiedAt:', savedOrder.deliveryOTP?.verifiedAt || 'NOT SET');
    console.log('=================================\n');

    return savedOrder;
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

// Method to generate unique delivery code
orderSchema.methods.generateDeliveryCode = function () {
    const date = new Date();
    const timestamp = date.getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const deliveryCode = `DLV${timestamp}${random}`;
    
    this.deliveryCode = {
        code: deliveryCode,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    return this.save();
};

module.exports = mongoose.model('Order', orderSchema);
