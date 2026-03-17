const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors',
            errors: errors.array()
        });
    }
    next();
};

// Login validation
const loginValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];

// Registration validation
const registerValidation = [
    body('fname')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters'),
    body('lname')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Invalid email format'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    body('confirm_password')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    body('phone')
        .optional()
        .matches(/^[0-9]{10}$/)
        .withMessage('Phone number must be 10 digits'),
    body('city')
        .trim()
        .notEmpty()
        .withMessage('City is required'),
    body('state')
        .trim()
        .notEmpty()
        .withMessage('State is required'),
    handleValidationErrors
];

// Product validation
const createProductValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Product name is required')
        .isLength({ min: 3, max: 200 })
        .withMessage('Product name must be between 3 and 200 characters'),
    body('price')
        .notEmpty()
        .withMessage('Price is required')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    body('description')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Description must be less than 2000 characters'),
    body('category')
        .trim()
        .notEmpty()
        .withMessage('Category is required'),
    body('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Stock must be a non-negative integer'),
    handleValidationErrors
];

// Order validation
const createOrderValidation = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Order must have at least one item'),
    body('items.*.product')
        .notEmpty()
        .withMessage('Product ID is required'),
    body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
    body('paymentMethod')
        .isIn(['cod', 'online', 'upi', 'card'])
        .withMessage('Invalid payment method'),
    body('shippingAddress')
        .notEmpty()
        .withMessage('Shipping address is required'),
    body('pricing.total')
        .isFloat({ min: 0 })
        .withMessage('Total must be a positive number'),
    handleValidationErrors
];

// ID parameter validation
const idParamValidation = [
    param('id')
        .notEmpty()
        .withMessage('ID is required')
        .isMongoId()
        .withMessage('Invalid MongoDB ID format'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    loginValidation,
    registerValidation,
    createProductValidation,
    createOrderValidation,
    idParamValidation
};
