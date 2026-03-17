const Delivery = require('../models/delivery');
const DeliveryAgent = require('../models/deliveryAgent');
const ShippingPartner = require('../models/shippingPartner');
const Order = require('../models/order');
const QRCodeService = require('./qrCodeService');
const { sendOrderStatusUpdate } = require('./emailService');
const { sendOrderStatusSMS } = require('./smsService');

/**
 * Delivery Service
 * Handles all delivery-related operations including assignment, tracking, and status management
 */

class DeliveryService {
    /**
     * Create a new delivery for an order
     * @param {Object} order - Order document
     * @param {Object} options - Delivery options
     * @returns {Object} Created delivery
     */
    static async createDelivery(order, options = {}) {
        try {
            // Create delivery address snapshot
            const deliveryAddress = {
                fullName: order.address?.fullName,
                phone: order.address?.phone,
                address: order.address?.address,
                city: order.address?.city,
                state: order.address?.state,
                pincode: order.address?.pincode,
                landmark: order.address?.landmark
            };

            // Determine delivery type and assignment
            const deliveryData = {
                order: order._id,
                deliveryAddress,
                priority: options.priority || 'normal',
                instructions: options.instructions || '',
                codAmount: order.payment?.method === 'cod' ? order.pricing?.total : 0
            };

            // Set estimated delivery based on priority
            const now = new Date();
            switch (deliveryData.priority) {
                case 'same_day':
                    deliveryData.estimatedDelivery = new Date(now.setHours(23, 59, 59, 999));
                    deliveryData.scheduledSlot = options.slot || 'anytime';
                    break;
                case 'express':
                    deliveryData.estimatedDelivery = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    break;
                case 'scheduled':
                    deliveryData.estimatedDelivery = options.scheduledDate || new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
                    deliveryData.scheduledSlot = options.slot || 'anytime';
                    break;
                default:
                    deliveryData.estimatedDelivery = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            }

            // Assign shipping partner if specified
            if (options.shippingPartner) {
                deliveryData.shippingPartner = options.shippingPartner;
            }

            // Create delivery
            const delivery = new Delivery(deliveryData);
            
            // Add initial timeline entry
            delivery.timeline.push({
                status: 'pending_assignment',
                timestamp: new Date(),
                notes: 'Delivery created and waiting for agent assignment'
            });

            await delivery.save();

            // Generate QR code label
            const qrLabel = QRCodeService.generateDeliveryLabel(delivery, order);
            delivery.qrLabel = qrLabel;

            return { delivery, qrLabel };
        } catch (error) {
            console.error('Create delivery error:', error);
            throw error;
        }
    }

    /**
     * Auto-assign delivery to best available agent
     * @param {Object} delivery - Delivery document
     * @returns {Object} Assignment result
     */
    static async autoAssignDelivery(delivery) {
        try {
            // Find available agents in the delivery area
            const availableAgents = await DeliveryAgent.find({
                isActive: true,
                isAvailable: true,
                currentStatus: { $in: ['idle', 'on_delivery'] }
            }).populate('coverageAreas');

            if (availableAgents.length === 0) {
                return {
                    success: false,
                    message: 'No available agents found',
                    delivery
                };
            }

            // Score agents based on various factors
            const scoredAgents = availableAgents.map(agent => {
                let score = 100;

                // Current workload (lower is better)
                const workloadFactor = 1 - (agent.currentDeliveries / agent.maxConcurrentDeliveries);
                score += workloadFactor * 30;

                // Performance rating
                score += agent.stats.averageRating * 5;

                // On-time delivery rate
                score += agent.stats.onTimeDeliveryRate * 0.2;

                // Check if delivery area matches agent's coverage
                if (agent.coverageAreas && agent.coverageAreas.length > 0) {
                    const inCoverage = agent.coverageAreas.some(area => 
                        area.pincode === delivery.deliveryAddress.pincode
                    );
                    if (inCoverage) score += 20;
                }

                return { agent, score };
            });

            // Sort by score and pick best
            scoredAgents.sort((a, b) => b.score - a.score);
            const bestAgent = scoredAgents[0].agent;

            // Assign delivery to agent
            return await this.assignDeliveryToAgent(delivery, bestAgent);
        } catch (error) {
            console.error('Auto-assign delivery error:', error);
            return {
                success: false,
                message: 'Auto-assignment failed',
                error: error.message
            };
        }
    }

