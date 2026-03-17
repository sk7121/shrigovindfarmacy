const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    prescriptionNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    // Prescription images/files
    images: [{
        url: String,
        publicId: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    // Doctor details
    doctorName: {
        type: String,
        trim: true
    },
    doctorRegistrationNumber: {
        type: String,
        trim: true
    },
    clinicName: {
        type: String,
        trim: true
    },
    clinicAddress: {
        type: String,
        trim: true
    },
    // Prescription date
    prescriptionDate: {
        type: Date,
        required: true
    },
    // Status
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected', 'expired'],
        default: 'pending'
    },
    // Admin verification
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: {
        type: String,
        trim: true
    },
    // Validity
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: {
        type: Date
    },
    // Medicines listed in prescription
    medicines: [{
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
        notes: String
    }],
    // Notes from user
    notes: {
        type: String,
        trim: true
    },
    // Auto-refill settings
    autoRefill: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly'],
            default: 'monthly'
        },
        nextRefillDate: Date
    },
    // Associated orders
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
prescriptionSchema.index({ user: 1, status: 1 });
prescriptionSchema.index({ status: 1, createdAt: -1 });

// Generate prescription number
prescriptionSchema.statics.generatePrescriptionNumber = async function() {
    const prefix = 'RX';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
};

// Pre-save hook to generate prescription number
// Note: Don't use async with next() callback - use one or the other
prescriptionSchema.pre('save', async function() {
    if (!this.prescriptionNumber) {
        this.prescriptionNumber = await this.constructor.generatePrescriptionNumber();
    }
    // No next() call needed with async functions
});

// Check if prescription is still valid
prescriptionSchema.methods.isValid = function() {
    if (this.status !== 'verified') return false;
    if (this.validUntil && new Date() > this.validUntil) return false;
    return true;
};

// Verify prescription
prescriptionSchema.methods.verify = async function(adminId, validDays = 365) {
    this.status = 'verified';
    this.verifiedBy = adminId;
    this.verifiedAt = new Date();
    this.validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
    await this.save();
};

// Reject prescription
prescriptionSchema.methods.reject = async function(reason) {
    this.status = 'rejected';
    this.rejectionReason = reason;
    await this.save();
};

module.exports = mongoose.model('Prescription', prescriptionSchema);
