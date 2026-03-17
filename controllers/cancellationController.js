const CancellationRequest = require("../models/cancellationRequest");
const Order = require("../models/order");
const DeliveryAgent = require("../models/deliveryAgent");
const {
  sendCancellationRequestNotification,
  sendCancellationStatusUpdate,
} = require("../services/emailService");
const {
  sendCancellationOTP,
  sendCancellationStatusSMS,
} = require("../services/smsService");
const crypto = require("crypto");

// @desc    Create cancellation request
// @route   POST /api/cancellations
// @access  Private
const createCancellationRequest = async (req, res) => {
  try {
    const { orderId, items, reason, description, pickupAddress } = req.body;

    // Validate order exists and belongs to user
    const order = await Order.findById(orderId).populate("items.product");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      });
    }

    // Check if cancellation request already exists
    const existingRequest = await CancellationRequest.findOne({
      order: orderId,
      status: {
        $in: [
          "pending",
          "approved",
          "assigned",
          "otp_generated",
          "pickup_scheduled",
          "picked_up",
          "verified",
        ],
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Cancellation request already exists for this order",
      });
    }

    // Calculate refund amount
    let refundAmount = 0;
    const selectedItems = [];

    for (const item of items) {
      const orderItem = order.items.find(
        (oi) => oi.product.toString() === item.productId,
      );
      if (orderItem && item.quantity <= orderItem.quantity) {
        const itemTotal = orderItem.price * item.quantity;
        refundAmount += itemTotal;
        selectedItems.push({
          product: item.productId,
          name: orderItem.name,
          image: orderItem.image,
          price: orderItem.price,
          quantity: item.quantity,
          subtotal: itemTotal,
        });
      }
    }

    // Create cancellation request
    const cancellationRequest = new CancellationRequest({
      order: orderId,
      user: req.user._id,
      items: selectedItems,
      reason,
      description,
      pickupAddress: {
        ...pickupAddress,
        fullName: order.address.fullName,
        phone: order.address.phone,
      },
      refundAmount,
    });

    await cancellationRequest.save();

    // Send notification to admin
    await sendCancellationRequestNotification(cancellationRequest);

    res.status(201).json({
      success: true,
      data: cancellationRequest,
      message: "Cancellation request submitted successfully",
    });
  } catch (error) {
    console.error("Create cancellation request error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating cancellation request",
    });
  }
};

// @desc    Get user cancellation requests
// @route   GET /api/cancellations
// @access  Private
const getUserCancellationRequests = async (req, res) => {
  try {
    const requests = await CancellationRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("order", "tracking.orderId status")
      .populate("assignedAgent", "name phone")
      .populate("items.product");

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Get user cancellation requests error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cancellation requests",
    });
  }
};

// @desc    Get single cancellation request
// @route   GET /api/cancellations/:id
// @access  Private
const getCancellationRequest = async (req, res) => {
  try {
    const request = await CancellationRequest.findById(req.params.id)
      .populate("order")
      .populate("user", "name email phone")
      .populate("assignedAgent", "name phone vehicleType vehicleNumber")
      .populate("items.product");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found",
      });
    }

    // Check if user owns this request or is admin
    if (
      request.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this request",
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Get cancellation request error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cancellation request",
    });
  }
};

// @desc    Get all cancellation requests (Admin)
// @route   GET /api/cancellations/admin/all
// @access  Private/Admin
const getAllCancellationRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const requests = await CancellationRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("order", "tracking.orderId status pricing.total")
      .populate("user", "name email phone")
      .populate("assignedAgent", "name phone")
      .populate("items.product");

    const total = await CancellationRequest.countDocuments(filter);

    res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all cancellation requests error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cancellation requests",
    });
  }
};

// @desc    Update cancellation request status (Admin)
// @route   PUT /api/cancellations/:id/status
// @access  Private/Admin
const updateCancellationStatus = async (req, res) => {
  try {
    const { status, adminNotes, rejectionReason, assignedAgent } = req.body;

    const request = await CancellationRequest.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("order");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found",
      });
    }

    const oldStatus = request.status;
    request.status = status;

    if (adminNotes) request.adminNotes = adminNotes;
    if (rejectionReason) request.rejectionReason = rejectionReason;
    if (assignedAgent) request.assignedAgent = assignedAgent;

    // If assigning agent, generate OTP
    if (status === "assigned" && assignedAgent) {
      const otp = crypto.randomInt(100000, 999999).toString();
      request.cancellationOTP = {
        code: otp,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        generatedAt: new Date(),
      };
      request.status = "otp_generated";

      // Send OTP to assigned agent
      await sendCancellationOTP(request.assignedAgent, otp, request.trackingId);
    }

    // If rejected, update order status
    if (status === "rejected") {
      // Order remains in current status
    }

    await request.save();

    // Send status update notification
    if (oldStatus !== status) {
      await sendCancellationStatusUpdate(request);
    }

    res.json({
      success: true,
      data: request,
      message: "Cancellation request updated successfully",
    });
  } catch (error) {
    console.error("Update cancellation status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating cancellation request",
    });
  }
};

// @desc    Verify cancellation OTP and upload proof (Agent)
// @route   POST /api/cancellations/:id/verify
// @access  Private/Agent
const verifyCancellationPickup = async (req, res) => {
  try {
    const { otp, pickupProof } = req.body;

    const request = await CancellationRequest.findById(req.params.id).populate(
      "assignedAgent",
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found",
      });
    }

    // Check if agent is assigned to this request
    if (request.assignedAgent._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized for this request",
      });
    }

    // Verify OTP
    if (!request.cancellationOTP.code || request.cancellationOTP.code !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Check OTP expiry
    if (request.cancellationOTP.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    // Update request
    request.cancellationOTP.verifiedAt = new Date();
    request.pickupProof = {
      image: pickupProof,
      uploadedAt: new Date(),
    };
    request.status = "picked_up";
    request.pickedUpAt = new Date();

    await request.save();

    res.json({
      success: true,
      data: request,
      message: "Pickup verified successfully",
    });
  } catch (error) {
    console.error("Verify cancellation pickup error:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying pickup",
    });
  }
};

// @desc    Process refund (Admin)
// @route   POST /api/cancellations/:id/refund
// @access  Private/Admin
const processRefund = async (req, res) => {
  try {
    const request = await CancellationRequest.findById(req.params.id)
      .populate("order")
      .populate("user", "name email phone");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found",
      });
    }

    if (request.status !== "picked_up") {
      return res.status(400).json({
        success: false,
        message: "Request must be picked up before processing refund",
      });
    }

    // Process refund logic here (integrate with payment gateway)
    // For now, just mark as refunded
    request.status = "refunded";
    request.refundedAt = new Date();

    // Update order status
    await Order.findByIdAndUpdate(request.order._id, {
      status: "cancelled",
      "tracking.cancelledAt": new Date(),
      "tracking.cancellationReason": request.reason,
    });

    await request.save();

    // Send refund confirmation
    await sendCancellationStatusUpdate(request);

    res.json({
      success: true,
      data: request,
      message: "Refund processed successfully",
    });
  } catch (error) {
    console.error("Process refund error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing refund",
    });
  }
};

module.exports = {
  createCancellationRequest,
  getUserCancellationRequests,
  getCancellationRequest,
  getAllCancellationRequests,
  updateCancellationStatus,
  verifyCancellationPickup,
  processRefund,
};
