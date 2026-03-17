const crypto = require('crypto');

// Generate OTP
const generateOTP = (length = 6) => {
    return crypto.randomInt(Math.pow(10, length - 1), Math.pow(10, length)).toString();
};

// Generate random string
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Hash password (if not using bcrypt)
const hashPassword = (password, salt) => {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
};

// Generate salt
const generateSalt = (length = 16) => {
    return crypto.randomBytes(length).toString('hex');
};

// Verify password
const verifyPassword = (password, salt, hashedPassword) => {
    const hash = hashPassword(password, salt);
    return hash === hashedPassword;
};

// Generate secure token
const generateSecureToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Mask email (e.g., j***@gmail.com)
const maskEmail = (email) => {
    const [username, domain] = email.split('@');
    const maskedUsername = username.charAt(0) + '***' + username.charAt(username.length - 1);
    return `${maskedUsername}@${domain}`;
};

// Mask phone number (e.g., +91*****1234)
const maskPhoneNumber = (phone) => {
    if (phone.length <= 4) return '***';
    return phone.substring(0, 3) + '*****' + phone.substring(phone.length - 4);
};

// Sanitize string (remove special characters)
const sanitizeString = (str) => {
    return str.replace(/[<>]/g, '').trim();
};

// Escape HTML entities
const escapeHtml = (text) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Format currency (INR)
const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

// Format date
const formatDate = (date, options = {}) => {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(date).toLocaleDateString('en-IN', { ...defaultOptions, ...options });
};

// Time ago format (e.g., "2 hours ago")
const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
};

// Slugify string (for URLs)
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')   // Remove all non-word chars
        .replace(/--+/g, '-')      // Replace multiple - with single -
        .replace(/^-+/, '')        // Trim - from start
        .replace(/-+$/, '');       // Trim - from end
};

// Calculate discount percentage
const calculateDiscount = (originalPrice, discountedPrice) => {
    if (!originalPrice || !discountedPrice) return 0;
    const discount = ((originalPrice - discountedPrice) / originalPrice) * 100;
    return Math.round(discount);
};

// Generate order ID
const generateOrderId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${timestamp}-${random}`;
};

// Generate tracking ID
const generateTrackingId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `TRK-${timestamp}-${random}`;
};

module.exports = {
    generateOTP,
    generateRandomString,
    hashPassword,
    generateSalt,
    verifyPassword,
    generateSecureToken,
    maskEmail,
    maskPhoneNumber,
    sanitizeString,
    escapeHtml,
    formatCurrency,
    formatDate,
    timeAgo,
    slugify,
    calculateDiscount,
    generateOrderId,
    generateTrackingId
};
