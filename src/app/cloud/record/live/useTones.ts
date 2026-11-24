"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/** The app's two notes: low at the bottom of a breath, high at the top (the site's pacer uses the same pair). */
export const TONES = { low: 440, high: 660 } as const;

/**
 * Short sine tones from Web Audio. The context is created on the first call
 * from a click (browsers refuse audio before a gesture) and closed on unmount.
 */
export function useTones(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const on = useRef(enabled);

  useEffect(() => {
    on.current = enabled;
  }, [enabled]);

  useEffect(
    () => () => {
      void ctx.current?.close();
      ctx.current = null;
    },
    [],
  );

  /** Call from a click handler so the browser lets audio start. */
  const unlock = useCallback(() => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    if (!ctx.current) ctx.current = new AudioContext();
    void ctx.current.resume();
  }, []);

  const play = useCallback((frequency: number, seconds = 0.35) => {
    const audio = ctx.current;
    if (!audio || !on.current || audio.state !== "running") return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }, []);

  return useMemo(() => ({ unlock, play }), [unlock, play]);
}
