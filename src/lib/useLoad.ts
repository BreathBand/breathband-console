"use client";

import { useEffect, useState } from "react";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: unknown };

/** A load's state, plus `retry()` to run it again (after an error, or to refresh after a change). */
export type Loaded<T> = LoadState<T> & { retry: () => void };

/**
 * Runs `load` whenever `key` changes and tracks its result. A tiny stand-in
 * for a data library (TanStack Query / SWR) until the console needs caching
 * or live updates — see docs/PLAN.md.
 *
 * `retry()` on loaded data is a refresh: the old data stays on screen until
 * the new data arrives, so forms and tabs underneath don't unmount.
 */
export function useLoad<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  const [attempt, setAttempt] = useState(0);
  const tag = key === null ? null : `${attempt}:${key}`;
  const [state, setState] = useState<{ tag: string | null; value: LoadState<T> }>({
    tag,
    value: { status: "loading" },
  });

  useEffect(() => {
    if (tag === null) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ tag, value: { status: "ready", data } }),
      (error: unknown) => !cancelled && setState({ tag, value: { status: "error", error } }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; `tag` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const refreshing =
    state.value.status === "ready" && state.tag !== null && state.tag.slice(state.tag.indexOf(":") + 1) === key;
  const value: LoadState<T> = state.tag === tag || refreshing ? state.value : { status: "loading" };
  return { ...value, retry: () => setAttempt((n) => n + 1) };
}
