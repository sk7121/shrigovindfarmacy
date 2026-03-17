const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false  // Made optional - order created after payment
    },
    razorpay: {
        orderId: {
            type: String,
            required: true
        },
        paymentId: String,
        signature: String,
        status: {
            type: String,
            enum: ['created', 'paid', 'failed', 'refunded'],
            default: 'created'
        }
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'netbanking', 'upi', 'wallet']
    },
    razorpayResponse: {
        entity: String,
        amount: Number,
        currency: String,
        status: String,
        method: String,
        bank: String,
        wallet: String,
        vpa: String,
        card: {
            last4: String,
            network: String,
            type: String
        }
    },
    errorMessage: String,
    refundedAt: Date,
    refundId: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
