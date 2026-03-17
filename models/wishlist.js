const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Method to add product to wishlist
wishlistSchema.methods.addProduct = async function(productId) {
    const exists = this.items.find(item => item.product.toString() === productId);

    if (!exists) {
        this.items.push({ product: productId });
        await this.save();
    }

    return this;
};

// Method to remove product from wishlist
wishlistSchema.methods.removeProduct = function(productId) {
    this.items = this.items.filter(item => item.product.toString() !== productId);
    return this.save();
};

// Method to check if product is in wishlist
wishlistSchema.methods.isProductInWishlist = function(productId) {
    return this.items.some(item => item.product.toString() === productId);
};

module.exports = mongoose.model('Wishlist', wishlistSchema);
