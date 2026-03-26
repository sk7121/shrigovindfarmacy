const mongoose = require('mongoose');
const crypto = require('crypto');

const deliverySchema = new mongoose.Schema({
    // Reference to order
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    
    // QR Code for verification
    qrCode: {
        type: String,
        required: true,
        unique: true
    },
    qrCodeSecret: {
        type: String,
        required: true
    },
    
    // Delivery assignment
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryAgent'
    },
    assignedAt: Date,
    assignmentMethod: {
        type: String,
        enum: ['manual', 'auto'],
        default: 'manual'
    },

    // OTP for delivery verification
    deliveryOTP: {
        type: String,
        select: false // Don't return OTP in queries by default
    },
    otpVerified: {
        type: Boolean,
        default: false
    },
    
    // Shipping partner (if using external logistics)
    shippingPartner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ShippingPartner'
    },
    externalTrackingId: String,
    
    // Delivery status
    status: {
        type: String,
        enum: [
            'pending_assignment',      // Waiting for agent assignment
            'assigned',                // Agent assigned
            'picked_up',               // Picked up from warehouse
            'in_transit',              // On the way
            'out_for_delivery',        // Final delivery attempt
            'delivered',               // Successfully delivered
            'failed_attempt',          // Delivery attempt failed
            'rescheduled',             // Rescheduled for later
            'returned',                // Returned to warehouse
            'cancelled'                // Delivery cancelled
        ],
        default: 'pending_assignment'
    },
    
    // Delivery address (snapshot from order)
    deliveryAddress: {
        fullName: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        pincode: String,
        landmark: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    
    // Timeline tracking
    timeline: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        location: String,
        notes: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryAgent'
        }
    }],
    
    // Delivery attempts
    attempts: [{
        attemptNumber: Number,
        timestamp: Date,
        status: {
            type: String,
            enum: ['success', 'failed', 'customer_unavailable', 'address_not_found', 'refused']
        },
        reason: String,
        notes: String,
        agent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DeliveryAgent'
        },
        proof: {
            photo: String,        // Photo of delivery location
            signature: String,    // Customer signature (base64 or URL)
            otp: String           // OTP verification if used
        }
    }],
    
    // Estimated and actual times
    estimatedDelivery: Date,
    actualDelivery: Date,
    
    // Delivery priority
    priority: {
        type: String,
        enum: ['normal', 'express', 'same_day', 'scheduled'],
        default: 'normal'
    },
    
    // Scheduled delivery (if applicable)
    scheduledDate: Date,
    scheduledSlot: {
        type: String,
        enum: ['9am-12pm', '12pm-3pm', '3pm-6pm', '6pm-9pm', 'anytime']
    },
    
    // Delivery instructions
    instructions: String,
    
    // COD handling
    codAmount: {
        type: Number,
        default: 0
    },
    codCollected: {
        type: Boolean,
        default: false
    },
    codCollectedAt: Date,
    
    // Return details (if returned)
    returnReason: String,
    returnInitiatedAt: Date,
    returnCompletedAt: Date,
    
    // Customer feedback
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        submittedAt: Date
    }
}, {
    timestamps: true
});

// Generate unique QR code and secret before saving
deliverySchema.pre('save', async function() {
    if (!this.qrCode || !this.qrCodeSecret) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        this.qrCode = `DLV${timestamp}${random}`;
        this.qrCodeSecret = crypto.randomBytes(32).toString('hex');
        console.log('Generated QR Code:', this.qrCode, 'for delivery:', this._id);
    }
});

// Also ensure QR codes are set during create() operations
deliverySchema.pre('validate', async function() {
    if (!this.qrCode || !this.qrCodeSecret) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        this.qrCode = `DLV${timestamp}${random}`;
        this.qrCodeSecret = crypto.randomBytes(32).toString('hex');
        console.log('Generated QR Code in validate hook:', this.qrCode);
    }
});

// Add timeline entry
deliverySchema.methods.addTimelineEntry = function(status, notes = '', location = '', updatedBy = null) {
    this.timeline.push({
        status,
        timestamp: new Date(),
        location,
        notes,
        updatedBy
    });
    return this.save();
};

