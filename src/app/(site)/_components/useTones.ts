"use client";

import { useRef } from "react";

/**
 * The auditory pacer's notes: a short sine tone, high at the top of the
 * breath and low at the bottom, like the app's "Notes on" mode. Audio only
 * starts after the visitor turns it on (`unlock` must run in a click).
 */
export function useTones() {
  const ctxRef = useRef<AudioContext | null>(null);
  return {
    unlock() {
      if (!ctxRef.current && typeof window !== "undefined" && "AudioContext" in window) {
        ctxRef.current = new AudioContext();
      }
      void ctxRef.current?.resume();
    },
    play(high: boolean) {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = high ? 660 : 440;
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.55);
    },
  };
}
