/**
 * Test Script: Cancellation Flow
 * 
 * This script tests the complete cancellation request flow
 * Run: node scripts/test-cancellation-flow.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Import models
const Order = require("../models/order");
const User = require("../models/user");
const CancellationRequest = require("../models/cancellationRequest");

async function testCancellationFlow() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected to MongoDB\n");

    // Step 1: Find a test user
    console.log("📋 Step 1: Finding a test user...");
    const testUser = await User.findOne({ role: "user" }).select("name email");
    if (!testUser) {
      console.log("❌ No test user found. Please create a user account first.");
      await mongoose.connection.close();
      return;
    }
    console.log(`✅ Found user: ${testUser.name} (${testUser.email})\n`);

    // Step 2: Find an order for this user
    console.log("📦 Step 2: Finding an order...");
    const testOrder = await Order.findOne({ 
      user: testUser._id,
      status: { $in: ["confirmed", "processing", "assigned", "shipped"] }
    }).populate("items.product");
    
    if (!testOrder) {
      console.log("❌ No cancellable orders found. Orders must be in status: confirmed, processing, assigned, or shipped");
      await mongoose.connection.close();
      return;
    }
    console.log(`✅ Found order: ${testOrder.tracking.orderId}`);
    console.log(`   Status: ${testOrder.status}`);
    console.log(`   Total: ₹${testOrder.pricing.total}`);
    console.log(`   Items: ${testOrder.items.length}\n`);

    // Step 3: Check if cancellation request already exists
    console.log("🔍 Step 3: Checking for existing cancellation requests...");
    const existingRequest = await CancellationRequest.findOne({
      order: testOrder._id,
      status: { $in: ["pending", "approved", "assigned", "otp_generated", "pickup_scheduled", "picked_up", "verified"] }
    });

    if (existingRequest) {
      console.log(`⚠️  Cancellation request already exists with status: ${existingRequest.status}`);
      console.log(`   Request ID: ${existingRequest.trackingId}`);
      console.log("\nSkipping creation. You can view this request at: /admin/cancellations/" + existingRequest._id);
    } else {
      console.log("✅ No existing cancellation request. Creating new one...\n");

      // Step 4: Create cancellation request
      console.log("📝 Step 4: Creating cancellation request...");
      const cancellationRequest = new CancellationRequest({
        order: testOrder._id,
        user: testUser._id,
        items: testOrder.items.map(item => ({
          product: item.product._id,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity
        })),
        reason: "changed_mind",
        description: "Test cancellation request - created by test script",
        pickupAddress: {
          fullName: testOrder.address.fullName,
          phone: testOrder.address.phone,
          address: testOrder.address.address,
          city: testOrder.address.city,
          state: testOrder.address.state,
          pincode: testOrder.address.pincode,
          landmark: testOrder.address.landmark || ""
        },
        refundAmount: testOrder.pricing.total
      });

      await cancellationRequest.save();
      console.log("✅ Cancellation request created successfully!\n");
      console.log("📄 Request Details:");
      console.log(`   Tracking ID: ${cancellationRequest.trackingId}`);
      console.log(`   Status: ${cancellationRequest.status}`);
      console.log(`   Reason: ${cancellationRequest.reason}`);
      console.log(`   Refund Amount: ₹${cancellationRequest.refundAmount}`);
      console.log(`   Items: ${cancellationRequest.items.length}\n`);
    }

    // Step 5: Show admin URLs
    console.log("🔗 Step 5: Admin URLs to view cancellation requests:");
    console.log(`   All requests: http://localhost:${process.env.PORT || 3000}/admin/cancellations`);
    if (!existingRequest) {
      console.log(`   This request: http://localhost:${process.env.PORT || 3000}/admin/cancellations/${cancellationRequest._id}`);
    }
    console.log("");

    // Step 6: Show test summary
    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ CANCELLATION FLOW TEST COMPLETE");
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n📝 Manual Testing Steps:");
    console.log("1. Go to: http://localhost:" + (process.env.PORT || 3000) + "/user/orders/" + testOrder._id);
    console.log("2. Click 'Request Cancellation' button");
    console.log("3. Fill in reason and description");
    console.log("4. Click 'Submit Request'");
    console.log("5. Check console for API response");
    console.log("\n👨‍💼 Admin Testing:");
    console.log("1. Login as admin");
    console.log("2. Go to: http://localhost:" + (process.env.PORT || 3000) + "/admin/cancellations");
    console.log("3. View the cancellation request");
    console.log("4. Approve/Reject the request");
    console.log("5. Assign agent for pickup (if approved)");
    console.log("");

    // Close connection
    await mongoose.connection.close();
    console.log("👋 Database connection closed");

  } catch (err) {
    console.error("💥 Test failed:", err);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run test
testCancellationFlow();
