const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    verified: {
        type: Boolean,
        default: true
    },
    helpful: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    images: [String],
    adminReply: {
        comment: String,
        repliedAt: Date,
        repliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Prevent duplicate reviews
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Static method to get average rating for a product
reviewSchema.statics.getAverageRating = function(productId) {
    return this.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: '$product', averageRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
};

// Static method to get reviews by product
reviewSchema.statics.getReviewsByProduct = function(productId, limit = 10) {
    return this.find({ product: productId })
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Method to mark review as helpful
reviewSchema.methods.markHelpful = function(userId) {
    if (!this.helpful.includes(userId)) {
        this.helpful.push(userId);
        return this.save();
    }
    return this;
};

// Method to add admin reply
reviewSchema.methods.addAdminReply = function(comment, adminId) {
    this.adminReply = {
        comment,
        repliedAt: new Date(),
        repliedBy: adminId
    };
    return this.save();
};

module.exports = mongoose.model('Review', reviewSchema);
