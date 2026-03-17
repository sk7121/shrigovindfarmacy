/**
 * Setup Script - Creates Admin User and Sample Products
 * Run: node scripts/setup.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Product = require('../models/product');
const Coupon = require('../models/coupon');

async function setup() {
    console.log('🚀 Starting Setup...\n');
    
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✅ Connected to MongoDB\n');
        
        // 1. Create Admin User
        console.log('👤 Creating Admin User...');
        const existingAdmin = await User.findOne({ email: 'admin@shrigovind.com' });
        
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const admin = await User.create({
                name: 'Admin',
                email: 'admin@shrigovind.com',
                password: hashedPassword,
                phone: '9413010731',
                address: 'Sikar, Rajasthan',
                role: 'admin'
            });
            console.log('   ✓ Admin user created');
            console.log('   Email: admin@shrigovind.com');
            console.log('   Password: admin123\n');
        } else {
            console.log('   ℹ️  Admin user already exists\n');
        }
        
        // 2. Create Sample Products
        console.log('🛍️  Creating Sample Products...');
        const sampleProducts = [
            {
                name: 'Shilajit Gold 20g',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
                price: 999,
                oldPrice: 1299,
                stock: 50,
                category: 'ayurvedic',
                description: 'Pure Himalayan Shilajit for strength and vitality'
            },
            {
                name: 'Ashwagandha Powder 200g',
                image: 'https://images.unsplash.com/photo-1588776814604-52df024f1d1c?w=500',
                price: 450,
                oldPrice: 600,
                stock: 100,
                category: 'ayurvedic',
                description: 'Organic Ashwagandha powder for stress relief'
            },
            {
                name: 'Triphala Tablets 60pcs',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
                price: 320,
                oldPrice: 400,
                stock: 8,
                category: 'ayurvedic',
                description: 'Digestive health support tablets'
            },
            {
                name: 'Brahmi Oil 100ml',
                image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?w=500',
                price: 250,
                oldPrice: 300,
                stock: 75,
                category: 'ayurvedic',
                description: 'Hair growth and brain tonic oil'
            },
            {
                name: 'Neem Face Wash 150ml',
                image: 'https://images.unsplash.com/photo-1556228720-19875c4d84b9?w=500',
                price: 180,
                oldPrice: 220,
                stock: 120,
                category: 'herbal-cosmetics',
                description: 'Natural neem face wash for clear skin'
            },
            {
                name: 'Aloe Vera Gel 200ml',
                image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfbc8?w=500',
                price: 299,
                oldPrice: 399,
                stock: 90,
                category: 'herbal-cosmetics',
                description: 'Pure aloe vera gel for skin and hair'
            },
            {
                name: 'Chyawanprash 1kg',
                image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500',
                price: 550,
                oldPrice: 700,
                stock: 60,
                category: 'ayurvedic',
                description: 'Immunity booster chyawanprash'
            },
            {
                name: 'Giloy Juice 1L',
                image: 'https://images.unsplash.com/photo-1615485925763-867862f85c6a?w=500',
                price: 380,
                oldPrice: 450,
                stock: 5,
                category: 'ayurvedic',
                description: 'Pure giloy juice for immunity'
            }
        ];
        
        let created = 0;
        for (const prod of sampleProducts) {
            const exists = await Product.findOne({ name: prod.name });
            if (!exists) {
                await Product.create(prod);
                created++;
            }
        }
        console.log(`   ✓ ${created} products created\n`);
        
        // 3. Create Welcome Coupon
        console.log('🎫 Creating Welcome Coupon...');
        const exists = await Coupon.findOne({ code: 'WELCOME20' });
        if (!exists) {
            await Coupon.create({
                code: 'WELCOME20',
                description: '20% off for new customers',
                discountType: 'percentage',
                discountValue: 20,
                minOrderValue: 500,
                maxDiscount: 200,
                perUserLimit: 1,
                isActive: true,
                validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
            });
            console.log('   ✓ Coupon WELCOME20 created\n');
        } else {
            console.log('   ℹ️  Coupon already exists\n');
        }
        
        console.log('═══════════════════════════════════════════');
        console.log('✅ SETUP COMPLETE!');
        console.log('═══════════════════════════════════════════\n');
        console.log('📝 Login Credentials:');
        console.log('   Email: admin@shrigovind.com');
        console.log('   Password: admin123\n');
        console.log('🎫 Test Coupon:');
        console.log('   Code: WELCOME20');
        console.log('   Discount: 20% off (max ₹200)');
        console.log('   Min Order: ₹500\n');
        console.log('🚀 Next Steps:');
        console.log('   1. Run: npm start');
        console.log('   2. Visit: http://localhost:3000/login');
        console.log('   3. Login with admin credentials');
        console.log('   4. Explore the admin dashboard at /admin/home\n');
        
    } catch (error) {
        console.log('❌ Setup Failed:', error.message);
    } finally {
        mongoose.connection.close();
    }
}

setup();
