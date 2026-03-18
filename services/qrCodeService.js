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
        const qrData = {
            deliveryId: delivery._id.toString(),
            qrCode: delivery.qrCode,
            secret: delivery.qrCodeSecret,
            orderId: delivery.order.toString(),
            timestamp: Date.now(),
            type: 'delivery_verification'
        };

        // Create signed payload
        const payload = Buffer.from(JSON.stringify(qrData)).toString('base64');
        const signature = crypto
            .createHmac('sha256', process.env.ACCESS_SECRET || 'default-secret')
            .update(payload)
            .digest('hex');

        const qrString = `${payload}.${signature}`;

        // Use async toDataURL instead of deprecated toDataURLSync
        const qrCodeUrl = await QRCode.toDataURL(qrString);

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

        const labelData = {
            deliveryId: delivery._id,
            orderId: delivery.tracking?.orderId || order.tracking?.orderId,
            qrCode: qrData.qrCode,
            qrCodeUrl: qrData.qrCodeUrl,
            shippingAddress: {
                fullName: order.address?.fullName || delivery.deliveryAddress?.fullName,
                address: order.address?.address || delivery.deliveryAddress?.address,
                city: order.address?.city || delivery.deliveryAddress?.city,
                state: order.address?.state || delivery.deliveryAddress?.state,
                pincode: order.address?.pincode || delivery.deliveryAddress?.pincode,
                phone: order.address?.phone || delivery.deliveryAddress?.phone
            },
            items: order.items?.map(item => ({
                name: item.name,
                quantity: item.quantity
            })) || [],
            codAmount: delivery.codAmount,
            priority: delivery.priority,
            instructions: delivery.instructions,
            generatedAt: new Date()
        };

        return labelData;
    }

    /**
     * Validate delivery QR code against database
     * @param {string} qrCode - QR code string
     * @param {mongoose.Model} DeliveryModel - Delivery mongoose model
     * @returns {Object} Validation result
     */
    static async validateDeliveryQRCode(qrCode, DeliveryModel) {
        try {
            // First verify the QR code format and signature
            const verification = this.verifyQRCode(qrCode);
            
            if (!verification.valid) {
                return {
                    valid: false,
                    error: verification.error
                };
            }

            // Find delivery in database
            const delivery = await DeliveryModel.findOne({
                qrCode: verification.payload.qrCode
            }).populate('order assignedTo');

            if (!delivery) {
                return {
                    valid: false,
                    error: 'Delivery not found'
                };
            }

            // Verify secret matches
            if (delivery.qrCodeSecret !== verification.payload.secret) {
                return {
                    valid: false,
                    error: 'Invalid delivery credentials'
                };
            }

            // Check if delivery is already completed
            if (delivery.status === 'delivered') {
                return {
                    valid: false,
                    error: 'Delivery already completed',
                    delivery,
                    alreadyDelivered: true
                };
            }

            return {
                valid: true,
                delivery,
                payload: verification.payload
            };
        } catch (error) {
            console.error('Delivery QR validation error:', error);
            return {
                valid: false,
                error: 'Validation failed'
            };
        }
    }
}

module.exports = QRCodeService;
