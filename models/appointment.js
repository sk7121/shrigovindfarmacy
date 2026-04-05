const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
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
    patientDetails: {
        name: String,
        email: String,
        phone: String,
        age: Number,
        gender: {
            type: String,
            enum: ['Male', 'Female', 'Other']
        }
    },
    appointmentType: {
        type: String,
        enum: ['In-Clinic', 'Online', 'WhatsApp'],
        required: true
    },
    appointmentDate: {
        type: Date,
        required: true
    },
    appointmentTime: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    symptoms: [{
        type: String
    }],
    medicalHistory: {
        type: String
    },
    currentMedications: {
        type: String
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-Show'],
        default: 'Pending'
    },
    notes: {
        type: String
    },
    prescription: {
        type: String
    },
    followUpRequired: {
        type: Boolean,
        default: false
    },
    followUpDate: {
        type: Date
    },
    consultationFee: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['Unpaid', 'Paid', 'Refunded'],
        default: 'Unpaid'
    },
    paymentId: {
        type: String
    },
    isWalkIn: {
        type: Boolean,
        default: false
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancellationReason: {
        type: String
    },
    cancelledAt: {
        type: Date
    },
    // WhatsApp Video Call fields
    callStartedAt: {
        type: Date
    },
    callEndedAt: {
        type: Date
    },
    callDuration: {
        type: Number, // in minutes
        default: 0
    },
    isAttended: {
        type: Boolean,
        default: false
    },
    attendedAt: {
        type: Date
    },
    isRated: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes for better query performance
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ patient: 1, createdAt: -1 });
appointmentSchema.index({ status: 1 });

// Static method to get appointments for a doctor on a specific date
appointmentSchema.statics.findByDoctorAndDate = function(doctorId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.find({
        doctor: doctorId,
        appointmentDate: {
            $gte: startOfDay,
            $lte: endOfDay
        }
    }).populate('patient', 'name email phone');
};

// Static method to get upcoming appointments for a patient
appointmentSchema.statics.findUpcomingForPatient = function(patientId) {
    const now = new Date();
    
    return this.find({
        patient: patientId,
        appointmentDate: { $gte: now },
        status: { $in: ['Pending', 'Confirmed'] }
    })
    .populate('doctor', 'name title specializations')
    .sort({ appointmentDate: 1, appointmentTime: 1 });
};

// Method to confirm appointment
appointmentSchema.methods.confirm = async function() {
    this.status = 'Confirmed';
    await this.save();
    return this;
};

// Method to cancel appointment
appointmentSchema.methods.cancel = async function(userId, reason) {
    this.status = 'Cancelled';
    this.cancelledBy = userId;
    this.cancellationReason = reason;
    this.cancelledAt = new Date();
    await this.save();
    return this;
};

// Method to mark appointment as completed
appointmentSchema.methods.complete = async function(notes = '', prescription = '') {
    this.status = 'Completed';
    this.notes = notes;
    this.prescription = prescription;
    await this.save();
    return this;
};

// Method to mark appointment as attended (for WhatsApp video calls)
appointmentSchema.methods.markAttended = async function() {
    this.isAttended = true;
    this.attendedAt = new Date();
    this.status = 'Completed';
    
    if (this.callStartedAt && !this.callEndedAt) {
        this.callEndedAt = new Date();
        this.callDuration = Math.round((this.callEndedAt - this.callStartedAt) / 60000); // minutes
    }
    
    await this.save();
    return this;
};

// Method to start WhatsApp call
appointmentSchema.methods.startCall = async function() {
    this.callStartedAt = new Date();
    this.isAttended = true;
    this.attendedAt = new Date();
    await this.save();
    return this;
};

// Method to mark as rated
appointmentSchema.methods.markRated = async function() {
    this.isRated = true;
    await this.save();
    return this;
};

module.exports = mongoose.model('Appointment', appointmentSchema);