    /**
     * Assign delivery to a specific agent
     * @param {Object} delivery - Delivery document or ID
     * @param {Object} agent - DeliveryAgent document or ID
     * @param {Object} options - Assignment options
     * @returns {Object} Assignment result
     */
    static async assignDeliveryToAgent(delivery, agent, options = {}) {
        try {
            const deliveryDoc = typeof delivery === 'string' 
                ? await Delivery.findById(delivery) 
                : delivery;

            const agentDoc = typeof agent === 'string'
                ? await DeliveryAgent.findById(agent)
                : agent;

            if (!deliveryDoc) {
                return { success: false, message: 'Delivery not found' };
            }

            if (!agentDoc) {
                return { success: false, message: 'Agent not found' };
            }

            if (!agentDoc.canAcceptDelivery()) {
                return { 
                    success: false, 
                    message: 'Agent cannot accept more deliveries',
                    reason: agentDoc.isAvailable ? 'Agent unavailable' : 'Agent at max capacity'
                };
            }

            // Update delivery
            deliveryDoc.assignedTo = agentDoc._id;
            deliveryDoc.assignedAt = new Date();
            
            if (options.notes) {
                deliveryDoc.instructions = options.notes;
            }

            await deliveryDoc.updateStatus('assigned', `Assigned to agent ${agentDoc.name}`, '', agentDoc._id);

            // Update agent's current deliveries count
            agentDoc.currentDeliveries += 1;
            if (agentDoc.currentDeliveries > 0) {
                agentDoc.currentStatus = 'on_delivery';
            }
            await agentDoc.save();

            // Notify agent (via push notification in real implementation)
            console.log(`Delivery assigned to agent: ${agentDoc.name}`);

            return {
                success: true,
                message: 'Delivery assigned successfully',
                delivery: deliveryDoc,
                agent: agentDoc
            };
        } catch (error) {
            console.error('Assign delivery error:', error);
            return {
                success: false,
                message: 'Assignment failed',
                error: error.message
            };
        }
    }

    /**
     * Update delivery status
     * @param {string} deliveryId - Delivery ID
     * @param {string} newStatus - New status
     * @param {Object} context - Update context (agent, location, notes, etc.)
     * @returns {Object} Update result
     */
    static async updateDeliveryStatus(deliveryId, newStatus, context = {}) {
        try {
            const delivery = await Delivery.findById(deliveryId)
                .populate('order')
                .populate('assignedTo');

            if (!delivery) {
                return { success: false, message: 'Delivery not found' };
            }

            const { agent, location, notes, proof } = context;

            // Handle status-specific logic
            if (newStatus === 'delivered') {
                // Add delivery attempt
                await delivery.addAttempt('success', '', notes, agent?._id, proof);
                
                // Update agent stats
                if (agent) {
                    agent.stats.successfulDeliveries += 1;
                    agent.currentDeliveries = Math.max(0, agent.currentDeliveries - 1);
                    if (agent.currentDeliveries === 0) {
                        agent.currentStatus = 'idle';
                    }
                    await agent.save();
                }

                // Send notifications
                await this.sendDeliveryNotifications(delivery, 'delivered');

            } else if (newStatus === 'failed_attempt') {
                await delivery.addAttempt('failed', notes, '', agent?._id);
                
            } else if (newStatus === 'picked_up') {
                // Update agent status
                if (agent) {
                    agent.currentStatus = 'on_delivery';
                    await agent.save();
                }
            }

            // Update delivery status
            const locationStr = location ? 
                `${location.latitude},${location.longitude}` : '';
            
            await delivery.updateStatus(newStatus, notes || '', locationStr, agent?._id);

            // Send status update notifications for key statuses
            if (['out_for_delivery', 'delivered'].includes(newStatus)) {
                await this.sendDeliveryNotifications(delivery, newStatus);
            }

            return {
                success: true,
                message: 'Status updated successfully',
                delivery
            };
        } catch (error) {
            console.error('Update delivery status error:', error);
            return {
                success: false,
                message: 'Status update failed',
                error: error.message
            };
        }
    }

