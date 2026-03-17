const mongoose = require('mongoose');

const loyaltyPointSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    lifetimePoints: {
        type: Number,
        default: 0
    },
    tier: {
        type: String,
        enum: ['bronze', 'silver', 'gold', 'platinum'],
        default: 'bronze'
    },
    history: [{
        points: Number,
        type: {
            type: String,
            enum: ['earned', 'redeemed', 'expired', 'adjusted']
        },
        description: String,
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Calculate tier based on lifetime points
loyaltyPointSchema.methods.updateTier = function() {
    if (this.lifetimePoints >= 50000) {
        this.tier = 'platinum';
    } else if (this.lifetimePoints >= 20000) {
        this.tier = 'gold';
    } else if (this.lifetimePoints >= 5000) {
        this.tier = 'silver';
    } else {
        this.tier = 'bronze';
    }
    return this.save();
};

// Add points
loyaltyPointSchema.methods.addPoints = function(points, description, orderId = null) {
    this.points += points;
    this.lifetimePoints += points;
    this.history.push({
        points,
        type: 'earned',
        description,
        order: orderId
    });
    return this.updateTier();
};

// Redeem points
loyaltyPointSchema.methods.redeemPoints = function(points, description) {
    if (this.points < points) {
        throw new Error('Insufficient points');
    }
    this.points -= points;
    this.history.push({
        points: -points,
        type: 'redeemed',
        description
    });
    return this.save();
};

// Get tier benefits
loyaltyPointSchema.statics.getTierBenefits = function(tier) {
    const benefits = {
        bronze: { discount: 0, cashback: 1 },
        silver: { discount: 5, cashback: 2 },
        gold: { discount: 10, cashback: 3 },
        platinum: { discount: 15, cashback: 5 }
    };
    return benefits[tier] || benefits.bronze;
};

module.exports = mongoose.model('LoyaltyPoint', loyaltyPointSchema);
