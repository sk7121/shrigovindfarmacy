const Cart = require('../models/cart');
const User = require('../models/user');
const { sendOrderConfirmation } = require('./emailService');

// Abandoned Cart Recovery Service
class AbandonedCartService {
    // Get all abandoned carts (older than 1 hour)
    static async getAbandonedCarts(hours = 1) {
        const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
        
        const abandonedCarts = await Cart.find({
            updatedAt: { $lt: cutoffTime },
            items: { $gt: [] }
        }).populate('user', 'name email');

        return abandonedCarts;
    }

    // Send abandoned cart email
    static async sendRecoveryEmail(cart) {
        if (!cart.user || !cart.user.email) {
            return { success: false, message: 'No user email found' };
        }

        // Calculate cart total
        const total = cart.items.reduce((sum, item) => {
            return sum + (item.product.price * item.quantity);
        }, 0);

        // Get product names for subject
        const productNames = cart.items.slice(0, 2).map(item => {
            return item.product.name || 'Product';
        }).join(', ');

        const mailOptions = {
            from: `"Shri Govind Pharmacy" <${process.env.EMAIL_FROM || 'noreply@shrigovindpharmacy.com'}>`,
            to: cart.user.email,
            subject: `You left ${productNames} in your cart!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #4ade80, #22c55e); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; }
                        .product { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; display: flex; align-items: center; }
                        .product img { width: 80px; height: 80px; object-fit: cover; border-radius: 5px; margin-right: 15px; }
                        .cta-button { display: inline-block; background: #4ade80; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
                        .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🛒 Don't Miss Out!</h1>
                            <p>Your cart is waiting for you</p>
                        </div>
                        <div class="content">
                            <p>Hi ${cart.user.name || 'there'},</p>
                            <p>We noticed you left some items in your cart. Don't worry, they're still reserved for you!</p>
                            
                            <h3>Items in your cart:</h3>
                            ${cart.items.map(item => `
                                <div class="product">
                                    <img src="${item.product.image || 'https://via.placeholder.com/80'}" alt="${item.product.name}">
                                    <div>
                                        <strong>${item.product.name}</strong><br>
                                        Qty: ${item.quantity} × ₹${item.product.price}<br>
                                        <strong>Total: ₹${item.product.price * item.quantity}</strong>
                                    </div>
                                </div>
                            `).join('')}
                            
                            <div style="text-align: center; margin: 20px 0;">
                                <p style="font-size: 18px;"><strong>Cart Total: ₹${total.toFixed(2)}</strong></p>
                            </div>
                            
                            <div style="text-align: center;">
                                <a href="${process.env.BASE_URL || 'http://localhost:8080'}/user/cart" class="cta-button">
                                    Complete Your Purchase →
                                </a>
                            </div>
                            
                            <p style="color: #666; font-size: 14px; margin-top: 20px;">
                                ⏰ Hurry! Items in your cart are selling fast. Complete your purchase now to secure your items.
                            </p>
                        </div>
                        <div class="footer">
                            <p>© 2025 Shri Govind Pharmacy. All rights reserved.</p>
                            <p>Need help? Contact us at support@shrigovindpharmacy.com</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        try {
            const transporter = require('./emailService').transporter;
            if (!transporter) {
                return { success: false, message: 'Email transporter not configured' };
            }

            await transporter.sendMail(mailOptions);
            console.log(`✅ Abandoned cart email sent to: ${cart.user.email}`);
            
            // Update cart to mark email sent
            cart.lastEmailSent = new Date();
            cart.emailCount = (cart.emailCount || 0) + 1;
            await cart.save();
            
            return { success: true, message: 'Recovery email sent' };
        } catch (error) {
            console.error('❌ Abandoned cart email error:', error);
            return { success: false, message: error.message };
        }
    }

    // Send recovery emails for all abandoned carts
    static async sendRecoveryEmails() {
        try {
            const abandonedCarts = await this.getAbandonedCarts(1); // 1 hour
            let sent = 0;
            let failed = 0;

            for (const cart of abandonedCarts) {
                // Don't send more than 3 emails
                if ((cart.emailCount || 0) >= 3) {
                    continue;
                }

                // Don't send if email sent in last 24 hours
                if (cart.lastEmailSent && (Date.now() - cart.lastEmailSent.getTime()) < 24 * 60 * 60 * 1000) {
                    continue;
                }

                const result = await this.sendRecoveryEmail(cart);
                if (result.success) {
                    sent++;
                } else {
                    failed++;
                }
            }

            return {
                success: true,
                message: `Sent ${sent} recovery emails, ${failed} failed`
            };
        } catch (error) {
            console.error('Abandoned cart recovery error:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = AbandonedCartService;
