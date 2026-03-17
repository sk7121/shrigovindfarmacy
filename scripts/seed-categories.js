/**
 * Seed script to populate categories in the database
 * Run with: node scripts/seed-categories.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/category');
const Product = require('../models/product');

const categoriesData = [
    {
        name: 'Ayurvedic',
        slug: 'ayurvedic',
        description: 'Classical & modern Ayurvedic formulations. Trusted remedies backed by centuries of wisdom and modern science.',
        icon: 'fas fa-capsules',
        color: 'green',
        displayOrder: 1,
        subcategories: [
            { name: 'Immunity', slug: 'immunity' },
            { name: 'Stress Relief', slug: 'stress-relief' },
            { name: 'Digestion', slug: 'digestion' },
            { name: 'Joint Care', slug: 'joint-care' },
            { name: 'Liver Care', slug: 'liver-care' }
        ]
    },
    {
        name: 'Sashtri Ayurvedic',
        slug: 'sashtri',
        description: 'Traditional classical preparations rooted in ancient Ayurvedic scriptures. Pure, potent, and time-tested formulations.',
        icon: 'fas fa-leaf',
        color: 'saffron',
        displayOrder: 2,
        subcategories: [
            { name: 'Rasa Shastra', slug: 'rasa-shastra' },
            { name: 'Kwath', slug: 'kwath' },
            { name: 'Churna', slug: 'churna' },
            { name: 'Asava & Arishta', slug: 'asava-arishta' },
            { name: 'Ghrita', slug: 'ghrita' }
        ]
    },
    {
        name: 'Herbal Cosmetics',
        slug: 'herbal-cosmetics',
        description: 'Natural herbal cosmetics for radiant skin and healthy hair. Chemical-free beauty solutions from nature.',
        icon: 'fas fa-heart',
        color: 'pink',
        displayOrder: 3,
        subcategories: [
            { name: 'Skincare', slug: 'skincare' },
            { name: 'Haircare', slug: 'haircare' },
            { name: 'Bath & Body', slug: 'bath-body' },
            { name: 'Face Wash', slug: 'face-wash' }
        ]
    },
    {
        name: 'FMCG',
        slug: 'fmcg',
        description: 'Fast-moving consumer goods for daily wellness. Quality personal care and household essentials.',
        icon: 'fas fa-soap',
        color: 'blue',
        displayOrder: 4,
        subcategories: [
            { name: 'Food', slug: 'food' },
            { name: 'Beverages', slug: 'beverages' },
            { name: 'Personal Care', slug: 'personal-care' },
            { name: 'Household', slug: 'household' },
            { name: 'Soap', slug: 'soap' }
        ]
    }
];

async function seedCategories() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/shri-govind-pharmacy');
        console.log('✅ Connected to MongoDB');

        // Clear existing categories
        await Category.deleteMany({});
        console.log('🗑️  Cleared existing categories');

        // Insert new categories
        const categories = await Category.insertMany(categoriesData);
        console.log(`✅ Created ${categories.length} categories`);

        // Update existing products to assign categories based on their names
        await updateProductCategories();

        console.log('\n🎉 Categories seeded successfully!');
        console.log('\nCategories created:');
        categories.forEach(cat => {
            console.log(`  - ${cat.name} (${cat.slug}) - ${cat.color}`);
        });

        process.exit(0);
    } catch (err) {
        console.error('❌ Error seeding categories:', err);
        process.exit(1);
    }
}

async function updateProductCategories() {
    // Map products to categories based on name patterns
    const categoryKeywords = {
        'ayurvedic': ['immunity', 'ashwagandha', 'shilajit', 'chyawanprash', 'triphala', 'brahmi', 'ayurvedic'],
        'sashtri': ['kwath', 'churna', 'ghrita', 'arishta', 'rasa', 'classical'],
        'herbal-cosmetics': ['aloevera', 'hair oil', 'face wash', 'soap', 'cosmetic', 'skin', 'hair'],
        'fmcg': ['honey', 'juice', 'water', 'cleaner', 'handwash', 'toothpaste', 'food', 'beverage']
    };

    const products = await Product.find({});
    let updatedCount = 0;

    for (const product of products) {
        const nameLower = product.name.toLowerCase();
        const descLower = (product.description || '').toLowerCase();
        const searchText = nameLower + ' ' + descLower;

        // Find matching category
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => searchText.includes(keyword))) {
                product.category = category;
                await product.save();
                updatedCount++;
                break;
            }
        }
    }

    console.log(`📦 Updated ${updatedCount} products with categories`);
}

// Run the seed
seedCategories();
