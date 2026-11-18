"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { DEMO_ATHLETE, DEMO_COACH, DEMO_PASSWORD } from "@/lib/backend/local/seed";

export default function LoginPage() {
  const backend = useBackend();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await backend.auth.signIn(email, password);
      // CloudShell redirects once auth state changes.
    } catch (e) {
      setError(
        e instanceof BackendError && e.code === "invalid-credentials"
          ? "Email or password is incorrect."
          : "Couldn't sign in. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="stack card" onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <label className="field">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="field">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p>
        New to Breathband? <Link href="/cloud/signup/">Create an account</Link>
      </p>
      {backend.kind === "local" && (
        <p className="muted">
          Demo accounts: {DEMO_ATHLETE.email} or {DEMO_COACH.email}, password{" "}
          <code>{DEMO_PASSWORD}</code>
        </p>
      )}
    </form>
  );
}
