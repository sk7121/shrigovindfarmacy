const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');
const { optionalAuth, authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', optionalAuth, getProducts);
router.get('/:id', optionalAuth, getProduct);

// Protected routes (Admin only)
router.post('/', authenticate, isAdmin, createProduct);
router.put('/:id', authenticate, isAdmin, updateProduct);
router.delete('/:id', authenticate, isAdmin, deleteProduct);

module.exports = router;
