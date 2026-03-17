const express = require('express');
const router = express.Router();
const {
    getOrders,
    getOrder,
    createOrder,
    updateOrderStatus,
    cancelOrder
} = require('../controllers/orderController');
const { authenticate, isAdmin } = require('../middleware/auth');

// All routes are protected
router.use(authenticate);

// User routes
router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/', createOrder);
router.put('/:id/cancel', cancelOrder);

// Admin routes
router.put('/:id/status', isAdmin, updateOrderStatus);

module.exports = router;
