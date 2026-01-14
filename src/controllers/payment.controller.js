const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const logger = require('../utils/logger');

class PaymentController {
  // Create payment intent (Stripe)
  async createPaymentIntent(req, res) {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.total * 100), // Convert to cents
        currency: process.env.STRIPE_CURRENCY || 'usd',
        metadata: {
          orderId: order._id.toString(),
          userId: req.user._id.toString(),
        },
      });

      res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
      });
    } catch (error) {
      logger.error('Stripe payment intent error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment intent',
      });
    }
  }

  // Confirm payment
  async confirmPayment(req, res) {
    const { orderId, paymentIntentId } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status === 'succeeded') {
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
        order.paidAt = new Date();
        order.paymentDetails = {
          transactionId: paymentIntent.id,
          provider: 'stripe',
          paidAt: new Date(),
        };

        await order.save();

        res.json({
          success: true,
          message: 'Payment confirmed',
          data: { order },
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment not successful',
        });
      }
    } catch (error) {
      logger.error('Payment confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Payment confirmation failed',
      });
    }
  }

  // Stripe webhook
  async stripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const orderId = paymentIntent.metadata.orderId;

        const order = await Order.findById(orderId);
        if (order) {
          order.paymentStatus = 'paid';
          order.status = 'confirmed';
          order.paidAt = new Date();
          order.paymentDetails = {
            transactionId: paymentIntent.id,
            provider: 'stripe',
            paidAt: new Date(),
          };
          await order.save();

          logger.info(`Payment succeeded for order ${orderId}`);
        }
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        const failedOrderId = failedPayment.metadata.orderId;

        const failedOrder = await Order.findById(failedOrderId);
        if (failedOrder) {
          failedOrder.paymentStatus = 'failed';
          failedOrder.status = 'failed';
          await failedOrder.save();

          logger.error(`Payment failed for order ${failedOrderId}`);
        }
        break;

      default:
        logger.info(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }

  // Refund payment
  async refundPayment(req, res) {
    const { orderId, amount, reason } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order has not been paid',
      });
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: order.paymentDetails.transactionId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
        reason: reason || 'requested_by_customer',
      });

      const refundStatus = amount && amount < order.total ? 'partially_refunded' : 'refunded';

      order.paymentStatus = refundStatus;
      order.status = 'refunded';
      await order.save();

      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: { refund },
      });
    } catch (error) {
      logger.error('Refund error:', error);
      res.status(500).json({
        success: false,
        message: 'Refund failed',
      });
    }
  }
}

module.exports = new PaymentController();