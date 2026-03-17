// Script to clean up duplicate indexes from User collection
const mongoose = require('mongoose');
const User = require('../models/user');
require('dotenv').config();

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/shri_govind_pharmacy';

mongoose.connect(mongoUrl)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        
        const User = mongoose.model('User');
        
        // Get all indexes
        const indexes = await User.collection.indexes();
        console.log('\n📋 Current indexes:');
        indexes.forEach((idx, i) => {
            console.log(`  ${i + 1}. ${JSON.stringify(idx.key)} - Name: ${idx.name}`);
        });
        
        // Find duplicate google.googleId indexes
        const googleIndexes = indexes.filter(idx => idx.key && idx.key['google.googleId']);
        
        if (googleIndexes.length > 1) {
            console.log('\n⚠️  Found duplicate Google ID indexes!');
            
            // Keep the one with unique: true, drop others
            const indexToKeep = googleIndexes.find(idx => idx.unique === true);
            const indexesToDrop = googleIndexes.filter(idx => idx !== indexToKeep);
            
            for (const idx of indexesToDrop) {
                console.log(`🗑️  Dropping index: ${idx.name}`);
                await User.collection.dropIndex(idx.name);
            }
            
            console.log('✅ Duplicate indexes removed!');
        } else {
            console.log('✅ No duplicate indexes found');
        }
        
        await mongoose.connection.close();
        console.log('\n✅ Done! Restart your server.');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });
