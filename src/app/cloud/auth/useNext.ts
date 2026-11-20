"use client";

import { useSearchParams } from "next/navigation";
import { safeNext } from "../CloudShell";

/**
 * The `?next=` the visitor arrived with, and a helper that carries it onto
 * links between login, signup and reset. Only same-origin console paths are
 * passed along (CloudShell's `safeNext` is the gate on the way out).
 * Callers must sit inside a <Suspense> boundary (static export).
 */
export function useNext() {
  const raw = useSearchParams().get("next");
  const next = raw && safeNext(raw) === raw ? raw : null;
  const withNext = (href: string) => (next ? `${href}?next=${encodeURIComponent(next)}` : href);
  return { next, withNext };
}

export type WithNext = (href: string) => string;

/** Used while search params are not available yet (prerender): links without `?next=`. */
export const noNext: WithNext = (href) => href;
