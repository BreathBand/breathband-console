"use client";

import Link from "next/link";
import { Suspense, useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { BackendError, type BackendErrorCode } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { ageGateProblem, currentConsents, UNDER_AGE_MESSAGE } from "@/lib/domain/consent";
import type { Role } from "@/lib/domain/types";
import { AuthFrame } from "../auth/AuthFrame";
import { EMAIL_SHAPE, FormError, PasswordField, SubmitButton, TextField } from "../auth/fields";
import { noNext, useNext, type WithNext } from "../auth/useNext";

export default function SignupPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<SignupForm withNext={noNext} />}>
        <SignupWithNext />
      </Suspense>
    </AuthFrame>
  );
}

function SignupWithNext() {
  const { withNext } = useNext();
  return <SignupForm withNext={withNext} />;
}

type Field = "displayName" | "email" | "password" | "birthYear" | "consentTerms" | "consentData";
type Problem = { field?: Field; message: string; signInLink?: boolean };

const ERRORS: Partial<Record<BackendErrorCode, Problem>> = {
  "email-in-use": { field: "email", message: "An account with that email already exists.", signInLink: true },
  "weak-password": { field: "password", message: "Use at least 8 characters for your password." },
  "invalid-email": { field: "email", message: "That email address doesn't look right." },
  "under-age": { field: "birthYear", message: UNDER_AGE_MESSAGE },
};

// DRAFT consent wording, for counsel to review before launch. The versions it
// records are in lib/domain/consent.ts; change both together.
const CONSENT_TERMS = "I agree to the terms of use and the privacy notice.";
const CONSENT_DATA = "Process my breathing data to give me scores.";

const ROLES: { value: Role; title: string; line: string; icon: IconName }[] = [
  { value: "athlete", title: "Athlete", line: "I use a Breathband", icon: "lungs" },
  { value: "coach", title: "Coach", line: "I coach people who do", icon: "athletes" },
];

const NEXT_STEP: Record<Role, string> = {
  athlete:
    "Your BreathCloud stays empty until the Breathband app syncs a session. Sign in to the app with this same account and record one.",
  coach:
    "You add athletes with invite codes: an athlete creates a one-time code under Sharing and chooses what you see, then you enter it on your Athletes page.",
};

