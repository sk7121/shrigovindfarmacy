const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const deliveryAgentSchema = new mongoose.Schema({
    // Personal information
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true,
        match: [/^[6-9][0-9]{9}$/, "Please enter a valid Indian mobile number"]
    },

    // Profile image
    profileImage: {
        type: String,
        default: null
    },

    // Authentication
    password: {
        type: String,
        required: true,
        select: false
    },

    // Employee details
    employeeId: {
        type: String,
        unique: true,
        sparse: true
    },

    // Vehicle information
    vehicleType: {
        type: String,
        enum: ['bike', 'scooter', 'cycle', 'van', 'truck', 'car'],
        default: 'bike'
    },
    vehicleNumber: {
        type: String,
        trim: true,
        uppercase: true
    },
    vehicleRC: String, // Registration certificate image URL
    vehicleInsurance: String, // Insurance document URL

    // Address and coverage area
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String
    },
    coverageAreas: [{
        city: String,
        pincode: String,
        zones: [String]
    }],

    // Documents
    aadharNumber: String,
    aadharImage: String,
    panNumber: String,
    panImage: String,
    drivingLicense: String,
    drivingLicenseExpiry: Date,
    policeVerification: {
        status: {
            type: String,
            enum: ['pending', 'verified', 'failed'],
            default: 'pending'
        },
        verifiedAt: Date,
        verifiedBy: String
    },

    // Employment details
    employmentType: {
        type: String,
        enum: ['full_time', 'part_time', 'contract', 'freelance'],
        default: 'full_time'
    },
    joiningDate: {
        type: Date,
        default: Date.now
    },

    // Status and availability
    isActive: {
        type: Boolean,
        default: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    currentStatus: {
        type: String,
        enum: ['idle', 'on_delivery', 'on_break', 'offline'],
        default: 'idle'
    },

    // Current location (updated via agent app)
    currentLocation: {
        latitude: Number,
        longitude: Number,
        lastUpdated: Date,
        address: String
    },

    // Performance metrics
    stats: {
        totalDeliveries: {
            type: Number,
            default: 0
        },
        successfulDeliveries: {
            type: Number,
            default: 0
        },
        failedDeliveries: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        totalEarnings: {
            type: Number,
            default: 0
        },
        onTimeDeliveryRate: {
            type: Number,
            default: 100
        }
    },

    // Current workload
    currentDeliveries: {
        type: Number,
        default: 0
    },
    maxConcurrentDeliveries: {
        type: Number,
        default: 10
    },
    assignedOrders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }],

    // COD (Cash on Delivery) tracking
    codTracking: {
        totalCollected: {
            type: Number,
            default: 0
        },
        pendingToPay: {
            type: Number,
            default: 0
        },
        paidToAdmin: {
            type: Number,
            default: 0
        }
    },
    
    // COD transaction history
    codTransactions: [{
        type: {
            type: String,
            enum: ['collected', 'paid_to_admin']
        },
        amount: Number,
        orderId: mongoose.Schema.Types.ObjectId,
        orderTrackingId: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        notes: String
    }],

    // Ratings and reviews
    ratings: [{
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        orderId: mongoose.Schema.Types.ObjectId,
        submittedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Bank details for payment
    bankDetails: {
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        bankName: String,
        branchName: String,
        upiId: String
    },

    // Emergency contact
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },

    // Device info for app
    deviceId: String,
    appVersion: String,

    // Token for authentication
    refreshToken: String,

    // Email verification
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerifiedAt: {
        type: Date
    },

    // Notes
    notes: String,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date
}, {
    timestamps: true
});

// Hash password before saving
deliveryAgentSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        throw error;
    }
});

// Compare password method
deliveryAgentSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Generate employee ID
deliveryAgentSchema.pre('save', async function () {
    if (!this.employeeId && this.isNew) {
        const count = await mongoose.model('DeliveryAgent').countDocuments();
        const year = new Date().getFullYear().toString().substr(-2);
        this.employeeId = `DA${year}${String(count + 1).padStart(4, '0')}`;
    }
});

// Update stats after delivery completion
deliveryAgentSchema.methods.updateStats = async function () {
    const Delivery = mongoose.model('Delivery');

    const deliveries = await Delivery.find({ assignedTo: this._id });
    const total = deliveries.length;
    const successful = deliveries.filter(d => d.status === 'delivered').length;
    const failed = deliveries.filter(d => ['returned', 'cancelled'].includes(d.status)).length;

    this.stats.totalDeliveries = total;
    this.stats.successfulDeliveries = successful;
    this.stats.failedDeliveries = failed;
    this.stats.currentDeliveries = deliveries.filter(d =>
        ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(d.status)
    ).length;

    // Calculate average rating
    if (this.ratings.length > 0) {
        const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
        this.stats.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
    }

    // Calculate on-time delivery rate
    const onTimeDeliveries = deliveries.filter(d => {
        if (d.status !== 'delivered' || !d.estimatedDelivery || !d.actualDelivery) return false;
        return d.actualDelivery <= d.estimatedDelivery;
    }).length;

    this.stats.onTimeDeliveryRate = total > 0 ? Math.round((onTimeDeliveries / total) * 100) : 100;

    return this.save();
};

// Add rating
deliveryAgentSchema.methods.addRating = function (rating, comment = '', orderId = null) {
    this.ratings.push({
        rating,
        comment,
        orderId,
        submittedAt: new Date()
    });
    return this.updateStats();
};

// Check if agent can accept more deliveries
deliveryAgentSchema.methods.canAcceptDelivery = function () {
    return this.isActive &&
        this.isAvailable &&
        this.currentDeliveries < this.maxConcurrentDeliveries;
};

// Update current location
deliveryAgentSchema.methods.updateLocation = function (latitude, longitude, address = '') {
    this.currentLocation = {
        latitude,
        longitude,
        lastUpdated: new Date(),
        address
    };
    return this.save();
};

// Index for queries (employeeId index already created by unique: true)
deliveryAgentSchema.index({ isActive: 1, isAvailable: 1 });
deliveryAgentSchema.index({ 'coverageAreas.pincode': 1 });
deliveryAgentSchema.index({ currentStatus: 1 });

module.exports = mongoose.model('DeliveryAgent', deliveryAgentSchema);
