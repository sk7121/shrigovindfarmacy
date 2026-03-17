const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true
        },

        description: {
            type: String,
            default: ''
        },

        icon: {
            type: String,
            default: 'fas fa-box'
        },

        image: {
            type: String,
            default: ''
        },

        color: {
            type: String,
            default: 'green',
            enum: ['green', 'saffron', 'pink', 'blue']
        },

        subcategories: [{
            name: String,
            slug: String
        }],

        displayOrder: {
            type: Number,
            default: 0
        },

        isActive: {
            type: Boolean,
            default: true
        },

        // SEO fields
        metaTitle: {
            type: String,
            default: ''
        },

        metaDescription: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
);

// Pre-save: auto-generate slug from name if not provided
categorySchema.pre('save', function(next) {
    if (!this.slug && this.name) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    next();
});

// Static method: get categories with product counts
categorySchema.statics.getCategoriesWithCounts = async function() {
    const Product = mongoose.model('Product');
    
    const categories = await this.find({ isActive: true }).sort({ displayOrder: 1 });
    
    const categoriesWithCounts = await Promise.all(
        categories.map(async (cat) => {
            const productCount = await Product.countDocuments({ 
                category: cat.slug,
                stock: { $gt: 0 }
            });
            
            return {
                ...cat.toObject(),
                productCount
            };
        })
    );
    
    return categoriesWithCounts;
};

module.exports = mongoose.model("Category", categorySchema);
