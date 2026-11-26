import { describe, expect, it, vi } from "vitest";
import {
  createConsoleMailer,
  createMailer,
  createSmtpMailer,
  DEFAULT_FROM,
  resetPasswordEmail,
  verificationEmail,
  type Transport,
} from "./mailer";

const LINK = "http://localhost:8787/api/auth/verify-email?token=abc&callbackURL=%2F";

describe("createSmtpMailer", () => {
  it("sends through the transport from SMTP_FROM", async () => {
    const sendMail = vi.fn<Transport["sendMail"]>().mockResolvedValue({});
    const mailer = createSmtpMailer({ host: "localhost", port: 1025, from: "BB <bb@example.test>" }, { sendMail });
    const email = verificationEmail("ana@example.test", "Ana", LINK);
    await mailer.send(email);
    expect(sendMail).toHaveBeenCalledWith({ from: "BB <bb@example.test>", ...email });
  });

  it("defaults the sender", async () => {
    const sendMail = vi.fn<Transport["sendMail"]>().mockResolvedValue({});
    await createSmtpMailer({ host: "localhost" }, { sendMail }).send(verificationEmail("a@example.test", "A", LINK));
    expect(sendMail.mock.calls[0][0].from).toBe(DEFAULT_FROM);
  });

  it("passes on a failed send", async () => {
    const sendMail = vi.fn<Transport["sendMail"]>().mockRejectedValue(new Error("connection refused"));
    const mailer = createSmtpMailer({ host: "localhost" }, { sendMail });
    await expect(mailer.send(verificationEmail("a@example.test", "A", LINK))).rejects.toThrow("connection refused");
  });
});

describe("createMailer", () => {
  it("refuses to run production without SMTP_HOST", () => {
    expect(() => createMailer("production", {})).toThrow("SMTP_HOST is required in production");
  });

  it("uses SMTP when SMTP_HOST is set, in any mode", () => {
    expect(() => createMailer("production", { host: "smtp.example", port: 587 })).not.toThrow();
  });

  it("prints to the console in development without SMTP_HOST", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await createMailer("development", {}).send(verificationEmail("ana@example.test", "Ana", LINK));
      expect(log).toHaveBeenCalledWith(expect.stringContaining(LINK));
    } finally {
      log.mockRestore();
    }
  });
});

describe("createConsoleMailer", () => {
  it("logs the recipient, subject and text", async () => {
    const lines: string[] = [];
    await createConsoleMailer((line) => lines.push(line)).send(resetPasswordEmail("ana@example.test", "Ana", LINK));
    expect(lines[0]).toContain("ana@example.test");
    expect(lines[0]).toContain("Reset your Breathband password");
    expect(lines[0]).toContain(LINK);
  });
});

describe("emails", () => {
  it.each([
    ["verification", verificationEmail],
    ["reset", resetPasswordEmail],
  ])("the %s email has the link in text and HTML and escapes the name", (_, build) => {
    const email = build("ana@example.test", `<script>alert("x")</script>`, LINK);
    expect(email.to).toBe("ana@example.test");
    expect(email.text).toContain(LINK);
    expect(email.html).toContain(`href="${LINK.replaceAll("&", "&amp;")}"`);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
