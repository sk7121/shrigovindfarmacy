const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * QR Code Service for Delivery Verification
 * Handles generation, verification, and validation of QR codes
 */

class QRCodeService {
    /**
     * Generate QR code data for delivery
     * @param {Object} delivery - Delivery document
     * @returns {Object} QR code data and URL
     */
    static async generateDeliveryQRCode(delivery) {
        // Simplified QR data - only essential info to avoid "data too big" error
        const qrData = {
            d: delivery._id.toString(), // deliveryId
            q: delivery.qrCode,         // qrCode
            s: delivery.qrCodeSecret,   // secret
            t: Date.now()               // timestamp
        };

        // Create signed payload
        const payload = Buffer.from(JSON.stringify(qrData)).toString('base64');
        const signature = crypto
            .createHmac('sha256', process.env.ACCESS_SECRET || 'default-secret')
            .update(payload)
            .digest('hex');

        const qrString = `${payload}.${signature}`;

        // Use async toDataURL with error correction for larger data
        const qrCodeUrl = await QRCode.toDataURL(qrString, {
            errorCorrectionLevel: 'M',
            width: 300,
            margin: 2
        });

        return {
            qrData,
            qrString,
            qrCodeUrl: `data:image/png;base64,${qrCodeUrl.replace('data:image/png;base64,', '')}`,
            downloadUrl: `/delivery/qr/${delivery.qrCode}`
        };
    }

