import nodemailer from 'nodemailer';

export default function createSmtpModule({ env }) {
  let transporter;
  return {
    isConfigured: () => Boolean(env.SMTP_HOST),
    async send(message) {
      transporter ||= nodemailer.createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true', auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined, disableFileAccess: true, disableUrlAccess: true });
      const result = await transporter.sendMail({ from: message.from || env.MAIL_FROM, to: message.to, replyTo: message.replyTo, subject: message.subject, html: message.html, text: message.text });
      return { id: result.messageId, accepted: result.accepted };
    }
  };
}
