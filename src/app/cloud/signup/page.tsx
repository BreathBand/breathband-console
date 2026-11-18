"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BackendError, type BackendErrorCode } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import type { Role } from "@/lib/domain/types";

const MESSAGES: Partial<Record<BackendErrorCode, string>> = {
  "email-in-use": "An account with that email already exists. Try signing in.",
  "weak-password": "Use at least 8 characters for your password.",
  "invalid-email": "That email address doesn't look right.",
};

export default function SignupPage() {
  const backend = useBackend();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", role: "athlete" as Role });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await backend.auth.signUp(form);
    } catch (e) {
      setError(
        (e instanceof BackendError && MESSAGES[e.code]) || "Couldn't create the account. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <form className="stack card" onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      <h1>Create an account</h1>
      <label className="field">
        Name
        <input required autoComplete="name" value={form.displayName} onChange={set("displayName")} />
      </label>
      <label className="field">
        Email
        <input type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
      </label>
      <label className="field">
        Password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
        />
      </label>
      <label className="field">
        I am
        <select value={form.role} onChange={set("role")}>
          <option value="athlete">Training with a Breathband</option>
          <option value="coach">A coach</option>
        </select>
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <p>
        Already have an account? <Link href="/cloud/login/">Sign in</Link>
      </p>
    </form>
  );
}
