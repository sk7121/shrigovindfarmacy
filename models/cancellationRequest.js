const mongoose = require("mongoose");

const cancellationRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: String,
        image: String,
        price: Number,
        quantity: Number,
        subtotal: Number,
      },
    ],
    reason: {
      type: String,
      required: true,
      enum: [
        "wrong_item",
        "damaged_product",
        "expired_product",
        "not_as_described",
        "duplicate_order",
        "changed_mind",
        "delivery_delay",
        "other",
      ],
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "assigned",
        "otp_generated",
        "pickup_scheduled",
        "picked_up",
        "verified",
        "refund_initiated",
        "refunded",
        "rejected",
      ],
      default: "pending",
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAgent",
    },
    pickupAddress: {
      fullName: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
    },
    cancellationOTP: {
      code: String,
      expiresAt: Date,
      generatedAt: Date,
      verifiedAt: Date,
    },
    pickupProof: {
      image: String,
      uploadedAt: Date,
    },
    refundAmount: {
      type: Number,
      required: true,
    },
    refundMethod: {
      type: String,
      enum: ["original_payment", "wallet", "bank_transfer"],
      default: "original_payment",
    },
    adminNotes: String,
    rejectionReason: String,
    pickedUpAt: Date,
    refundedAt: Date,
    trackingId: String,
  },
  {
    timestamps: true,
  },
);

// Generate unique tracking ID
cancellationRequestSchema.pre("save", async function () {
  if (!this.trackingId) {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");

    // Generate random 4-digit number
    const random = Math.floor(1000 + Math.random() * 9000);

    this.trackingId = `CR${year}${month}${day}${random}`;
  }
});

// Index for faster queries
cancellationRequestSchema.index({ order: 1, user: 1 });
cancellationRequestSchema.index({ status: 1, createdAt: -1 });
cancellationRequestSchema.index({ assignedAgent: 1, status: 1 });

module.exports = mongoose.model(
  "CancellationRequest",
  cancellationRequestSchema,
);