    /**
     * Mark delivery as delivered with proof
     * @param {string} deliveryId - Delivery ID
     * @param {Object} proof - Delivery proof (photo, signature, OTP)
     * @param {Object} agent - Agent who made the delivery
     * @returns {Object} Result
     */
    static async markAsDelivered(deliveryId, proof = {}, agent = null) {
        try {
            const delivery = await Delivery.findById(deliveryId)
                .populate('order')
                .populate('assignedTo');

            if (!delivery) {
                return { success: false, message: 'Delivery not found' };
            }

            // Verify QR code if provided
            if (proof.qrCodeVerified) {
                // QR code was verified by agent app
                console.log('QR code verified for delivery:', delivery.qrCode);
            }

            // Add successful delivery attempt
            await delivery.addAttempt('success', '', 'Delivery completed successfully', agent?._id, {
                photo: proof.photo,
                signature: proof.signature,
                otp: proof.otp
            });

            // Mark as delivered
            delivery.status = 'delivered';
            delivery.actualDelivery = new Date();
            
            if (delivery.codAmount > 0) {
                delivery.codCollected = true;
                delivery.codCollectedAt = new Date();
            }

            await delivery.save();

            // Update related order
            if (delivery.order) {
                await Order.findByIdAndUpdate(delivery.order._id, {
                    status: 'delivered'
                });
            }

            // Update agent stats
            if (agent) {
                agent.stats.successfulDeliveries += 1;
                agent.currentDeliveries = Math.max(0, agent.currentDeliveries - 1);
                if (agent.currentDeliveries === 0) {
                    agent.currentStatus = 'idle';
                }
                await agent.save();
            }

            // Send notifications
            await this.sendDeliveryNotifications(delivery, 'delivered');

            return {
                success: true,
                message: 'Delivery marked as completed',
                delivery
            };
        } catch (error) {
            console.error('Mark as delivered error:', error);
            return {
                success: false,
                message: 'Failed to mark as delivered',
                error: error.message
            };
        }
    }

    /**
     * Send delivery notifications to customer
     * @param {Object} delivery - Delivery document
     * @param {string} status - New status
     */
    static async sendDeliveryNotifications(delivery, status) {
        try {
            if (!delivery.order) return;

            const order = typeof delivery.order === 'object' ? delivery.order : 
                await Order.findById(delivery.order).populate('user');

            if (!order || !order.user) return;

            const customer = order.user;
            const statusMessages = {
                'assigned': 'Your order has been assigned to a delivery agent',
                'picked_up': 'Your order has been picked up from our warehouse',
                'in_transit': 'Your order is on the way',
                'out_for_delivery': 'Your order is out for delivery',
                'delivered': 'Your order has been delivered successfully',
                'failed_attempt': 'Delivery attempt failed. We will try again soon',
                'rescheduled': 'Your delivery has been rescheduled'
            };

            const message = statusMessages[status] || 'Your order status has been updated';

            // Send email
            try {
                await sendOrderStatusUpdate(customer.email, order, status);
            } catch (emailErr) {
                console.error('Email notification error:', emailErr.message);
            }

            // Send SMS
            try {
                await sendOrderStatusSMS(customer.phone, order, status);
            } catch (smsErr) {
                console.error('SMS notification error:', smsErr.message);
            }

            console.log(`Notifications sent for order ${order._id}, status: ${status}`);
        } catch (error) {
            console.error('Send notifications error:', error);
        }
    }

    /**
     * Get delivery tracking information
     * @param {string} deliveryId - Delivery ID or QR code
     * @returns {Object} Tracking information
     */
    static async getTrackingInfo(deliveryId) {
        try {
            const delivery = await Delivery.findOne({
                $or: [{ _id: deliveryId }, { qrCode: deliveryId }]
            })
            .populate('order')
            .populate('assignedTo', 'name phone vehicleType vehicleNumber')
            .populate('shippingPartner');

            if (!delivery) {
                return { success: false, message: 'Delivery not found' };
            }

            const trackingInfo = {
                deliveryId: delivery._id,
                qrCode: delivery.qrCode,
                status: delivery.status,
                timeline: delivery.timeline,
                estimatedDelivery: delivery.estimatedDelivery,
                actualDelivery: delivery.actualDelivery,
                agent: delivery.assignedTo ? {
                    name: delivery.assignedTo.name,
                    phone: delivery.assignedTo.phone,
                    vehicleType: delivery.assignedTo.vehicleType,
                    vehicleNumber: delivery.assignedTo.vehicleNumber
                } : null,
                shippingPartner: delivery.shippingPartner ? {
                    name: delivery.shippingPartner.name,
                    code: delivery.shippingPartner.code,
                    trackingUrl: delivery.shippingPartner.apiIntegration?.trackingUrlTemplate
                        ? delivery.shippingPartner.apiIntegration.trackingUrlTemplate.replace(
                            '{tracking_id}',
                            delivery.externalTrackingId
                        )
                        : null
                } : null,
                deliveryAddress: delivery.deliveryAddress,
                codAmount: delivery.codAmount,
                instructions: delivery.instructions
            };

            return { success: true, trackingInfo };
        } catch (error) {
            console.error('Get tracking info error:', error);
            return {
                success: false,
                message: 'Failed to get tracking info',
                error: error.message
            };
        }
    }

