const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['home', 'work', 'other'],
        default: 'home'
    },
    label: {
        type: String,
        default: 'Home',
        maxlength: 50
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 15
    },
    fullAddress: {
        type: String,
        required: true,
        maxlength: 500
    },
    landmark: {
        type: String,
        maxlength: 100
    },
    city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    pincode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10,
        match: [/^[0-9]{6}$/, 'Please enter a valid 6-digit pincode']
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries
addressSchema.index({ user: 1, isDefault: -1 });

// Ensure only one default address per user
addressSchema.pre('save', async function(next) {
    if (this.isDefault) {
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { isDefault: false }
        );
    }
    next();
});

module.exports = mongoose.model('Address', addressSchema);
