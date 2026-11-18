"use client";

import { useState, type FormEvent } from "react";
import { BackendError, createBackend } from "@/lib/backend";

type Status = "idle" | "sending" | "done" | "error";

// The landing page doesn't mount BackendProvider (no auth needed), so it
// creates the backend on first submit.
export function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      await createBackend().data.joinWaitlist({ email, source });
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof BackendError && error.code === "invalid-email"
          ? "That email address doesn't look right."
          : "Couldn't save that. Please try again.",
      );
    }
  }

  if (status === "done") {
    return <p role="status">You&apos;re on the list. We&apos;ll email you when Breathband launches.</p>;
  }

  return (
    <form className="row" onSubmit={onSubmit} style={{ alignItems: "flex-end" }}>
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
      <button className="button" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Joining…" : "Join the waitlist"}
      </button>
      {status === "error" && (
        <p className="error" role="alert" style={{ width: "100%" }}>
          {message}
        </p>
      )}
    </form>
  );
}
