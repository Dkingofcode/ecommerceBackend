const twilio = require('twilio');
const logger = require('./logger');

class SMSService {
  constructor() {
    if (process.env.ENABLE_SMS === 'true') {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.from = process.env.TWILIO_PHONE_NUMBER;
    }
  }

  // Send SMS
  async sendSMS(to, message) {
    if (!this.client) {
      logger.warn('SMS service not configured');
      return null;
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.from,
        to,
      });

      logger.info(`SMS sent to ${to}: ${result.sid}`);
      return result;
    } catch (error) {
      logger.error('SMS sending error:', error);
      throw error;
    }
  }

  // Send OTP
  async sendOTP(phone, otp) {
    const message = `Your verification code is: ${otp}. Valid for 10 minutes.`;
    return this.sendSMS(phone, message);
  }

  // Send order notification
  async sendOrderNotification(phone, orderNumber, status) {
    const message = `Order ${orderNumber} status: ${status}. Track at ${process.env.CLIENT_URL}/orders`;
    return this.sendSMS(phone, message);
  }

  // Send delivery notification
  async sendDeliveryNotification(phone, orderNumber, trackingNumber) {
    const message = `Your order ${orderNumber} has been shipped! Tracking: ${trackingNumber}`;
    return this.sendSMS(phone, message);
  }
}

module.exports = new SMSService();