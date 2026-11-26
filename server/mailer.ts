// Outgoing email: SMTP through nodemailer (Mailpit locally, a provider in
// production), or the console in development when no SMTP host is set.

import nodemailer from "nodemailer";
import type { Mode, SmtpEnv } from "./env";

export type Email = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  send(email: Email): Promise<void>;
}

export const DEFAULT_FROM = "Breathband <no-reply@breathband.local>";

/** The subset of a nodemailer transport the mailer uses; tests pass a fake. */
export type Transport = { sendMail(message: Email & { from: string }): Promise<unknown> };

export function createSmtpMailer(smtp: SmtpEnv & { host: string }, transport?: Transport): Mailer {
  const from = smtp.from ?? DEFAULT_FROM;
  const smtpTransport =
    transport ??
    nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      // 465 is implicit TLS; other ports upgrade with STARTTLS when the server offers it.
      secure: smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
  return {
    async send(email) {
      await smtpTransport.sendMail({ from, ...email });
    },
  };
}

/** Prints the email instead of sending it. Development and tests only: the text holds live links. */
export function createConsoleMailer(log: (line: string) => void = console.log): Mailer {
  return {
    async send(email) {
      log(`[mail] to ${email.to}: ${email.subject}\n${email.text}`);
    },
  };
}

/** SMTP when SMTP_HOST is set; otherwise the console, which production refuses. */
export function createMailer(mode: Mode, smtp: SmtpEnv): Mailer {
  if (smtp.host) return createSmtpMailer({ ...smtp, host: smtp.host });
  if (mode === "production") {
    throw new Error("SMTP_HOST is required in production: auth sends verification and reset emails.");
  }
  return createConsoleMailer();
}

export function verificationEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Confirm your email for Breathband",
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your Breathband account:\n\n${url}\n\nIf you didn't sign up, you can ignore this email.\n`,
    html: page(
      `<p>Hi ${escapeHtml(name)},</p>` +
        `<p>Confirm your email address to finish setting up your Breathband account.</p>` +
        `<p><a href="${escapeHtml(url)}">Confirm my email</a></p>` +
        `<p>If you didn't sign up, you can ignore this email.</p>`,
    ),
  };
}

export function resetPasswordEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Reset your Breathband password",
    text: `Hi ${name},\n\nSomeone asked to reset the password for this Breathband account. Choose a new one here (the link works for one hour):\n\n${url}\n\nIf it wasn't you, ignore this email: your password stays the same.\n`,
    html: page(
      `<p>Hi ${escapeHtml(name)},</p>` +
        `<p>Someone asked to reset the password for this Breathband account. The link works for one hour.</p>` +
        `<p><a href="${escapeHtml(url)}">Choose a new password</a></p>` +
        `<p>If it wasn't you, ignore this email: your password stays the same.</p>`,
    ),
  };
}

function page(body: string): string {
  return `<!doctype html><html><body style="font-family: system-ui, sans-serif; line-height: 1.5">${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
