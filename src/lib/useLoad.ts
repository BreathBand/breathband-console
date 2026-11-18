"use client";

import { useEffect, useState } from "react";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: unknown };

/**
 * Runs `load` whenever `key` changes and tracks its result. A tiny stand-in
 * for a data library (TanStack Query / SWR) until the console needs caching
 * or live updates — see docs/PLAN.md.
 */
export function useLoad<T>(key: string | null, load: () => Promise<T>): LoadState<T> {
  const [state, setState] = useState<{ key: string | null; value: LoadState<T> }>({
    key,
    value: { status: "loading" },
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, value: { status: "ready", data } }),
      (error: unknown) => !cancelled && setState({ key, value: { status: "error", error } }),
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; `key` identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state.value : { status: "loading" };
}
