"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while `active` (G5): a session shouldn't stop because the
 * laptop or phone dimmed. The browser drops the lock when the tab is hidden, so
 * it's asked for again when the tab comes back. Where the Screen Wake Lock API
 * is missing or refused, nothing happens.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (released) void next.release();
        else lock = next;
      } catch {
        // Refused (battery saver, a hidden tab): the session carries on without it.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
