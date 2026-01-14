const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const logger = require('./logger');

class PaymentService {
  // Create Stripe customer
  async createCustomer(email, name) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
      });

      logger.info(`Stripe customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      logger.error('Create customer error:', error);
      throw error;
    }
  }

  // Create payment intent
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Create payment intent error:', error);
      throw error;
    }
  }

  // Retrieve payment intent
  async retrievePaymentIntent(paymentIntentId) {
    try {
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Retrieve payment intent error:', error);
      throw error;
    }
  }

  // Cancel payment intent
  async cancelPaymentIntent(paymentIntentId) {
    try {
      return await stripe.paymentIntents.cancel(paymentIntentId);
    } catch (error) {
      logger.error('Cancel payment intent error:', error);
      throw error;
    }
  }

  // Create refund
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create(refundData);

      logger.info(`Refund created: ${refund.id}`);
      return refund;
    } catch (error) {
      logger.error('Create refund error:', error);
      throw error;
    }
  }

  // Create setup intent (for saving cards)
  async createSetupIntent(customerId) {
    try {
      return await stripe.setupIntents.create({
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
      });
    } catch (error) {
      logger.error('Create setup intent error:', error);
      throw error;
    }
  }

  // List customer payment methods
  async listPaymentMethods(customerId) {
    try {
      return await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
    } catch (error) {
      logger.error('List payment methods error:', error);
      throw error;
    }
  }

  // Detach payment method
  async detachPaymentMethod(paymentMethodId) {
    try {
      return await stripe.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      logger.error('Detach payment method error:', error);
      throw error;
    }
  }

  // Create payout (for sellers)
  async createPayout(amount, destination) {
    try {
      return await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        destination,
      });
    } catch (error) {
      logger.error('Create payout error:', error);
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature, secret) {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      logger.error('Webhook verification error:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();