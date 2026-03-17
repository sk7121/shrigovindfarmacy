
const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        priceAtTime: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: false }
);

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        items: {
            type: [cartItemSchema],
            default: []
        },

        totalAmount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { timestamps: true }
);


// 🔥 Prevent duplicate products in cart
cartSchema.methods.addItem = function (productId, quantity, price) {

    const existingItem = this.items.find(
        item => item.product.toString() === productId.toString()
    );

    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        this.items.push({
            product: productId,
            quantity: quantity,
            priceAtTime: price
        });
    }
};


// 🔥 Auto calculate total before saving
cartSchema.pre("save", function () {
    this.totalAmount = this.items.reduce(
        (total, item) => total + item.quantity * item.priceAtTime,
        0
    );
});

module.exports = mongoose.model("Cart", cartSchema);