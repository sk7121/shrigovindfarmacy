const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true,
        default: () => new Date().setHours(0, 0, 0, 0)
    },
    orders: {
        total: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        cancelled: { type: Number, default: 0 },
        pending: { type: Number, default: 0 }
    },
    revenue: {
        total: { type: Number, default: 0 },
        cod: { type: Number, default: 0 },
        online: { type: Number, default: 0 }
    },
    customers: {
        new: { type: Number, default: 0 },
        active: { type: Number, default: 0 }
    },
    products: {
        views: { type: Number, default: 0 },
        addedToCart: { type: Number, default: 0 },
        sold: { type: Number, default: 0 }
    },
    topProducts: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        name: String,
        sold: Number,
        revenue: Number
    }]
}, {
    timestamps: true
});

// Static method to get dashboard analytics
analyticsSchema.statics.getDashboardData = async function(days = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const Order = mongoose.model('Order');
    const User = mongoose.model('User');
    const Product = mongoose.model('Product');

    // Get orders in date range
    const orders = await Order.find({
        createdAt: { $gte: startDate, $lte: endDate }
    }).populate('items.product');

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, order) => sum + order.pricing.total, 0);
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length;

    // Revenue by payment method
    const codRevenue = orders
        .filter(o => o.payment.method === 'cod')
        .reduce((sum, o) => sum + o.pricing.total, 0);
    
    const onlineRevenue = orders
        .filter(o => ['upi', 'card', 'netbanking', 'razorpay'].includes(o.payment.method))
        .reduce((sum, o) => sum + o.pricing.total, 0);

    // New customers
    const newCustomers = await User.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
    });

    // Top products
    const productSales = {};
    orders.forEach(order => {
        if (order.status === 'cancelled') return;
        
        order.items.forEach(item => {
            const productId = item.product?._id || item.product;
            if (!productSales[productId]) {
                productSales[productId] = {
                    product: productId,
                    name: item.name,
                    sold: 0,
                    revenue: 0
                };
            }
            productSales[productId].sold += item.quantity;
            productSales[productId].revenue += item.subtotal;
        });
    });

    const topProducts = Object.values(productSales)
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 10);

    // Daily revenue for chart
    const dailyRevenue = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $ne: 'cancelled' }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                },
                revenue: { $sum: '$pricing.total' },
                orders: { $sum: 1 }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    return {
        summary: {
            totalRevenue: Math.round(totalRevenue),
            totalOrders,
            completedOrders,
            cancelledOrders,
            pendingOrders,
            newCustomers,
            averageOrderValue: Math.round(totalRevenue / (totalOrders || 1)),
            codRevenue: Math.round(codRevenue),
            onlineRevenue: Math.round(onlineRevenue)
        },
        topProducts,
        dailyRevenue: dailyRevenue.map(d => ({
            date: `${d._id.day}/${d._id.month}/${d._id.year}`,
            revenue: Math.round(d.revenue),
            orders: d.orders
        })),
        period: {
            days,
            startDate,
            endDate
        }
    };
};

module.exports = mongoose.model('Analytics', analyticsSchema);
