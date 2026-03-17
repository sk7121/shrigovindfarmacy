const express = require("express");
const router = express.Router();
const {
  createCancellationRequest,
  getUserCancellationRequests,
  getCancellationRequest,
  getAllCancellationRequests,
  updateCancellationStatus,
  verifyCancellationPickup,
  processRefund,
} = require("../controllers/cancellationController");
const {
  authenticate,
  isAdmin,
  isDeliveryAgent,
} = require("../middleware/auth");

// All routes are protected
router.use(authenticate);

// User routes
router.post("/", createCancellationRequest);
router.get("/", getUserCancellationRequests);
router.get("/:id", getCancellationRequest);

// Admin routes
router.get("/admin/all", isAdmin, getAllCancellationRequests);
router.put("/:id/status", isAdmin, updateCancellationStatus);
router.post("/:id/refund", isAdmin, processRefund);

// Delivery Agent routes
router.post("/:id/verify", isDeliveryAgent, verifyCancellationPickup);

module.exports = router;
