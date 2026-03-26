/**
 * Migration Script: Create Missing Delivery Documents
 * 
 * This script finds all orders that have deliveryAgent assigned
 * but don't have a corresponding Delivery document, and creates them.
 * 
 * Usage: node scripts/create-missing-deliveries.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");

// Import models
const Order = require("../models/order");
const Delivery = require("../models/delivery");
const DeliveryAgent = require("../models/deliveryAgent");

async function createMissingDeliveries() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected to MongoDB");

    // Find all orders with deliveryAgent assigned
    const ordersWithAgent = await Order.find({
      deliveryAgent: { $exists: true, $ne: null }
    }).populate("deliveryAgent");

    console.log(`\n📦 Found ${ordersWithAgent.length} orders with deliveryAgent assigned`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of ordersWithAgent) {
      try {
        // Check if Delivery document already exists
        const existingDelivery = await Delivery.findOne({ order: order._id });
        
        if (existingDelivery) {
          console.log(`⏭️  Delivery exists for order ${order.tracking.orderId}`);
          skipped++;
          continue;
        }

        // Create Delivery document
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(4).toString("hex").toUpperCase();
        const qrCode = `DLV${timestamp}${random}`;
        const qrCodeSecret = crypto.randomBytes(32).toString("hex");

        const orderAddress = order.address || order.shippingAddress || order.shippingInfo;

        const delivery = await Delivery.create({
          order: order._id,
          qrCode,
          qrCodeSecret,
          assignedTo: order.deliveryAgent,
          assignedAt: order.createdAt,
          assignmentMethod: "manual",
          status: order.status === "assigned" ? "assigned" : 
                  order.status === "out_for_delivery" ? "out_for_delivery" :
                  order.status === "delivered" ? "delivered" : "assigned",
          deliveryAddress: {
            fullName: orderAddress?.fullName || "N/A",
            phone: orderAddress?.phone || "N/A",
            address: orderAddress?.address || "N/A",
            city: orderAddress?.city || "N/A",
            state: orderAddress?.state || "N/A",
            pincode: orderAddress?.pincode || "N/A",
            landmark: orderAddress?.landmark || ""
          },
          codAmount: order.payment?.method === "cod" ? order.pricing?.total || 0 : 0,
          priority: "normal",
          timeline: [{
            status: order.status,
            timestamp: order.createdAt,
            notes: "Delivery document created via migration"
          }]
        });

        console.log(`✅ Created delivery ${delivery.qrCode} for order ${order.tracking.orderId}`);
        created++;

      } catch (err) {
        console.error(`❌ Error processing order ${order.tracking.orderId}:`, err.message);
        errors++;
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total: ${ordersWithAgent.length}`);

    // Close connection
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");

  } catch (err) {
    console.error("💥 Migration failed:", err);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run migration
createMissingDeliveries();
