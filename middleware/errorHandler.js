// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Generate unique error ID for tracking
    const errorId = 'ERR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Log error with ID for debugging
    console.error(`[${errorId}]`, err.message);

    // Check if it's an API/AJAX request
    const isApiRequest = req.xhr || 
                         req.headers.accept?.includes('application/json') ||
                         req.originalUrl.startsWith('/api/');

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => ({
            field: e.path,
            message: e.message
        }));
        
        if (isApiRequest) {
            return res.status(400).json({
                success: false,
                message: 'Validation Error',
                errorId,
                errors
            });
        }
        
        return res.status(400).render('error/500.ejs', {
            title: 'Validation Error',
            message: 'Please check the information you entered.',
            errorId,
            errors
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        const fieldNames = {
            email: 'Email address',
            phone: 'Phone number',
            username: 'Username'
        };
        
        const message = `${fieldNames[field] || field} is already registered. Please try a different one or login.`;
        
        if (isApiRequest) {
            return res.status(400).json({
                success: false,
                message,
                errorId,
                field
            });
        }
        
        return res.status(400).render('error/500.ejs', {
            title: 'Already Registered',
            message,
            errorId
        });
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        if (isApiRequest) {
            return res.status(404).json({
                success: false,
                message: 'The requested resource was not found.',
                errorId
            });
        }
        
        return res.status(404).render('error/404.ejs', {
            title: 'Resource Not Found',
            message: 'The item you\'re looking for doesn\'t exist or has been removed.',
            errorId
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        if (isApiRequest) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token. Please login again.',
                errorId
            });
        }
        
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/login?error=invalid_token');
    }

    if (err.name === 'TokenExpiredError') {
        if (isApiRequest) {
            return res.status(401).json({
                success: false,
                message: 'Your session has expired. Please login again.',
                errorId
            });
        }
        
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/login?error=token_expired');
    }

    // Multer errors (file upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        if (isApiRequest) {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds the limit (Max 5MB). Please upload a smaller file.',
                errorId
            });
        }
        
        return res.status(400).render('error/500.ejs', {
            title: 'File Too Large',
            message: 'The uploaded file is too large. Please upload a file smaller than 5MB.',
            errorId
        });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        if (isApiRequest) {
            return res.status(400).json({
                success: false,
                message: 'Unexpected file field. Please check the form and try again.',
                errorId
            });
        }
        
        return res.status(400).render('error/500.ejs', {
            title: 'Upload Error',
            message: 'There was an issue with your file upload. Please try again.',
            errorId
        });
    }

    // EJS render errors
    if (err.message?.includes('Could not find the selected EJS layout')) {
        console.error('View rendering error:', err.message);
        return res.status(500).render('error/500.ejs', {
            title: 'Page Rendering Error',
            message: 'We\'re having trouble displaying this page. Please try again.',
            errorId
        });
    }

    // MongoDB connection errors
    if (err.message?.includes('MongoServerError') || err.message?.includes('ECONNREFUSED')) {
        console.error('Database connection error:', err.message);
        if (isApiRequest) {
            return res.status(503).json({
                success: false,
                message: 'Database service temporarily unavailable. Please try again in a few moments.',
                errorId
            });
        }
        
        return res.status(503).render('error/500.ejs', {
            title: 'Service Unavailable',
            message: 'Our database is temporarily unavailable. Please try again in a few moments.',
            errorId
        });
    }

    // Razorpay errors
    if (err.message?.includes('Razorpay')) {
        console.error('Payment error:', err.message);
        if (isApiRequest) {
            return res.status(400).json({
                success: false,
                message: 'Payment processing failed. Please try a different payment method or try again.',
                errorId
            });
        }
        
        return res.status(400).render('error/500.ejs', {
            title: 'Payment Error',
            message: 'We couldn\'t process your payment. Please try a different payment method.',
            errorId
        });
    }

    // Default error
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'An unexpected error occurred. Please try again.';

    // Log critical errors (500s) for investigation
    if (statusCode >= 500) {
        console.error(`[CRITICAL ${errorId}]`, {
            url: req.originalUrl,
            method: req.method,
            user: req.user?._id || 'anonymous',
            error: err.message,
            stack: err.stack
        });
    }

    if (isApiRequest) {
        return res.status(statusCode).json({
            success: false,
            message,
            errorId,
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                details: err.details
            })
        });
    }

    // Render appropriate error page for browser requests
    if (statusCode === 404) {
        return res.status(statusCode).render('error/404.ejs', {
            title: 'Page Not Found',
            message: 'The page you\'re looking for doesn\'t exist or has been moved.',
            errorId,
            path: req.originalUrl
        });
    }

    res.status(statusCode).render('error/500.ejs', {
        title: getErrorTitle(statusCode),
        message,
        errorId,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

// Helper function to get error title based on status code
function getErrorTitle(statusCode) {
    const titles = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Access Denied',
        404: 'Page Not Found',
        408: 'Request Timeout',
        429: 'Too Many Requests',
        500: 'Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
    };
    return titles[statusCode] || 'Error';
}

// 404 Not Found handler - MUST be called after all routes
const notFound = (req, res, next) => {
    const error = new Error(`Page Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    error.status = 404;
    
    // Check if it's an API request
    const isApiRequest = req.xhr || 
                         req.headers.accept?.includes('application/json') ||
                         req.originalUrl.startsWith('/api/');
    
    if (isApiRequest) {
        return res.status(404).json({
            success: false,
            message: `The requested resource '${req.originalUrl}' was not found.`,
            errorId: '404_' + Date.now()
        });
    }
    
    // Render 404 page for browser requests
    res.status(404).render('error/404.ejs', {
        title: 'Page Not Found',
        message: "Oops! The page you're looking for doesn't exist or has been moved.",
        path: req.originalUrl
    });
};

// Async error wrapper to reduce try-catch boilerplate
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    notFound,
    asyncHandler
};
