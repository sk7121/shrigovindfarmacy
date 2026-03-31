const mongoose = require('mongoose');

const videoCallSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    roomId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'ended'],
        default: 'waiting'
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    review: {
        type: String
    },
    ratedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for better query performance
videoCallSchema.index({ appointment: 1 });
videoCallSchema.index({ doctor: 1, status: 1 });
videoCallSchema.index({ patient: 1, status: 1 });
// Note: roomId index is automatically created by unique: true

// Static method to get active call for an appointment
videoCallSchema.statics.getActiveCall = function(appointmentId) {
    return this.findOne({
        appointment: appointmentId,
        status: { $in: ['waiting', 'active'] }
    });
};

// Method to start the call
videoCallSchema.methods.start = async function() {
    this.status = 'active';
    this.startedAt = new Date();
    await this.save();
    return this;
};

// Method to end the call
videoCallSchema.methods.end = async function() {
    this.status = 'ended';
    this.endedAt = new Date();
    
    if (this.startedAt) {
        this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
    }
    
    await this.save();
    return this;
};

// Method to add rating
videoCallSchema.methods.addRating = async function(rating, review) {
    this.rating = rating;
    this.review = review;
    this.ratedAt = new Date();
    await this.save();
    return this;
};

module.exports = mongoose.model('VideoCall', videoCallSchema);
