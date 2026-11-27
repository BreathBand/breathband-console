"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { useBackend } from "@/lib/backend/BackendProvider";
// The one screen allowed to import from an adapter: demo sign-in for the local build.
import {
  DEMO_ATHLETE,
  DEMO_CALM,
  DEMO_CLIENT,
  DEMO_CLINICIAN,
  DEMO_COACH,
  DEMO_EDUCATOR,
  DEMO_FOCUS,
  DEMO_PASSWORD,
  DEMO_TEAM,
} from "@/lib/backend/local/seed";
import { AuthFrame } from "../auth/AuthFrame";
import { CheckEmail } from "../auth/CheckEmail";
import { EMAIL_SHAPE, FormError, PasswordField, SubmitButton, TextField } from "../auth/fields";
import { signInProblem } from "../auth/messages";
import { noNext, useNext, type WithNext } from "../auth/useNext";

export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<LoginForm withNext={noNext} />}>
        <LoginWithNext />
      </Suspense>
    </AuthFrame>
  );
}

function LoginWithNext() {
  const { withNext } = useNext();
  return <LoginForm withNext={withNext} />;
}

type Problem = { field?: "email" | "password"; message: string };

// The demo plan's people first (one per track), then the rest of Lena's squad.
const DEMO = [
  { profile: DEMO_COACH, role: "Coach", about: "Dashboard, roster, practice plans and group sessions" },
  { profile: DEMO_ATHLETE, role: "Athlete", about: "Sessions, trends and sharing with a coach" },
  { profile: DEMO_CALM, role: "Calm", about: "A daily habit: ten days in a row and Foundations under way" },
  { profile: DEMO_FOCUS, role: "Focus", about: "Exams coming up, with mood check-ins around sessions" },
  { profile: DEMO_CLINICIAN, role: "Clinician", about: "Clients on a between-visits plan" },
  { profile: DEMO_CLIENT, role: `${DEMO_CLINICIAN.displayName}'s client`, about: "Joined through an invite; follows the plan" },
  { profile: DEMO_EDUCATOR, role: "Educator", about: "A class of six students" },
  ...DEMO_TEAM.filter((p) => p.uid !== DEMO_FOCUS.uid).map((profile) => ({
    profile,
    role: "Athlete",
    about: `Another of ${DEMO_COACH.displayName}'s athletes`,
  })),
];

function LoginForm({ withNext }: { withNext: WithNext }) {
  const backend = useBackend();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  // The address whose sign-in was refused because it isn't confirmed yet (http, T-0139).
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  // Which sign-in is running: "form", or the email of a demo account.
  const [busy, setBusy] = useState<string | null>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const wasUnconfirmed = useRef(false);

  // Back from "Check your email": focus returns to the form it came from.
  useEffect(() => {
    if (!unconfirmed && wasUnconfirmed.current) fieldsRef.current?.querySelector<HTMLInputElement>("#email")?.focus();
    wasUnconfirmed.current = !!unconfirmed;
  }, [unconfirmed]);

  async function signIn(address: string, secret: string, source: string) {
    if (busy) return;
    setBusy(source);
    setProblem(null);
    try {
      await backend.auth.signIn(address, secret);
      // CloudShell redirects to ?next= once the auth state changes; stay busy until then.
    } catch (e) {
      const why = signInProblem(e);
      if (why === "unverified") setUnconfirmed(address.trim());
      else setProblem(why);
      setBusy(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const address = email.trim();
    const check: Problem | null = !address
      ? { field: "email", message: "Enter your email address." }
      : !EMAIL_SHAPE.test(address)
        ? { field: "email", message: "That email address doesn't look right." }
        : !password
          ? { field: "password", message: "Enter your password." }
          : null;
    if (check) {
      setProblem(check);
      fieldsRef.current?.querySelector<HTMLInputElement>(`#${check.field}`)?.focus();
      return;
    }
    signIn(address, password, "form");
  }

  const formError = problem && !problem.field ? problem.message : "";

  if (unconfirmed) {
    return (
      <CheckEmail
        address={unconfirmed}
        actions={
          <button type="button" className="button bc-ghost" onClick={() => setUnconfirmed(null)}>
            Back to sign in
          </button>
        }
      >
        <p className="bc-lede">
          You need to confirm your email address before you can sign in. We&apos;ve sent a new link to{" "}
          <strong className="bc-break">{unconfirmed}</strong>: follow it and you&apos;re signed in to BreathCloud.
        </p>
      </CheckEmail>
    );
  }

  return (
    <div className="bc-auth-stack">
      <section className="bc-card" aria-labelledby="login-h">
        <h1 id="login-h">Sign in to BreathCloud</h1>
        <p className="bc-lede">
          Use the email and password from your Breathband app. It&apos;s the same account, so the sessions you record
          sync here.
        </p>

        <form className="bc-form" onSubmit={onSubmit} noValidate aria-busy={busy === "form" || undefined}>
          <div className="bc-form-fields" ref={fieldsRef}>
            <TextField
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              readOnly={!!busy}
              error={problem?.field === "email" ? problem.message : undefined}
              describedBy={formError ? "login-error" : undefined}
            />
            <PasswordField
              id="password"
              label="Password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              readOnly={!!busy}
              error={problem?.field === "password" ? problem.message : undefined}
              describedBy={formError ? "login-error" : undefined}
              aside={
                <Link href={withNext("/cloud/reset/")} className="bc-inline-link">
                  Forgot password?
                </Link>
              }
            />
          </div>
          {formError && <FormError id="login-error">{formError}</FormError>}
          <SubmitButton busy={busy === "form"} label="Sign in" busyLabel="Signing in…" />
        </form>

        <p className="bc-alt">
          New to Breathband?{" "}
          <Link href={withNext("/cloud/signup/")} className="bc-inline-link">
            Create an account
          </Link>
        </p>
      </section>

      {backend.kind === "local" && (
        <section className="bc-demo" aria-labelledby="demo-h">
          <div className="bc-demo-head">
            <h2 id="demo-h">Try a demo account</h2>
            <p>
              Demo data lives in this browser only. Every demo account&apos;s password is <code>{DEMO_PASSWORD}</code>.
            </p>
          </div>
          <ul className="bc-demo-list">
            {DEMO.map(({ profile, role, about }) => {
              const running = busy === profile.email;
              return (
                <li key={profile.uid}>
                  <button
                    type="button"
                    className="bc-demo-card"
                    aria-disabled={busy ? true : undefined}
                    aria-describedby={`demo-${profile.uid}`}
                    onClick={() => signIn(profile.email, DEMO_PASSWORD, profile.email)}
                  >
                    <span className="bc-avatar" aria-hidden="true">
                      {initials(profile.displayName)}
                    </span>
                    <span className="bc-demo-text">
                      <span className="bc-demo-name">
                        <span className="sr-only">Sign in as </span>
                        {profile.displayName}
                      </span>
                      <span className="bc-demo-role">
                        <span className="sr-only">, </span>
                        {role}
                      </span>
                      <span className="bc-demo-about" id={`demo-${profile.uid}`} aria-hidden="true">
                        {about}
                      </span>
                    </span>
                    {running ? (
                      <span className="bc-spinner" aria-hidden="true" />
                    ) : (
                      <Icon name="arrowRight" size={18} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <span className="sr-only" role="status">
            {busy && busy !== "form" ? "Signing in…" : ""}
          </span>
        </section>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
