const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        image: {
            type: String,
            required: true,
        },

        price: {
            type: Number,
            required: true,
        },

        oldPrice: {
            type: Number,
            default: null,
        },

        stock: {
            type: Number,
            required: true,
            default: 0,
        },
        category: {
            type: String,
            enum: ["ayurvedic", "sashtri", "herbal-cosmetics", "fmcg"],
        },
        description: {
            type: String,
            default: ''
        },
        // Rating fields
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        numReviews: {
            type: Number,
            default: 0
        },
        ratingsBreakdown: {
            5: { type: Number, default: 0 },
            4: { type: Number, default: 0 },
            3: { type: Number, default: 0 },
            2: { type: Number, default: 0 },
            1: { type: Number, default: 0 }
        }
    },
    { timestamps: true }
);

// Update rating stats after save
productSchema.methods.updateRatingStats = async function() {
    const Review = mongoose.model('Review');
    const stats = await Review.getAverageRating(this._id);
    
    if (stats.length > 0) {
        this.averageRating = Math.round(stats[0].averageRating * 10) / 10;
        this.numReviews = stats[0].count;
        
        // Get breakdown
        const breakdown = await Review.aggregate([
            { $match: { product: this._id } },
            { $group: { _id: '$rating', count: { $sum: 1 } } }
        ]);
        
        // Reset breakdown
        this.ratingsBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        breakdown.forEach(b => {
            this.ratingsBreakdown[b._id] = b.count;
        });
        
        await this.save();
    }
};

module.exports = mongoose.model("Product", productSchema);