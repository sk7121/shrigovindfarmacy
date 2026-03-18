const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['email_verification', 'password_reset', 'phone_verification', 'delivery_otp'],
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // Auto-delete after expiration
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 3
    }
}, {
    timestamps: true
});

// Index for faster lookups
otpSchema.index({ email: 1, purpose: 1, expiresAt: -1 });

// Static method: Generate OTP
otpSchema.statics.generateOTP = function(length = 6) {
    const chars = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += chars[Math.floor(Math.random() * chars.length)];
    }
    return otp;
};

// Static method: Create OTP
otpSchema.statics.createOTP = async function(email, purpose, expiryMinutes = 10) {
    const OTP = this;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    
    // Delete any existing unused OTPs for this email and purpose
    await OTP.deleteMany({
        email: normalizedEmail,

        purpose,
        isUsed: false
    });
    
    // Generate new OTP
    const otp = OTP.generateOTP();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    
    // Create and save OTP
    const otpDoc = new OTP({
        email: normalizedEmail,
        otp,
        purpose,
        expiresAt,
        maxAttempts: 3
    });
    
    await otpDoc.save();
    
    return { otp, expiresAt };
};

// Static method: Verify OTP
otpSchema.statics.verifyOTP = async function(email, otp, purpose) {
    const OTP = this;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    
    // Find valid OTP
    const otpDoc = await OTP.findOne({
        email: normalizedEmail,
        otp,
        purpose,
        isUsed: false,
        expiresAt: { $gt: new Date() }
    });
    
    if (!otpDoc) {
        return {
            success: false,
            message: 'Invalid or expired OTP'
        };
    }
    
    // Check attempts
    if (otpDoc.attempts >= otpDoc.maxAttempts) {
        await OTP.deleteOne({ _id: otpDoc._id });
        return {
            success: false,
            message: 'Maximum attempts exceeded. Please request a new OTP.'
        };
    }
    
    // Mark as used
    otpDoc.isUsed = true;
    await otpDoc.save();
    
    return {
        success: true,
        message: 'OTP verified successfully'
    };
};

// Static method: Check OTP (without marking as used)
otpSchema.statics.checkOTP = async function(email, otp, purpose) {
    const OTP = this;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    
    // Find valid OTP
    const otpDoc = await OTP.findOne({
        email: normalizedEmail,
        otp,
        purpose,
        isUsed: false,
        expiresAt: { $gt: new Date() }
    });
    
    if (!otpDoc) {
        // Increment attempts for invalid OTP
        await OTP.findOneAndUpdate(
            {
                email: normalizedEmail,
                purpose,
                isUsed: false,
                expiresAt: { $gt: new Date() }
            },
            { $inc: { attempts: 1 } }
        );
        
        return {
            success: false,
            message: 'Invalid or expired OTP'
        };
    }
    
    return {
        success: true,
        message: 'OTP is valid'
    };
};

// Static method: Delete all OTPs for an email
otpSchema.statics.deleteOTP = async function(email, purpose) {
    await this.deleteMany({ email, purpose });
};

module.exports = mongoose.model('OTP', otpSchema);