    /**
     * Generate QR code as image buffer
     * @param {string} data - Data to encode in QR code
     * @param {Object} options - QR code generation options
     * @returns {Buffer} PNG image buffer
     */
    static async generateQRCodeImage(data, options = {}) {
        const config = {
            width: 300,
            height: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            ...options
        };

        try {
            const qrCodeBuffer = await QRCode.toBuffer(data, {
                width: config.width,
                margin: config.margin,
                color: {
                    dark: config.color.dark,
                    light: config.color.light
                }
            });

            return qrCodeBuffer;
        } catch (error) {
            console.error('QR Code generation error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Verify QR code authenticity
     * @param {string} qrString - QR code string (payload.signature)
     * @returns {Object} Verification result
     */
    static verifyQRCode(qrString) {
        try {
            const [payloadBase64, signature] = qrString.split('.');
            
            if (!payloadBase64 || !signature) {
                return {
                    valid: false,
                    error: 'Invalid QR code format'
                };
            }

            // Verify signature
            const expectedSignature = crypto
                .createHmac('sha256', process.env.ACCESS_SECRET || 'default-secret')
                .update(payloadBase64)
                .digest('hex');

            if (signature !== expectedSignature) {
                return {
                    valid: false,
                    error: 'Invalid QR code signature'
                };
            }

            // Decode payload
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            // Check timestamp (QR code valid for 24 hours from generation)
            const now = Date.now();
            const qrAge = now - payload.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (qrAge > maxAge) {
                return {
                    valid: false,
                    error: 'QR code expired'
                };
            }

            return {
                valid: true,
                payload,
                age: qrAge
            };
        } catch (error) {
            console.error('QR Code verification error:', error);
            return {
                valid: false,
                error: 'QR code verification failed'
            };
        }
    }

    /**
     * Generate OTP for delivery verification
     * @param {number} length - OTP length (default: 6)
     * @returns {string} Generated OTP
     */
    static generateOTP(length = 6) {
        const chars = '0123456789';
        let otp = '';
        const randomBytes = crypto.randomBytes(length);
        
        for (let i = 0; i < length; i++) {
            otp += chars[randomBytes[i] % chars.length];
        }
        
        return otp;
    }

    /**
     * Generate secure token for temporary access
     * @param {Object} data - Data to encode in token
     * @param {string} expiresIn - Token expiry time (e.g., '1h', '30m')
     * @returns {string} JWT-like token
     */
    static generateSecureToken(data, expiresIn = '1h') {
        const payload = {
            ...data,
            exp: Date.now() + this.parseExpiry(expiresIn)
        };

        const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto
            .createHmac('sha256', process.env.ACCESS_SECRET || 'default-secret')
            .update(payloadBase64)
            .digest('hex');

        return `${payloadBase64}.${signature}`;
    }

    /**
     * Verify secure token
     * @param {string} token - Token to verify
     * @returns {Object} Verification result
     */
    static verifySecureToken(token) {
        try {
            const [payloadBase64, signature] = token.split('.');
            
            if (!payloadBase64 || !signature) {
                return { valid: false, error: 'Invalid token format' };
            }

            // Verify signature
            const expectedSignature = crypto
                .createHmac('sha256', process.env.ACCESS_SECRET || 'default-secret')
                .update(payloadBase64)
                .digest('hex');

            if (signature !== expectedSignature) {
                return { valid: false, error: 'Invalid token signature' };
            }

            // Decode and check expiry
            const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

            if (payload.exp < Date.now()) {
                return { valid: false, error: 'Token expired' };
            }

            return { valid: true, payload };
        } catch (error) {
            return { valid: false, error: 'Token verification failed' };
        }
    }

    /**
     * Parse expiry string to milliseconds
     * @param {string} expiry - Expiry string (e.g., '1h', '30m', '7d')
     * @returns {number} Milliseconds
     */
    static parseExpiry(expiry) {
        const match = expiry.match(/^(\d+)([hmds])$/);
        if (!match) return 3600000; // Default 1 hour

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return value * 60 * 60 * 1000;
        }
    }

    /**
     * Generate delivery label with QR code
     * @param {Object} delivery - Delivery document
     * @param {Object} order - Order document
     * @returns {Object} Label data
     */
    static async generateDeliveryLabel(delivery, order) {
        const qrData = await this.generateDeliveryQRCode(delivery);

        // Safely extract order data with fallbacks to delivery data
        const orderData = order || {};
        const orderAddress = orderData.address || orderData.shippingAddress || delivery.deliveryAddress || {};
        const deliveryAddress = delivery.deliveryAddress || orderAddress;

        const labelData = {
            deliveryId: delivery._id,
            orderId: delivery.tracking?.orderId || orderData.tracking?.orderId || delivery.order?.toString?.().slice(-4).toUpperCase() || 'N/A',
            qrCode: qrData.qrCode,
            qrCodeUrl: qrData.qrCodeUrl,
            shippingAddress: {
                fullName: orderAddress.fullName || orderAddress.name || deliveryAddress.fullName || deliveryAddress.name || 'N/A',
                address: orderAddress.address || deliveryAddress.address || 'N/A',
                city: orderAddress.city || deliveryAddress.city || 'N/A',
                state: orderAddress.state || deliveryAddress.state || 'N/A',
                pincode: orderAddress.pincode || deliveryAddress.pincode || 'N/A',
                phone: orderAddress.phone || deliveryAddress.phone || 'N/A'
            },
            items: Array.isArray(orderData.items) ? orderData.items.map(item => ({
                name: item.name,
                quantity: item.quantity
            })) : [],
            codAmount: delivery.codAmount || 0,
            priority: delivery.priority || 'standard',
            instructions: delivery.instructions || '',
            generatedAt: new Date()
        };

        return labelData;
    }

    /**
     * Validate delivery QR code against database
     * @param {string} qrCode - QR code string
     * @param {mongoose.Model} DeliveryModel - Delivery mongoose model
     * @param {Object} scanningUser - User who is scanning (for authorization check)
     * @returns {Object} Validation result
     */
    static async validateDeliveryQRCode(qrCode, DeliveryModel, scanningUser = null) {
        try {
            // Step 1: Verify the QR code format and signature
            const verification = this.verifyQRCode(qrCode);

            if (!verification.valid) {
                return {
                    valid: false,
                    error: verification.error,
                    step: 'signature_verification'
                };
            }

            // Step 2: Find delivery in database
            const delivery = await DeliveryModel.findOne({
                qrCode: verification.payload.q
            })
            .populate('order')
            .populate('assignedTo');

            if (!delivery) {
                return {
                    valid: false,
                    error: 'Delivery not found',
                    step: 'database_lookup'
                };
            }

            // Step 3: Verify secret matches (prevent QR code tampering)
            if (delivery.qrCodeSecret !== verification.payload.s) {
                return {
                    valid: false,
                    error: 'Invalid delivery credentials',
                    step: 'secret_verification'
                };
            }

            // Step 4: Check if delivery is already completed
            if (delivery.status === 'delivered') {
                return {
                    valid: false,
                    error: 'Delivery already completed',
                    delivery,
                    alreadyDelivered: true,
                    step: 'status_check'
                };
            }

            // Step 5: User Authorization Check (if scanning user provided)
            if (scanningUser) {
                const isAuthorized = await this._authorizeUserForDelivery(scanningUser, delivery);
                
                if (!isAuthorized.authorized) {
                    return {
                        valid: false,
                        error: isAuthorized.error,
                        delivery,
                        step: 'user_authorization'
                    };
                }
            }

            // All checks passed
            return {
                valid: true,
                delivery,
                payload: verification.payload,
                step: 'verified'
            };
        } catch (error) {
            console.error('Delivery QR validation error:', error);
            return {
                valid: false,
                error: 'Validation failed',
                step: 'unknown_error'
            };
        }
    }

    /**
     * Check if a user is authorized to scan/verify a delivery
     * @param {Object} user - User document (with _id, role, phone, email)
     * @param {Object} delivery - Delivery document
     * @returns {Object} Authorization result
     */
    static async _authorizeUserForDelivery(user, delivery) {
        const userId = user._id.toString();
        const userPhone = user.phone;
        const userEmail = user.email;

        // Check 1: Is the user the assigned delivery agent?
        if (delivery.assignedTo && delivery.assignedTo._id.toString() === userId) {
            return { authorized: true, reason: 'assigned_agent' };
        }

        // Check 2: Is the user the customer (by phone or email)?
        const customerPhone = delivery.deliveryAddress?.phone || 
                             delivery.order?.address?.phone || 
                             delivery.order?.shippingAddress?.phone;
        const customerEmail = delivery.deliveryAddress?.email || 
                             delivery.order?.address?.email || 
                             delivery.order?.shippingAddress?.email;

        if (customerPhone && userPhone && customerPhone === userPhone) {
            return { authorized: true, reason: 'customer_phone' };
        }

        if (customerEmail && userEmail && customerEmail === userEmail) {
            return { authorized: true, reason: 'customer_email' };
        }

        // Check 3: Is the user an admin? (allow admins to scan any delivery)
        if (user.role === 'admin' || user.role === 'superadmin') {
            return { authorized: true, reason: 'admin' };
        }

        // Check 4: Is the user a delivery agent assigned to the order?
        if (delivery.order && delivery.order.deliveryAgent) {
            if (delivery.order.deliveryAgent.toString() === userId) {
                return { authorized: true, reason: 'order_assigned_agent' };
            }
        }

        // Not authorized
        return {
            authorized: false,
            error: 'You are not authorized to verify this delivery. Only assigned delivery agents, the customer, or admins can scan this QR code.'
        };
    }
}

module.exports = QRCodeService;
