const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 20
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    minOrderValue: {
        type: Number,
        default: 0
    },
    maxDiscount: {
        type: Number,
        default: null
    },
    usageLimit: {
        type: Number,
        default: null
    },
    usageCount: {
        type: Number,
        default: 0
    },
    perUserLimit: {
        type: Number,
        default: 1
    },
    usedBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],
    applicableCategories: [{
        type: String
    }],
    applicableProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Check if coupon is valid
couponSchema.methods.isValid = function() {
    const now = new Date();
    
    if (!this.isActive) return false;
    if (this.validFrom && now < this.validFrom) return false;
    if (this.validUntil && now > this.validUntil) return false;
    if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
    
    return true;
};

// Check if user can use this coupon
couponSchema.methods.canUserUse = function(userId) {
    const userUsage = this.usedBy.filter(u => u.user.toString() === userId.toString());
    return userUsage.length < this.perUserLimit;
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function(orderValue, categories = [], productIds = []) {
    if (!this.isValid()) return 0;

    // Check minimum order value
    if (orderValue < this.minOrderValue) return 0;

    // Check category applicability
    if (this.applicableCategories.length > 0 && categories.length > 0) {
        const hasApplicableCategory = categories.some(cat =>
            this.applicableCategories.includes(cat)
        );
        if (!hasApplicableCategory) return 0;
    }

    // Calculate discount
    let discount = 0;
    if (this.discountType === 'percentage') {
        discount = (orderValue * this.discountValue) / 100;
    } else {
        discount = this.discountValue;
    }

    // Apply max discount cap
    if (this.maxDiscount && discount > this.maxDiscount) {
        discount = this.maxDiscount;
    }

    // CRITICAL: Ensure discount never exceeds 95% of order value
    // This prevents the total from going negative
    const maxAllowedDiscount = orderValue * 0.95;
    if (discount > maxAllowedDiscount) {
        discount = maxAllowedDiscount;
    }

    // Ensure discount is never more than the order value itself
    if (discount >= orderValue) {
        discount = orderValue - 1; // Keep at least ₹1 to pay
    }

    return Math.floor(discount); // Round down to avoid decimal issues
};

// Mark coupon as used by user
couponSchema.methods.markAsUsed = function(userId) {
    this.usageCount += 1;
    this.usedBy.push({ user: userId });
    return this.save();
};

// Static method to find valid coupon by code
couponSchema.statics.findByCode = function(code) {
    return this.findOne({ code: code.toUpperCase() });
};

module.exports = mongoose.model('Coupon', couponSchema);
