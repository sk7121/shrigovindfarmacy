const mongoose = require('mongoose');

const shippingPartnerSchema = new mongoose.Schema({
    // Company information
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['courier', 'logistics', 'express', 'ecommerce', 'local', 'national', 'international'],
        required: true
    },
    
    // Contact information
    contactPerson: {
        name: String,
        email: String,
        phone: String,
        designation: String
    },
    supportEmail: String,
    supportPhone: String,
    website: String,
    
    // Address
    address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
        country: {
            type: String,
            default: 'India'
        }
    },
    
    // Service coverage
    serviceAreas: [{
        type: String,
        enum: ['local', 'state', 'national', 'international']
    }],
    serviceablePincodes: [String], // Array of serviceable pincodes
    serviceableCities: [String],   // Array of serviceable cities
    
    // Services offered
    services: [{
        name: {
            type: String,
            enum: ['standard', 'express', 'same_day', 'next_day', 'scheduled', 'cod', 'insurance']
        },
        enabled: {
            type: Boolean,
            default: true
        },
        additionalCharge: {
            type: Number,
            default: 0
        }
    }],
    
    // Pricing
    pricing: {
        baseRate: {
            type: Number,
            default: 0
        },
        perKgRate: {
            type: Number,
            default: 0
        },
        codChargePercent: {
            type: Number,
            default: 0
        },
        fuelSurcharge: {
            type: Number,
            default: 0
        },
        gstPercent: {
            type: Number,
            default: 18
        }
    },
    
    // Performance metrics
    stats: {
        totalShipments: {
            type: Number,
            default: 0
        },
        activeShipments: {
            type: Number,
            default: 0
        },
        deliveredShipments: {
            type: Number,
            default: 0
        },
        averageDeliveryDays: {
            type: Number,
            default: 0
        },
        onTimeDeliveryRate: {
            type: Number,
            default: 100
        },
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        }
    },
    
    // Integration details
    apiIntegration: {
        enabled: {
            type: Boolean,
            default: false
        },
        apiKey: String,
        apiSecret: String,
        webhookUrl: String,
        trackingUrlTemplate: String // e.g., "https://partner.com/track/{tracking_id}"
    },
    
    // Account details
    accountNumber: String,
    contractStartDate: Date,
    contractEndDate: Date,
    
    // Status
    isActive: {
        type: Boolean,
        default: true
    },
    isPreferred: {
        type: Boolean,
        default: false
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    
    // Documents
    agreement: String, // Document URL
    license: String,
    insurance: String,
    
    // Pickup schedule
    pickupSchedule: {
        frequency: {
            type: String,
            enum: ['daily', 'alternate', 'weekly', 'on_demand']
        },
        pickupTime: String, // e.g., "18:00"
        pickupDays: [String] // e.g., ['mon', 'wed', 'fri']
    },
    
    // Notes and internal comments
    notes: String,
    rating: {
        type: Number,
        default: 5,
        min: 1,
        max: 5
    }
}, {
    timestamps: true
});

// Generate partner code before save
shippingPartnerSchema.pre('save', async function(next) {
    if (!this.code && this.isNew) {
        const count = await mongoose.model('ShippingPartner').countDocuments();
        const prefix = this.type.substring(0, 3).toUpperCase();
        this.code = `${prefix}${String(count + 1).padStart(3, '0')}`;
    }
    next();
});

// Static method to get active partners
shippingPartnerSchema.statics.getActivePartners = function(type = null) {
    const query = { isActive: true };
    if (type) {
        query.type = type;
    }
    return this.find(query).sort({ priority: -1, isPreferred: -1 });
};

// Static method to find partners by pincode
shippingPartnerSchema.statics.findPartnersByPincode = function(pincode) {
    return this.find({
        isActive: true,
        $or: [
            { serviceablePincodes: pincode },
            { serviceablePincodes: { $size: 0 } } // Partners with no specific pincode restrictions
        ]
    }).sort({ priority: -1 });
};

// Method to calculate shipping cost
shippingPartnerSchema.methods.calculateShippingCost = function(weight, codAmount = 0, service = 'standard') {
    let cost = this.pricing.baseRate;
    
    // Add per kg rate
    if (weight > 0.5) {
        cost += (Math.ceil(weight - 0.5) * this.pricing.perKgRate);
    }
    
    // Add COD charge
    if (codAmount > 0 && this.pricing.codChargePercent > 0) {
        cost += (codAmount * this.pricing.codChargePercent / 100);
    }
    
    // Add fuel surcharge
    if (this.pricing.fuelSurcharge > 0) {
        cost += (cost * this.pricing.fuelSurcharge / 100);
    }
    
    // Add GST
    const gst = cost * this.pricing.gstPercent / 100;
    
    return {
        baseCost: cost,
        gst,
        totalCost: cost + gst,
        partner: this.code
    };
};

// Update statistics
shippingPartnerSchema.methods.updateStats = async function() {
    const Delivery = mongoose.model('Delivery');
    
    const deliveries = await Delivery.find({ shippingPartner: this._id });
    const total = deliveries.length;
    const active = deliveries.filter(d => 
        !['delivered', 'returned', 'cancelled'].includes(d.status)
    ).length;
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    
    this.stats.totalShipments = total;
    this.stats.activeShipments = active;
    this.stats.deliveredShipments = delivered;
    
    // Calculate average delivery time
    const deliveredDeliveries = deliveries.filter(d => 
        d.status === 'delivered' && d.createdAt && d.actualDelivery
    );
    
    if (deliveredDeliveries.length > 0) {
        const totalDays = deliveredDeliveries.reduce((acc, d) => {
            const days = (d.actualDelivery - d.createdAt) / (1000 * 60 * 60 * 24);
            return acc + days;
        }, 0);
        this.stats.averageDeliveryDays = Math.round((totalDays / deliveredDeliveries.length) * 10) / 10;
        
        // Calculate on-time rate (assuming 5 days as standard)
        const onTime = deliveredDeliveries.filter(d => {
            const days = (d.actualDelivery - d.createdAt) / (1000 * 60 * 60 * 24);
            return days <= 5;
        }).length;
        this.stats.onTimeDeliveryRate = Math.round((onTime / deliveredDeliveries.length) * 100);
    }
    
    return this.save();
};

// Index for queries (code index already created by unique: true)
shippingPartnerSchema.index({ isActive: 1, type: 1 });
shippingPartnerSchema.index({ serviceablePincodes: 1 });

module.exports = mongoose.model('ShippingPartner', shippingPartnerSchema);
