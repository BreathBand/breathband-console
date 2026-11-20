"use client";

import { usePathname } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { BackendError, createBackend } from "@/lib/backend";
import { Check } from "./ui";

type Status = "idle" | "sending" | "done" | "error";

export const AUDIENCES = [
  {
    id: "user",
    label: "Athlete or user",
    button: "Join the waitlist",
    done: "We'll email you when Breathband is available.",
  },
  {
    id: "coach",
    label: "Coach",
    button: "Join as a coach",
    done: "We'll email you about coach access to BreathCloud.",
  },
  {
    id: "investor",
    label: "Investor or partner",
    button: "Register interest",
    done: "The team will reply to you by email.",
  },
] as const;

type Audience = (typeof AUDIENCES)[number]["id"];

/** Which page a sign-up came from, when the form doesn't name its own spot. */
function pageSlug(pathname: string | null): string {
  const slug = (pathname ?? "/").replace(/^\/|\/$/g, "");
  return slug || "home";
}

/**
 * The waitlist, with a choice of who is joining. The choice changes the
 * button and is stored in `source` as `<spot>:<audience>`, for example
 * `hero:investor` or `coaches-band:coach` (always under 32 characters).
 * The public site doesn't mount BackendProvider, so the form creates the
 * backend on first submit.
 */
export function WaitlistForm({ spot, compact }: { spot: string; compact?: boolean }) {
  const pathname = usePathname();
  const id = useId();
  const onCoaches = pageSlug(pathname) === "coaches";
  const [audience, setAudience] = useState<Audience>(onCoaches ? "coach" : "user");
  const [email, setEmail] = useState("");
  // Honeypot: hidden from people and assistive tech; bots that fill every field fill this too.
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const choice = AUDIENCES.find((a) => a.id === audience) ?? AUDIENCES[0];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (company) {
      setStatus("done");
      return;
    }
    setStatus("sending");
    const where = spot === "band" && onCoaches ? "coaches-band" : spot;
    try {
      await createBackend().data.joinWaitlist({ email, source: `${where}:${audience}`.slice(0, 32) });
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof BackendError && error.code === "invalid-email"
          ? "That email address doesn't look right. Check it and try again."
          : "We couldn't save that just now. Please try again.",
      );
    }
  }

  if (status === "done") {
    return (
      <p className="s-wl-done" role="status">
        <Check size={18} />
        <span>
          <b>You&apos;re on the list.</b> {choice.done}
        </span>
      </p>
    );
  }

  const inputId = `${id}-email`;
  const errorId = `${id}-error`;
  return (
    <form className={`s-wl${compact ? " s-wl-compact" : ""}`} onSubmit={onSubmit}>
      <fieldset className="s-aud">
        <legend className="s-wl-label">I&apos;m joining as</legend>
        <div className="s-aud-row">
          {AUDIENCES.map((a) => (
            <label key={a.id} className="s-aud-opt">
              <input
                type="radio"
                name={`${id}-audience`}
                value={a.id}
                checked={audience === a.id}
                onChange={() => setAudience(a.id)}
              />
              <span>{a.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="s-wl-label" htmlFor={inputId}>
        Email address
      </label>
      <div className="s-wl-row">
        <input
          id={inputId}
          className="s-input"
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={status === "error" ? true : undefined}
          aria-describedby={status === "error" ? errorId : undefined}
        />
        <button className="s-btn" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : choice.button}
        </button>
      </div>
      <div className="s-hp" aria-hidden="true">
        <label>
          Company
          <input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </label>
      </div>
      {status === "error" && (
        <p className="s-wl-error" id={errorId} role="alert">
          {message}
        </p>
      )}
    </form>
  );
}