    /**
     * Get deliveries dashboard statistics
     * @returns {Object} Dashboard statistics
     */
    static async getDashboardStats() {
        try {
            const stats = await Delivery.getStatistics();
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Today's deliveries
            const todayDeliveries = await Delivery.countDocuments({
                createdAt: { $gte: today, $lt: tomorrow }
            });

            // Pending deliveries
            const pendingDeliveries = await Delivery.countDocuments({
                status: { $in: ['pending_assignment', 'assigned', 'picked_up'] }
            });

            // Out for delivery
            const outForDelivery = await Delivery.countDocuments({
                status: 'out_for_delivery'
            });

            // COD to collect
            const codPending = await Delivery.aggregate([
                { $match: { status: { $ne: 'delivered' }, codAmount: { $gt: 0 } } },
                { $group: { _id: null, total: { $sum: '$codAmount' } } }
            ]);

            return {
                total: await Delivery.countDocuments(),
                byStatus: stats,
                today: todayDeliveries,
                pending: pendingDeliveries,
                outForDelivery,
                codPending: codPending[0]?.total || 0,
                agents: {
                    total: await DeliveryAgent.countDocuments(),
                    active: await DeliveryAgent.countDocuments({ isActive: true, isAvailable: true }),
                    onDelivery: await DeliveryAgent.countDocuments({ currentStatus: 'on_delivery' })
                },
                partners: {
                    total: await ShippingPartner.countDocuments(),
                    active: await ShippingPartner.countDocuments({ isActive: true })
                }
            };
        } catch (error) {
            console.error('Get dashboard stats error:', error);
            return null;
        }
    }

    /**
     * Reassign delivery to different agent
     * @param {string} deliveryId - Delivery ID
     * @param {string} newAgentId - New agent ID
     * @param {string} reason - Reassignment reason
     * @returns {Object} Result
     */
    static async reassignDelivery(deliveryId, newAgentId, reason = '') {
        try {
            const delivery = await Delivery.findById(deliveryId).populate('assignedTo');
            const newAgent = await DeliveryAgent.findById(newAgentId);

            if (!delivery) {
                return { success: false, message: 'Delivery not found' };
            }

            if (!newAgent || !newAgent.canAcceptDelivery()) {
                return { success: false, message: 'New agent not available' };
            }

            // Decrement old agent's count
            if (delivery.assignedTo) {
                delivery.assignedTo.currentDeliveries = Math.max(0, delivery.assignedTo.currentDeliveries - 1);
                if (delivery.assignedTo.currentDeliveries === 0) {
                    delivery.assignedTo.currentStatus = 'idle';
                }
                await delivery.assignedTo.save();
            }

            // Assign to new agent
            delivery.assignedTo = newAgent._id;
            delivery.assignedAt = new Date();
            
            await delivery.updateStatus('assigned', `Reassigned: ${reason}`, '', newAgent._id);

            // Increment new agent's count
            newAgent.currentDeliveries += 1;
            newAgent.currentStatus = 'on_delivery';
            await newAgent.save();

            return {
                success: true,
                message: 'Delivery reassigned successfully',
                delivery
            };
        } catch (error) {
            console.error('Reassign delivery error:', error);
            return {
                success: false,
                message: 'Reassignment failed',
                error: error.message
            };
        }
    }

    /**
     * Cancel delivery
     * @param {string} deliveryId - Delivery ID
     * @param {string} reason - Cancellation reason
     * @param {Object} cancelledBy - User who cancelled
     * @returns {Object} Result
     */
    static async cancelDelivery(deliveryId, reason, cancelledBy = null) {
        try {
            const delivery = await Delivery.findById(deliveryId).populate('assignedTo');

            if (!delivery) {
                return { success: false, message: 'Delivery not found' };
            }

            // Update agent if assigned
            if (delivery.assignedTo) {
                delivery.assignedTo.currentDeliveries = Math.max(0, delivery.assignedTo.currentDeliveries - 1);
                if (delivery.assignedTo.currentDeliveries === 0) {
                    delivery.assignedTo.currentStatus = 'idle';
                }
                await delivery.assignedTo.save();
            }

            // Update delivery status
            delivery.status = 'cancelled';
            delivery.returnReason = reason;
            delivery.timeline.push({
                status: 'cancelled',
                timestamp: new Date(),
                notes: `Cancelled: ${reason}`,
                updatedBy: cancelledBy?._id
            });

            await delivery.save();

            // Update order status
            if (delivery.order) {
                await Order.findByIdAndUpdate(delivery.order, {
                    status: 'cancelled',
                    'tracking.cancelledAt': new Date(),
                    'tracking.cancellationReason': reason
                });
            }

            return {
                success: true,
                message: 'Delivery cancelled successfully',
                delivery
            };
        } catch (error) {
            console.error('Cancel delivery error:', error);
            return {
                success: false,
                message: 'Cancellation failed',
                error: error.message
            };
        }
    }
}

module.exports = DeliveryService;