// Update delivery status with timeline
deliverySchema.methods.updateStatus = async function(newStatus, notes = '', location = '', updatedBy = null) {
    console.log('\n========== DELIVERY STATUS UPDATE ==========');
    console.log('Delivery ID:', this._id);
    console.log('Order ID:', this.order);
    console.log('Old Status:', this.status);
    console.log('New Status:', newStatus);
    console.log('============================================\n');

    const oldStatus = this.status;
    this.status = newStatus;

    // Add timeline entry
    await this.addTimelineEntry(newStatus, notes, location, updatedBy);

    // Handle status-specific logic
    if (newStatus === 'delivered') {
        this.actualDelivery = new Date();
        // Update related order status
        const Order = mongoose.model('Order');
        await Order.findByIdAndUpdate(this.order, {
            status: 'delivered',
            deliveryAgent: this.assignedTo
        });
    } else if (newStatus === 'picked_up') {
        console.log('\n========== DELIVERY: PICKED_UP STATUS ==========');
        
        // Update related order status
        const Order = mongoose.model('Order');
        await Order.findByIdAndUpdate(this.order, {
            status: 'picked_up',
            deliveryAgent: this.assignedTo
        });
        
        // Generate OTP when order is picked up
        const OTP = require('./otp');
        const { sendOrderStatusSMS } = require('../services/smsService');
        
        const otpCode = OTP.generateOTP(6);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        
        console.log('Generated OTP Code:', otpCode);
        console.log('Expires At:', expiresAt);
        
        // Store OTP in order (explicitly unset verifiedAt to ensure it's not carried over)
        const updateResult = await Order.findByIdAndUpdate(this.order, {
            $set: {
                'deliveryOTP.code': otpCode,
                'deliveryOTP.expiresAt': expiresAt,
                'deliveryOTP.generatedAt': new Date()
            },
            $unset: {
                'deliveryOTP.verifiedAt': 1  // Remove any existing verifiedAt
            }
        });
        
        console.log('OTP Update Result:', updateResult);
        
        // Send OTP to customer via SMS
        try {
            const order = await Order.findById(this.order);
            if (order && order.address && order.address.phone) {
                console.log('Sending OTP SMS to:', order.address.phone);
                await sendOrderStatusSMS(order, order.address.phone, 'picked_up', otpCode);
                console.log('✅ OTP SMS sent to customer on pickup:', order.address.phone);
            } else {
                console.log('⚠️ Cannot send SMS - No phone number found');
            }
        } catch (smsError) {
            console.error('⚠️ Failed to send OTP SMS on pickup:', smsError);
        }
        
        console.log('===============================================\n');
    } else if (newStatus === 'out_for_delivery') {
        // Update related order status AND set delivery agent
        const Order = mongoose.model('Order');
        await Order.findByIdAndUpdate(this.order, { 
            status: 'out_for_delivery',
            deliveryAgent: this.assignedTo
        });
    } else if (newStatus === 'assigned') {
        // When assigned, set the delivery agent on the order
        const Order = mongoose.model('Order');
        await Order.findByIdAndUpdate(this.order, { 
            status: 'assigned',
            deliveryAgent: this.assignedTo
        });
    }

    return this.save();
};

// Add delivery attempt
deliverySchema.methods.addAttempt = function(status, reason = '', notes = '', agent = null, proof = {}) {
    const attemptNumber = this.attempts.length + 1;
    this.attempts.push({
        attemptNumber,
        timestamp: new Date(),
        status,
        reason,
        notes,
        agent,
        proof
    });
    
    if (status === 'success') {
        this.status = 'delivered';
    } else if (status === 'failed') {
        this.status = 'failed_attempt';
    }
    
    return this.save();
};

// Verify QR code
deliverySchema.statics.verifyQRCode = async function(qrCode, secret) {
    const delivery = await this.findOne({ qrCode });
    if (!delivery) {
        return { valid: false, message: 'Invalid QR code' };
    }
    
    if (delivery.qrCodeSecret !== secret) {
        return { valid: false, message: 'Invalid QR code secret' };
    }
    
    return { valid: true, delivery };
};

// Get deliveries by status
deliverySchema.statics.getDeliveriesByStatus = function(status) {
    return this.find({ status })
        .populate('order')
        .populate('assignedTo')
        .populate('shippingPartner')
        .sort({ createdAt: -1 });
};

// Get deliveries by agent
deliverySchema.statics.getDeliveriesByAgent = function(agentId) {
    return this.find({ assignedTo: agentId })
        .populate('order')
        .sort({ createdAt: -1 });
};

// Get active deliveries for agent
deliverySchema.methods.getActiveDeliveriesForAgent = function(agentId) {
    return this.find({
        assignedTo: agentId,
        status: { $in: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'] }
    }).populate('order').sort({ createdAt: -1 });
};

// Calculate delivery statistics
deliverySchema.statics.getStatistics = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    
    const result = {};
    stats.forEach(s => {
        result[s._id] = s.count;
    });
    
    return result;
};

// Index for faster queries (qrCode index already created by unique: true)
deliverySchema.index({ assignedTo: 1, status: 1 });
deliverySchema.index({ order: 1 });
deliverySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Delivery', deliverySchema);
