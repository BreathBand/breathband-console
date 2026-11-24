"use client";

import { useEffect, useState } from "react";
import { useDevice } from "@/lib/device/DeviceProvider";
import { SAMPLE_RATE_HZ, STRAP_TENSION } from "@/lib/device/config";

type Fit = "slack" | "good" | "tight";

/** The resting level over the last two seconds, which is what the strap's tension moves. */
function restingLevel(recent: readonly number[]): number | null {
  const tail = recent.slice(-2 * SAMPLE_RATE_HZ);
  if (tail.length === 0) return null;
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

export function fitOf(level: number): Fit {
  if (level < STRAP_TENSION.min) return "slack";
  if (level > STRAP_TENSION.max) return "tight";
  return "good";
}

const WORDS: Record<Fit, { title: string; detail: string }> = {
  slack: { title: "Tighten the strap", detail: "Pull it snug until the marker moves into the green." },
  good: { title: "Good fit", detail: "The band can feel every breath. Keep it like this for the session." },
  tight: { title: "A little tight", detail: "Loosen the strap a notch so you can breathe in fully." },
};

/**
 * The strap-tension gauge: a track from slack to tight with the good range
 * marked, and a marker at the band's resting level. It turns to "Good fit" in
 * words as well as colour.
 */
export function TensionGauge() {
  const device = useDevice();
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setLevel(restingLevel(device.recent())), 250);
    return () => clearInterval(timer);
  }, [device]);

  if (level === null) return null;
  const fit = fitOf(level);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / STRAP_TENSION.full) * 100))}%`;

  return (
    <section className="pane pane-pad gauge" data-fit={fit} aria-labelledby="gauge-h">
      <div className="gauge-head">
        <h2 id="gauge-h">Strap</h2>
        <p role="status">
          <b>{WORDS[fit].title}.</b> {WORDS[fit].detail}
        </p>
      </div>
      <div
        className="gauge-track"
        role="meter"
        aria-label="Strap tension"
        aria-valuemin={0}
        aria-valuemax={STRAP_TENSION.full}
        aria-valuenow={Math.round(level)}
        aria-valuetext={WORDS[fit].title}
      >
        <span className="gauge-good" style={{ left: pct(STRAP_TENSION.min), width: `calc(${pct(STRAP_TENSION.max)} - ${pct(STRAP_TENSION.min)})` }} />
        <span className="gauge-marker" style={{ left: pct(level) }} />
      </div>
      <div className="gauge-ends" aria-hidden="true">
        <span>Slack</span>
        <span>Good</span>
        <span>Tight</span>
      </div>
    </section>
  );
}
