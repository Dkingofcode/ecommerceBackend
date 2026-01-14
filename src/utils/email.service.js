const sgMail = require('@sendgrid/mail');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Init SendGrid
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
  logger.info('SendGrid initialized');
} else {
  logger.warn('SENDGRID_API_KEY missing — emails will be skipped');
}

class EmailService {
  constructor() {
    this.emailEnabled = Boolean(SENDGRID_KEY);
    this.fromEmail = process.env.EMAIL_FROM;
    this.fromName = process.env.EMAIL_FROM_NAME || process.env.APP_NAME || 'Ecommerce App';

    if (!this.fromEmail) {
      logger.warn('EMAIL_FROM not set — emails will be skipped');
      this.emailEnabled = false;
    }
  }

  // Load Handlebars template (safe fallback)
  async loadTemplate(templateName, data) {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src',
        'templates',
        'emails',
        `${templateName}.hbs`
      );

      const content = await fs.readFile(templatePath, 'utf-8');
      const template = handlebars.compile(content);
      return template(data);
    } catch (err) {
      logger.warn(`Template "${templateName}" not found — using fallback`);
      return `
        <p>Hello ${data.firstName || ''},</p>
        <p>Please continue here:</p>
        <a href="${data.verificationUrl || data.resetUrl || '#'}">Continue</a>
        <p>${process.env.APP_NAME}</p>
      `;
    }
  }

  // Core sender (NEVER throws)
  async sendEmail({ to, subject, html }) {
    if (!this.emailEnabled) {
      logger.info(`📧 Email skipped → ${to}`);
      return;
    }

    const msg = {
      to,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ''),
    };

    try {
      await sgMail.send(msg);
      logger.info(`✅ Email sent to ${to}`);
    } catch (err) {
      logger.error('❌ Email sending failed:', err.response?.body || err.message);
      // DO NOT throw — auth flow must continue
    }
  }

  async sendVerificationEmail(email, firstName, token) {
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    const html = await this.loadTemplate('verification', {
      firstName,
      verificationUrl,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html,
    });
  }

  async sendPasswordResetEmail(email, firstName, token) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    const html = await this.loadTemplate('password-reset', {
      firstName,
      resetUrl,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html,
    });
  }

  async sendWelcomeEmail(email, firstName) {
    const html = await this.loadTemplate('welcome', {
      firstName,
      loginUrl: `${process.env.CLIENT_URL}/login`,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: email,
      subject: `Welcome to ${process.env.APP_NAME}!`,
      html,
    });
  }

  async sendOrderConfirmation(email, order) {
    const html = await this.loadTemplate('order-confirmation', {
      orderNumber: order.orderNumber,
      total: order.total,
      items: order.items,
      shippingAddress: order.shippingAddress,
      orderUrl: `${process.env.CLIENT_URL}/orders/${order._id}`,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: email,
      subject: `Order Confirmation - ${order.orderNumber}`,
      html,
    });
  }

  async sendOrderStatusUpdate(email, order) {
    const html = await this.loadTemplate('order-status', {
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber,
      orderUrl: `${process.env.CLIENT_URL}/orders/${order._id}`,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: email,
      subject: `Order Update - ${order.orderNumber}`,
      html,
    });
  }

  async sendOrderCancellation(email, order) {
    const html = await this.loadTemplate('order-cancellation', {
      orderNumber: order.orderNumber,
      reason: order.cancellationReason,
      refundAmount: order.total,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: email,
      subject: `Order Cancelled - ${order.orderNumber}`,
      html,
    });
  }

 

  async sendLowStockAlert(adminEmail, product) {
    const html = await this.loadTemplate('low-stock-alert', {
      productName: product.name,
      sku: product.sku,
      currentStock: product.stock.quantity,
      threshold: product.stock.lowStockThreshold,
      productUrl: `${process.env.ADMIN_URL}/products/${product._id}`,
      appName: process.env.APP_NAME,
    });

    this.sendEmail({
      to: adminEmail,
      subject: `Low Stock Alert - ${product.name}`,
      html,
    });
  }

  async sendNewsletter(emails, subject, content) {
    const html = await this.loadTemplate('newsletter', {
      content,
      appName: process.env.APP_NAME,
      unsubscribeUrl: `${process.env.CLIENT_URL}/unsubscribe`,
    });

    emails.forEach(email => {
      this.sendEmail({ to: email, subject, html });
    });
  }
}

module.exports = new EmailService();
