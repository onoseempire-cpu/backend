import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;

    if (!env.SMTP_HOST || !env.SMTP_USER) {
      // No SMTP configured — log instead of sending (useful for local dev)
      logger.warn('Email service: No SMTP configured. Emails will be logged only.');
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    } else {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    }
    return this.transporter;
  }

  async sendEmailVerification(toEmail: string, token: string): Promise<void> {
    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    await this.send(toEmail, 'Verify your PMAV email address', `
      <h2>Welcome to Program Maker Analytical Viewer</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Verify Email</a>
      <p>Or paste this URL: ${verifyUrl}</p>
      <p>This link expires in 24 hours.</p>
    `);
  }

  async sendPasswordReset(toEmail: string, token: string): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.send(toEmail, 'Reset your PMAV password', `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset Password</a>
      <p>Or paste this URL: ${resetUrl}</p>
      <p>This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
    `);
  }

  async sendSyncComplete(toEmail: string, stats: { processed: number; failed: number }): Promise<void> {
    await this.send(toEmail, 'PMAV Sync Complete', `
      <h2>Data Sync Complete</h2>
      <p>Your analytics sync has finished:</p>
      <ul>
        <li>✅ Records processed: <strong>${stats.processed}</strong></li>
        <li>${stats.failed > 0 ? `⚠️ Failed: <strong>${stats.failed}</strong>` : '✅ No errors'}</li>
      </ul>
      <p>Log in to view your updated analytics.</p>
    `);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      const transport = this.getTransporter();
      const info = await transport.sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        html,
      });
      logger.info('Email sent', { to, subject, messageId: (info as { messageId?: string }).messageId });
    } catch (err) {
      logger.error('Email send failed', { to, subject, error: err });
      // Don't throw — email failures should not break the main flow
    }
  }
}

export const emailService = new EmailService();
