const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: false // Made optional for OAuth users
    },
    phone: {
        type: String,
        required: false, // Made optional for OAuth users
        trim: true,
        match: [/^[6-9][0-9]{9}$/, "Please enter a valid Indian mobile number"]
    },

    role: {
        type: String,
        enum: ['user', 'distributor', 'admin'],
        default: 'user'
    },
    address: {
        type: String,
        required: false // Made optional for OAuth users
    },

    // Google OAuth fields
    google: {
        googleId: String,
        avatar: String
    },

    // Email verification fields
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerifiedAt: {
        type: Date
    },

    // Password reset fields
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    },

    refreshTokens: [
        {
            token: String,
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]

}, {
    timestamps: true
});

// Index for Google ID (unique and sparse to allow null values)
userSchema.index({ 'google.googleId': 1 }, { unique: true, sparse: true });

// Note: unique: true on email field already creates an index
// No need for additional index declaration

module.exports = mongoose.model('User', userSchema);