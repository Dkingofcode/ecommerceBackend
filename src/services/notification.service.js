const logger = require('../utils/logger');
const emailService = require('../utils/email.service');
const smsService = require('../utils/sms.service');

class NotificationService {
  // Send notification (email, SMS, push)
  async sendNotification(user, type, data) {
    try {
      // Send email
      if (user.email && this.shouldSendEmail(type)) {
        await this.sendEmailNotification(user, type, data);
      }

      // Send SMS
      if (user.phone && this.shouldSendSMS(type)) {
        await this.sendSMSNotification(user, type, data);
      }

      // TODO: Add push notification support

      logger.info(`Notification sent to user ${user._id}: ${type}`);
    } catch (error) {
      logger.error('Notification error:', error);
    }
  }

  // Send email notification
  async sendEmailNotification(user, type, data) {
    switch (type) {
      case 'order_confirmed':
        await emailService.sendOrderConfirmation(user.email, data.order);
        break;

      case 'order_shipped':
        await emailService.sendOrderStatusUpdate(user.email, data.order);
        break;

      case 'order_delivered':
        await emailService.sendOrderStatusUpdate(user.email, data.order);
        break;

      case 'order_cancelled':
        await emailService.sendOrderCancellation(user.email, data.order);
        break;

      case 'welcome':
        await emailService.sendWelcomeEmail(user.email, user.firstName);
        break;

      default:
        logger.warn(`Unknown email notification type: ${type}`);
    }
  }

  // Send SMS notification
  async sendSMSNotification(user, type, data) {
    switch (type) {
      case 'order_confirmed':
        await smsService.sendOrderNotification(
          user.phone,
          data.order.orderNumber,
          'confirmed'
        );
        break;

      case 'order_shipped':
        await smsService.sendDeliveryNotification(
          user.phone,
          data.order.orderNumber,
          data.order.trackingNumber
        );
        break;

      default:
        logger.warn(`Unknown SMS notification type: ${type}`);
    }
  }

  // Check if email should be sent for this notification type
  shouldSendEmail(type) {
    const emailTypes = [
      'order_confirmed',
      'order_shipped',
      'order_delivered',
      'order_cancelled',
      'welcome',
      'password_reset',
      'email_verification',
    ];

    return emailTypes.includes(type);
  }

  // Check if SMS should be sent for this notification type
  shouldSendSMS(type) {
    const smsTypes = ['order_confirmed', 'order_shipped', 'otp'];

    return smsTypes.includes(type);
  }

  // Batch send notifications
  async sendBatchNotifications(users, type, data) {
    const promises = users.map(user =>
      this.sendNotification(user, type, data)
    );

    return Promise.allSettled(promises);
  }
}

module.exports = new NotificationService();