function SignupForm({ withNext }: { withNext: WithNext }) {
  const backend = useBackend();
  const [role, setRole] = useState<Role>("athlete");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [termsOk, setTermsOk] = useState(false);
  const [dataOk, setDataOk] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldsRef = useRef<HTMLDivElement>(null);

  function show(p: Problem) {
    setProblem(p);
    if (p.field) fieldsRef.current?.querySelector<HTMLInputElement>(`#${p.field}`)?.focus();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const name = displayName.trim();
    const address = email.trim();
    const year = Number(birthYear.trim());
    const gate = birthYear.trim() ? ageGateProblem(year, new Date()) : null;
    const check: Problem | null = !name
      ? { field: "displayName", message: "Enter your name." }
      : !address
        ? { field: "email", message: "Enter your email address." }
        : !EMAIL_SHAPE.test(address)
          ? ERRORS["invalid-email"]!
          : password.length < 8
            ? ERRORS["weak-password"]!
            : !birthYear.trim()
              ? { field: "birthYear", message: "Enter the year you were born." }
              : gate
                ? { field: "birthYear", message: gate.message }
                : !termsOk
                  ? { field: "consentTerms", message: "Agree to the terms and privacy notice to create an account." }
                  : !dataOk
                    ? { field: "consentData", message: "Breathband needs this to score your sessions." }
                    : null;
    if (check) return show(check);

    setBusy(true);
    setProblem(null);
    try {
      await backend.auth.signUp({
        email: address,
        password,
        displayName: name,
        role,
        birthYear: year,
        consents: currentConsents(),
      });
      // CloudShell redirects once the new account is signed in; stay busy until then.
    } catch (e) {
      setBusy(false);
      show(
        (e instanceof BackendError && ERRORS[e.code]) || {
          message: "Couldn't create the account. Check your connection and try again.",
        },
      );
    }
  }

  const fieldError = (field: Field) => {
    if (problem?.field !== field) return undefined;
    return problem.message;
  };

  return (
    <div className="bc-auth-stack">
      <section className="bc-card" aria-labelledby="signup-h">
        <h1 id="signup-h">Create your account</h1>
        <p className="bc-lede">
          One account for the Breathband app and BreathCloud. Already use the app?{" "}
          <Link href={withNext("/cloud/login/")} className="bc-inline-link">
            Sign in instead
          </Link>
          .
        </p>

        <form className="bc-form" onSubmit={onSubmit} noValidate aria-busy={busy || undefined}>
          <fieldset className="bc-roles">
            <legend>I&apos;m joining as</legend>
            <div className="bc-role-grid">
              {ROLES.map((r) => (
                <label key={r.value} className="bc-role">
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    disabled={busy}
                    onChange={() => setRole(r.value)}
                  />
                  <span className="bc-role-icon" aria-hidden="true">
                    <Icon name={r.icon} size={22} />
                  </span>
                  <span className="bc-role-text">
                    <span className="bc-role-title">{r.title}</span>
                    <span className="bc-role-line">{r.line}</span>
                  </span>
                  <span className="bc-role-check" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="bc-note" aria-live="polite">
            <Icon name="info" size={18} />
            <span>{NEXT_STEP[role]}</span>
          </p>

          <div className="bc-form-fields" ref={fieldsRef}>
            <TextField
              id="displayName"
              label="Name"
              autoComplete="name"
              value={displayName}
              onChange={setDisplayName}
              readOnly={busy}
              hint={role === "coach" ? "Your athletes see this name." : "Coaches you share with see this name."}
              error={fieldError("displayName")}
            />
            <TextField
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              readOnly={busy}
              error={fieldError("email")}
            />
            {problem?.signInLink && (
              <p className="bc-field-followup">
                <Link href={withNext("/cloud/login/")} className="bc-inline-link">
                  Sign in with that email
                </Link>{" "}
                or{" "}
                <Link href={withNext("/cloud/reset/")} className="bc-inline-link">
                  reset your password
                </Link>
                .
              </p>
            )}
            <PasswordField
              id="password"
              label="Password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              readOnly={busy}
              hint="At least 8 characters."
              error={fieldError("password")}
            />
            <TextField
              id="birthYear"
              label="Year of birth"
              inputMode="numeric"
              autoComplete="bday-year"
              value={birthYear}
              onChange={setBirthYear}
              readOnly={busy}
              hint="Breathband is for people 16 and over. Normal breathing ranges change with age."
              error={fieldError("birthYear")}
            />
            <fieldset className="bc-consents">
              <legend>Your agreement</legend>
              <ConsentBox
                id="consentTerms"
                label={CONSENT_TERMS}
                checked={termsOk}
                onChange={setTermsOk}
                disabled={busy}
                error={fieldError("consentTerms")}
              />
              <ConsentBox
                id="consentData"
                label={CONSENT_DATA}
                checked={dataOk}
                onChange={setDataOk}
                disabled={busy}
                error={fieldError("consentData")}
              />
            </fieldset>
          </div>

          {problem && !problem.field && <FormError id="signup-error">{problem.message}</FormError>}
          <SubmitButton busy={busy} label="Create account" busyLabel="Creating your account…" />
        </form>

        <p className="bc-alt">
          Already have an account?{" "}
          <Link href={withNext("/cloud/login/")} className="bc-inline-link">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  );
}

function ConsentBox({
  id,
  label,
  checked,
  onChange,
  disabled,
  error,
}: {
  id: Field;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="bc-consent" htmlFor={id}>
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p className="bc-field-error" id={`${id}-error`} role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}
