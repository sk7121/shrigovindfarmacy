const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
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
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
        unique: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    review: {
        type: String,
        trim: true,
        maxlength: 500
    },
    consultationType: {
        type: String,
        enum: ['WhatsApp', 'In-Clinic', 'Online']
    },
    isVerifiedConsultation: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
ratingSchema.index({ doctor: 1, createdAt: -1 });
ratingSchema.index({ patient: 1, createdAt: -1 });

// Static method to get average rating for a doctor
ratingSchema.statics.getAverageRating = function(doctorId) {
    return this.aggregate([
        {
            $match: { doctor: mongoose.Types.ObjectId(doctorId) }
        },
        {
            $group: {
                _id: '$doctor',
                averageRating: { $avg: '$rating' },
                totalRatings: { $sum: 1 }
            }
        }
    ]);
};

// Static method to check if patient already rated an appointment
ratingSchema.statics.hasRated = function(appointmentId) {
    return this.findOne({ appointment: appointmentId });
};

module.exports = mongoose.model('Rating', ratingSchema);
