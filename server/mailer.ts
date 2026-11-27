// Outgoing email: SMTP through nodemailer (Mailpit locally, a provider in
// production), or the console in development when no SMTP host is set.

import nodemailer from "nodemailer";
import type { Mode, SmtpEnv } from "./env";

/** `headers`: extra message headers, e.g. List-Unsubscribe on optional emails. */
export type Email = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };

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

/** What an optional email needs to say how to stop it: a one-click link (RFC 8058). */
export type Unsubscribe = { url: string; what: string };

/**
 * One email from its parts: a greeting, paragraphs, an optional button, and for
 * optional emails a line and header to stop them.
 */
function message(parts: { to: string; subject: string; name: string; paragraphs: string[]; action?: { label: string; url: string }; unsubscribe?: Unsubscribe }): Email {
  const { to, subject, name, paragraphs, action, unsubscribe } = parts;
  const stop = unsubscribe ? `You get this because ${unsubscribe.what} emails are on. Stop them: ${unsubscribe.url}` : null;
  const text = [`Hi ${name},`, ...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), ...(stop ? [stop] : [])].join("\n\n") + "\n";
  const html = page(
    `<p>Hi ${escapeHtml(name)},</p>` +
      paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("") +
      (action ? `<p><a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a></p>` : "") +
      (unsubscribe
        ? `<p style="color: #57534c; font-size: 13px">You get this because ${escapeHtml(unsubscribe.what)} emails are on. <a href="${escapeHtml(unsubscribe.url)}">Stop these emails</a></p>`
        : ""),
  );
  const headers = unsubscribe ? { "List-Unsubscribe": `<${unsubscribe.url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  return { to, subject, text, html, ...(headers ? { headers } : {}) };
}

/** A professional's invite to someone without an account link yet (E9: email). */
export function coachInviteEmail(to: string, name: string, coachName: string, url: string): Email {
  return message({
    to,
    subject: `${coachName} invited you to Breathband`,
    name,
    paragraphs: [
      `${coachName} would like to follow your breathing practice on Breathband. Open the invite to see what they'll see, and choose whether to share.`,
      "The link works for 14 days. If you weren't expecting it, you can ignore this email.",
    ],
    action: { label: "Open the invite", url },
  });
}

export function inviteAcceptedEmail(to: string, name: string, personName: string, url: string, unsubscribe: Unsubscribe): Email {
  return message({
    to,
    subject: `${personName} accepted your invite`,
    name,
    paragraphs: [`${personName} accepted your invite and now shares their sessions with you.`],
    action: { label: "Open BreathCloud", url },
    unsubscribe,
  });
}

export function practiceEmail(to: string, name: string, coachName: string, practice: string, url: string, unsubscribe: Unsubscribe): Email {
  return message({
    to,
    subject: `New practice from ${coachName}`,
    name,
    paragraphs: [`${coachName} set you some practice: ${practice}.`],
    action: { label: "Start it", url },
    unsubscribe,
  });
}

export function deletionRequestedEmail(to: string, name: string, when: string, url: string): Email {
  return message({
    to,
    subject: "Your Breathband account will be deleted",
    name,
    paragraphs: [
      `You asked to delete your Breathband account. Everything goes on ${when}, and until then nobody can see it, you included.`,
      "Changed your mind? Sign in before then and keep your account. If it wasn't you, sign in and keep it, then change your password.",
    ],
    action: { label: "Sign in", url },
  });
}

export function accountDeletedEmail(to: string, name: string): Email {
  return message({
    to,
    subject: "Your Breathband account is deleted",
    name,
    paragraphs: ["Your Breathband account, your sessions and everything you shared are deleted. Thank you for breathing with us."],
  });
}

export function reminderEmail(to: string, name: string, line: string, url: string, unsubscribe: Unsubscribe): Email {
  return message({ to, subject: "Time for your breathing", name, paragraphs: [line], action: { label: "Start a session", url }, unsubscribe });
}

export type DigestRow = { name: string; sessions: number };

export function digestEmail(to: string, name: string, rows: readonly DigestRow[], url: string, unsubscribe: Unsubscribe): Email {
  const quiet = rows.filter((r) => r.sessions === 0).length;
  const lines = rows.map((r) => `${r.name}: ${r.sessions === 0 ? "no sessions" : `${r.sessions} session${r.sessions === 1 ? "" : "s"}`}`);
  return message({
    to,
    subject: "Your week on Breathband",
    name,
    paragraphs: [
      `Last week, ${rows.length} ${rows.length === 1 ? "person" : "people"} shared with you${quiet ? `, and ${quiet} didn't breathe with Breathband` : ""}.`,
      lines.join("\n"),
    ],
    action: { label: "Open your dashboard", url },
    unsubscribe,
  });
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
