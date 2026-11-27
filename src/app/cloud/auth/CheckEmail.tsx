"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { useBackend } from "@/lib/backend/BackendProvider";
import { resendProblem } from "./messages";

type Resend = { state: "idle" | "sending" } | { state: "sent" } | { state: "failed"; message: string };

/**
 * "Check your email" (T-0139): after sign-up on a backend that confirms addresses,
 * and when sign-in is refused because the address isn't confirmed yet. Names the
 * address, offers "Send the link again", and takes focus when it appears.
 */
export function CheckEmail({ address, children, actions }: { address: string; children: ReactNode; actions: ReactNode }) {
  const backend = useBackend();
  const heading = useRef<HTMLHeadingElement>(null);
  const [resend, setResend] = useState<Resend>({ state: "idle" });

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function sendAgain() {
    if (resend.state === "sending") return;
    setResend({ state: "sending" });
    try {
      await backend.auth.sendVerificationEmail(address);
      setResend({ state: "sent" });
    } catch (e) {
      setResend({ state: "failed", message: resendProblem(e) });
    }
  }

  const sending = resend.state === "sending";

  return (
    <div className="bc-auth-stack">
      <section className="bc-card bc-sent" aria-labelledby="check-email-h">
        <span className="bc-sent-icon" aria-hidden="true">
          <Icon name="mail" size={26} />
        </span>
        <h1 id="check-email-h" ref={heading} tabIndex={-1}>
          Check your email
        </h1>
        {children}
        <p className="bc-lede">It can take a few minutes to arrive, so check your spam folder too.</p>

        {resend.state === "sent" && (
          <p className="bc-resent">
            <Icon name="check" size={16} />
            <span>
              We&apos;ve sent another link to <strong className="bc-break">{address}</strong>.
            </span>
          </p>
        )}
        <span className="sr-only" role="status">
          {resend.state === "sending" ? "Sending…" : resend.state === "sent" ? `We've sent another link to ${address}.` : ""}
        </span>
        {resend.state === "failed" && (
          <div className="bc-form-error" role="alert">
            <Icon name="alert" size={18} />
            <p>{resend.message}</p>
          </div>
        )}

        <div className="bc-actions">
          <button type="button" className="button bc-ghost" aria-disabled={sending || undefined} onClick={sendAgain}>
            {sending && <span className="bc-spinner" aria-hidden="true" />}
            {sending ? "Sending…" : "Send the link again"}
          </button>
          {actions}
        </div>
      </section>
    </div>
  );
}
