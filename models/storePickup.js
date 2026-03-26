const mongoose = require('mongoose');
const crypto = require('crypto');

const storePickupSchema = new mongoose.Schema({
    // Reference to order
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        unique: true
    },

    // Store information
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Store staff/admin who handles pickup
    },
    storeName: {
        type: String,
        default: 'Shri Govind Pharmacy - Main Store'
    },

    // Pickup verification code (last 4 digits of order ID)
    verificationCode: {
        type: String,
        select: false // Don't return in queries by default
    },

    // OTP metadata
    codeGeneratedAt: Date,
    codeExpiresAt: Date,
    codeVerifiedAt: Date,
    verificationAttempts: {
        type: Number,
        default: 0
    },

    // Pickup status
    status: {
        type: String,
        enum: [
            'pending_pickup',      // Order ready, waiting for customer
            'otp_generated',       // OTP sent to customer
            'picked_up',           // Customer has picked up order
            'cancelled',           // Pickup cancelled
            'expired'              // OTP expired without pickup
        ],
        default: 'pending_pickup'
    },

    // Pickup details
    pickedUpBy: {
        name: String,
        phone: String,
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User' // Staff who verified
        },
        verifiedAt: Date
    },

    // Timeline
    timeline: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        notes: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],

    // Expiry
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }

}, {
    timestamps: true
});

// Generate verification code (last 4 digits of order ID)
function generateVerificationCode(orderId) {
    // Extract last 4 characters from order ID
    const last4 = orderId.toString().slice(-4);
    return last4.toUpperCase();
}

// Generate verification code before saving if status is otp_generated
storePickupSchema.pre('save', async function() {
    if (this.isModified('status') && this.status === 'otp_generated' && !this.verificationCode) {
        this.verificationCode = generateVerificationCode(this.order);
        this.codeGeneratedAt = new Date();
        this.codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        console.log(`Generated verification code for order ${this.order}: ${this.verificationCode}`);
    }
});

// Add timeline entry
storePickupSchema.methods.addTimelineEntry = function(status, notes = '', performedBy = null) {
    this.timeline.push({
        status,
        timestamp: new Date(),
        notes,
        performedBy
    });
    return this.save();
};

// Generate and send verification code
storePickupSchema.methods.generateVerificationCode = async function() {
    this.verificationCode = generateVerificationCode(this.order);
    this.codeGeneratedAt = new Date();
    this.codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.status = 'otp_generated';
    
    await this.addTimelineEntry('otp_generated', 'Verification code generated', null);
    
    return this.verificationCode;
};

// Verify code
storePickupSchema.methods.verifyCode = function(code, verifiedBy = null) {
    // Check if code is expired
    if (this.codeExpiresAt && new Date() > this.codeExpiresAt) {
        return {
            success: false,
            message: 'Verification code has expired. Please generate a new one.'
        };
    }

    // Check attempts (max 5)
    if (this.verificationAttempts >= 5) {
        return {
            success: false,
            message: 'Maximum attempts exceeded. Please contact support.'
        };
    }

    // Increment attempts
    this.verificationAttempts += 1;

    // Verify code (case insensitive)
    if (this.verificationCode && this.verificationCode.toUpperCase() === code.toUpperCase()) {
        this.codeVerifiedAt = new Date();
        this.status = 'picked_up';
        this.pickedUpBy = {
            verifiedBy,
            verifiedAt: new Date()
        };
        
        this.addTimelineEntry('picked_up', 'Verification code matched successfully', verifiedBy);
        
        return {
            success: true,
            message: 'Verification code verified successfully'
        };
    } else {
        return {
            success: false,
            message: `Invalid code. ${5 - this.verificationAttempts} attempts remaining.`
        };
    }
};

// Mark as picked up by staff (without OTP - for special cases)
storePickupSchema.methods.markAsPickedUp = function(staffName, staffPhone, verifiedBy = null) {
    this.status = 'picked_up';
    this.pickedUpBy = {
        name: staffName,
        phone: staffPhone,
        verifiedBy,
        verifiedAt: new Date()
    };
    
    this.addTimelineEntry('picked_up', `Manual pickup by ${staffName}`, verifiedBy);
    
    return this.save();
};

// Cancel pickup
storePickupSchema.methods.cancelPickup = function(reason = '') {
    this.status = 'cancelled';
    this.addTimelineEntry('cancelled', reason);
    return this.save();
};

// Expire pickup
storePickupSchema.methods.expirePickup = function() {
    this.status = 'expired';
    this.addTimelineEntry('expired', 'Pickup expired due to timeout');
    return this.save();
};

// Static: Get pending pickups
storePickupSchema.statics.getPendingPickups = function() {
    return this.find({ status: { $in: ['pending_pickup', 'otp_generated'] } })
        .populate('order')
        .populate('store')
        .sort({ createdAt: -1 });
};

// Static: Get today's pickups
storePickupSchema.statics.getTodaysPickups = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.find({
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $in: ['pending_pickup', 'otp_generated', 'picked_up'] }
    })
        .populate('order')
        .populate('store')
        .sort({ createdAt: -1 });
};

// Static: Get pickups by status
storePickupSchema.statics.getByStatus = function(status) {
    return this.find({ status })
        .populate('order')
        .populate('store')
        .sort({ createdAt: -1 });
};

// Index for faster queries (order index already created by unique: true)
storePickupSchema.index({ status: 1, createdAt: -1 });
storePickupSchema.index({ otpExpiresAt: 1 });

module.exports = mongoose.model('StorePickup', storePickupSchema);
