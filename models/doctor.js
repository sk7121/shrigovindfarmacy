const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    qualifications: [{
        degree: String,
        specialization: String,
        institution: String,
        year: Number
    }],
    registrationNumber: {
        type: String,
        trim: true
    },
    experience: {
        years: {
            type: Number,
            default: 0
        },
        description: String
    },
    specializations: [{
        type: String
    }],
    languages: [{
        type: String
    }],
    about: {
        type: String,
        required: true
    },
    contact: {
        phone: {
            type: String,
            trim: true,
            match: [/^[6-9][0-9]{9}$/, "Please enter a valid Indian mobile number"]
        },
        whatsapp: {
            type: String,
            trim: true,
            match: [/^[6-9][0-9]{9}$/, "Please enter a valid Indian mobile number"]
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
        },
        clinicAddress: {
            type: String,
            required: true
        }
    },
    // Login credentials for doctor portal
    loginEmail: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
    },
    password: {
        type: String,
        required: true,
        minlength: [6, "Password must be at least 6 characters long"]
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    availability: [{
        day: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        },
        startTime: String,
        endTime: String,
        isAvailable: {
            type: Boolean,
            default: true
        }
    }],
    consultationFee: {
        firstVisit: {
            type: Number,
            default: 0
        },
        followUp: {
            type: Number,
            default: 500
        },
        currency: {
            type: String,
            default: 'INR'
        },
        isFreeFirstVisit: {
            type: Boolean,
            default: false
        }
    },
    consultationModes: [{
        type: String,
        enum: ['In-Clinic', 'Online', 'WhatsApp', 'Video Call']
    }],
    image: {
        type: String,
        default: ''
    },
    stats: {
        patientsTreated: {
            type: Number,
            default: 0
        },
        totalConsultations: {
            type: Number,
            default: 0
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        totalReviews: {
            type: Number,
            default: 0
        }
    },
    reviews: [{
        patientName: String,
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        date: {
            type: Date,
            default: Date.now
        },
        isVerified: {
            type: Boolean,
            default: false
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    isAvailableNow: {
        type: Boolean,
        default: true
    },
    featured: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate slug from name before saving
doctorSchema.pre('save', function() {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
});

// Static method to get doctor by slug
doctorSchema.statics.findBySlug = function(slug) {
    return this.findOne({ slug });
};

// Method to check if doctor is available at given time
doctorSchema.methods.isAvailableAtTime = function(day, time) {
    const availability = this.availability.find(a => a.day === day);
    if (!availability || !availability.isAvailable) {
        return false;
    }
    
    // Simple time check (can be enhanced)
    return true;
};

// Method to add review
doctorSchema.methods.addReview = async function(patientName, rating, comment, isVerified = false) {
    this.reviews.push({ patientName, rating, comment, isVerified });
    this.stats.totalReviews += 1;
    
    // Recalculate average rating
    const totalRating = this.reviews.reduce((sum, r) => sum + r.rating, 0);
    this.stats.averageRating = parseFloat((totalRating / this.reviews.length).toFixed(1));
    
    await this.save();
    return this;
};

// Method to update availability status based on current day/time
doctorSchema.methods.updateAvailabilityStatus = function() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    const currentDay = days[now.getDay()];
    
    const todayAvailability = this.availability.find(a => a.day === currentDay);
    
    if (todayAvailability && todayAvailability.isAvailable) {
        this.isAvailableNow = true;
    } else {
        this.isAvailableNow = false;
    }
    
    return this.isAvailableNow;
};

module.exports = mongoose.model('Doctor', doctorSchema);
