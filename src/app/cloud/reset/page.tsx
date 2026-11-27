"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { AuthFrame } from "../auth/AuthFrame";
import { EMAIL_SHAPE, FormError, SubmitButton, TextField } from "../auth/fields";
import { failureMessage } from "../auth/messages";
import { noNext, useNext, type WithNext } from "../auth/useNext";

export default function ResetPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<ResetForm withNext={noNext} />}>
        <ResetWithNext />
      </Suspense>
    </AuthFrame>
  );
}

function ResetWithNext() {
  const { withNext } = useNext();
  return <ResetForm withNext={withNext} />;
}

type Problem = { field?: "email"; message: string };

function ResetForm({ withNext }: { withNext: WithNext }) {
  const backend = useBackend();
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const inputWrap = useRef<HTMLDivElement>(null);

  const wasSent = useRef(false);

  // Move focus with the view: to the confirmation, and back to the field after "Use a different email".
  useEffect(() => {
    if (sentTo) sentHeading.current?.focus();
    else if (wasSent.current) inputWrap.current?.querySelector("input")?.focus();
    wasSent.current = !!sentTo;
  }, [sentTo]);

  function fail(p: Problem) {
    setProblem(p);
    if (p.field) inputWrap.current?.querySelector("input")?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    if (!address) return fail({ field: "email", message: "Enter your email address." });
    if (!EMAIL_SHAPE.test(address)) return fail({ field: "email", message: "That email address doesn't look right." });

    setBusy(true);
    setProblem(null);
    try {
      await backend.auth.sendPasswordReset(address);
      setSentTo(address);
    } catch (e) {
      const code = e instanceof BackendError ? e.code : null;
      if (code === "invalid-email") fail({ field: "email", message: "That email address doesn't look right." });
      else if (code === "unavailable" || !(e instanceof BackendError))
        fail({ message: failureMessage(e, "Couldn't send the email right now. Check your connection and try again.") });
      // Any other answer (e.g. no such account) looks exactly like success, so the page never reveals who has an account.
      else setSentTo(address);
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="bc-auth-stack">
        <section className="bc-card bc-sent" aria-labelledby="sent-h">
          <span className="bc-sent-icon" aria-hidden="true">
            <Icon name="mail" size={26} />
          </span>
          <h1 id="sent-h" ref={sentHeading} tabIndex={-1}>
            Check your email
          </h1>
          <p className="bc-lede">
            If there&apos;s a Breathband account for <strong className="bc-break">{sentTo}</strong>, we&apos;ve sent it
            a link to choose a new password. It can take a few minutes to arrive, so check your spam folder too.
          </p>
          <p className="bc-lede">The new password works in the Breathband app and in BreathCloud.</p>
          <div className="bc-actions">
            <Link href={withNext("/cloud/login/")} className="button bc-submit">
              Back to sign in
            </Link>
            <button
              type="button"
              className="button bc-ghost"
              onClick={() => {
                setSentTo(null);
                setEmail("");
              }}
            >
              Use a different email
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bc-auth-stack">
      <section className="bc-card" aria-labelledby="reset-h">
        <h1 id="reset-h">Reset your password</h1>
        <p className="bc-lede">
          Enter the email you use for Breathband. We&apos;ll send you a link to choose a new password for the app and
          BreathCloud.
        </p>
        <form className="bc-form" onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
          <div className="bc-form-fields" ref={inputWrap}>
            <TextField
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              readOnly={busy}
              error={problem?.field ? problem.message : undefined}
            />
          </div>
          {problem && !problem.field && <FormError id="reset-error">{problem.message}</FormError>}
          <SubmitButton busy={busy} label="Send reset link" busyLabel="Sending…" />
        </form>
        <p className="bc-alt">
          Remembered it?{" "}
          <Link href={withNext("/cloud/login/")} className="bc-inline-link">
            Back to sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
