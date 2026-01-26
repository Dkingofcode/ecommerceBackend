const nodemailer = require('nodemailer');

const BASE_URL =
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

/**
 * Create SendGrid SMTP transporter
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtp.sendgrid.net
  port: Number(process.env.SMTP_PORT), // 587
  secure: false,
  auth: {
    user: process.env.SMTP_USER, // MUST be "apikey"
    pass: process.env.SMTP_PASS, // SendGrid API key
  },
});

/**
 * Verify transporter ONCE at startup
 */
transporter.verify((err) => {
  if (err) {
    console.error('❌ SendGrid SMTP failed:', err.message);
  } else {
    console.log('✅ SendGrid SMTP ready');
  }
});

/**
 * Send verification email
 */
exports.sendVerificationEmail = async (email, firstName, rawToken) => {
  if (process.env.ENABLE_EMAIL !== 'true') {
    console.log('📧 Email disabled. Verification token:', rawToken);
    return;
  }

  const verifyUrl = `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(
    rawToken
  )}`;

  try {
    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Verify your email address',
      html: `
        <h2>Hello ${firstName || 'there'},</h2>
        <p>Please verify your email address:</p>

        <p>
          <a href="${verifyUrl}"
             style="padding:12px 20px;background:#4CAF50;color:#fff;
                    text-decoration:none;border-radius:5px;">
            Verify Email
          </a>
        </p>

        <p>This link expires in 1 hour.</p>
        <p>${verifyUrl}</p>
      `,
      text: `
Hello ${firstName || 'there'},

Verify your email:
${verifyUrl}

This link expires in 1 hour.
      `,
    });

    console.log(`✅ Verification email sent to ${email}`);
  } catch (err) {
    console.error('❌ Verification email failed:', err.message);
    // IMPORTANT: never crash auth flow
  }
};

/**
 * Send password reset email
 */
exports.sendPasswordResetEmail = async (email, firstName, rawToken) => {
  if (process.env.ENABLE_EMAIL !== 'true') return;

  const resetUrl = `${BASE_URL}/api/auth/reset-password?token=${encodeURIComponent(
    rawToken
  )}`;

  try {
    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Hello ${firstName || 'there'},</h2>
        <p>You requested a password reset.</p>

        <p>
          <a href="${resetUrl}"
             style="padding:12px 20px;background:#2196F3;color:#fff;
                    text-decoration:none;border-radius:5px;">
            Reset Password
          </a>
        </p>

        <p>This link expires in 10 minutes.</p>
      `,
    });

    console.log(`✅ Password reset email sent to ${email}`);
  } catch (err) {
    console.error('❌ Password reset email failed:', err.message);
  }
};
