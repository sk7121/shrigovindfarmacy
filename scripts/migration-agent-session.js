// Migration Script: Add Session Management Fields to Delivery Agents
// Run with: node scripts/migration-agent-session.js

require('dotenv').config();
const mongoose = require('mongoose');

console.log("\n========================================");
console.log("🔄 Delivery Agent Session Migration");
console.log("========================================\n");

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => {
        console.error("❌ MongoDB connection error:", err.message);
        process.exit(1);
    });

// Define minimal schema for migration
const deliveryAgentSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    sessionExpiry: Date,
    lastActive: {
        type: Date,
        default: Date.now
    },
    refreshToken: String,
    isActive: Boolean
}, { strict: false });

const DeliveryAgent = mongoose.model('DeliveryAgent', deliveryAgentSchema);

async function runMigration() {
    try {
        console.log("📊 Checking existing delivery agents...\n");

        // Get all delivery agents
        const agents = await DeliveryAgent.find({});
        console.log(`   Found ${agents.length} delivery agent(s)\n`);

        if (agents.length === 0) {
            console.log("ℹ️  No delivery agents found. Skipping migration.\n");
            process.exit(0);
        }

        let updated = 0;
        let skipped = 0;

        for (const agent of agents) {
            try {
                // Check if agent already has session fields
                if (agent.sessionExpiry && agent.lastActive) {
                    console.log(`   ⏭️  Skipping: ${agent.email} (already has session fields)`);
                    skipped++;
                    continue;
                }

                // Update agent with new fields
                agent.sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
                agent.lastActive = new Date();
                
                await agent.save();
                
                console.log(`   ✅ Updated: ${agent.email} - Session expires: ${agent.sessionExpiry.toLocaleString('en-IN')}`);
                updated++;
            } catch (err) {
                console.error(`   ❌ Error updating ${agent.email}:`, err.message);
            }
        }

        console.log("\n========================================");
        console.log("✅ Migration Complete!");
        console.log("========================================");
        console.log(`   Total agents: ${agents.length}`);
        console.log(`   Updated: ${updated}`);
        console.log(`   Skipped: ${skipped}`);
        console.log("\n📋 Session Management Features:");
        console.log("   • Agents stay signed in until session expires or logout");
        console.log("   • Default session: 7 days (30 days with 'Remember Me')");
        console.log("   • Auto-refresh every 6 hours on dashboard");
        console.log("   • Session expires on manual logout");
        console.log("");

        process.exit(0);
    } catch (err) {
        console.error("\n❌ Migration failed:", err.message);
        console.error(err.stack);
        process.exit(1);
    }
}

// Run migration
runMigration();
