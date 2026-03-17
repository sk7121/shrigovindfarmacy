const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    reason: {
        type: String,
        required: true,
        enum: [
            'defective',
            'wrong_item',
            'damaged',
            'not_as_described',
            'expired',
            'no_longer_needed',
            'other'
        ]
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'picked_up', 'refunded', 'cancelled'],
        default: 'pending'
    },
    refundMethod: {
        type: String,
        enum: ['original_payment', 'wallet', 'bank_transfer'],
        default: 'original_payment'
    },
    refundAmount: {
        type: Number,
        required: true
    },
    pickupAddress: {
        fullAddress: String,
        city: String,
        state: String,
        pincode: String,
        phone: String
    },
    images: [String],
    adminNotes: String,
    pickedUpAt: Date,
    refundedAt: Date,
    trackingId: String
}, {
    timestamps: true
});

// Index for faster queries
returnSchema.index({ order: 1, user: 1 });
returnSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Return', returnSchema);
