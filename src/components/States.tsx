import type { ReactNode } from "react";
import { BackendError } from "@/lib/backend";

/** Grey placeholder bars in the shape of what's loading. */
export function Skeleton({ lines = 3, label = "Loading…" }: { lines?: number; label?: string }) {
  return (
    <div className="skeleton" aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${92 - ((i * 23) % 40)}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ title, level = 2, children }: { title: string; level?: 1 | 2; children?: ReactNode }) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className="empty">
      <Heading>{title}</Heading>
      {children}
    </div>
  );
}

/** A load failure, worded for permission problems, with a retry. */
export function ErrorState({ error, what, onRetry }: { error: unknown; what: string; onRetry?: () => void }) {
  const denied = error instanceof BackendError && error.code === "permission-denied";
  return (
    <div className="empty" role="alert">
      <h2>{denied ? "You don't have access to this" : `Couldn't load ${what}`}</h2>
      <p className="muted">
        {denied
          ? "The athlete may have stopped sharing with you. Ask them for a new invite code."
          : "Check your connection and try again."}
      </p>
      {!denied && onRetry && (
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
