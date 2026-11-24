"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { LENGTHS, readSetup, saveSetup, SKILLS, type SessionSetup } from "@/lib/prefs";
import { applyTheme, readTheme, type ThemeChoice } from "@/lib/theme";

const THEMES: { id: ThemeChoice; label: string; icon: "monitor" | "sun" | "moon" }[] = [
  { id: "system", label: "System", icon: "monitor" },
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
];

/** Colour theme for this browser. The recording screen is always dark. */
export function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  return (
    <section className="pane pane-pad" aria-labelledby="appearance-h">
      <div className="pane-h">
        <h2 id="appearance-h">Appearance</h2>
        <span className="meta">This browser only</span>
      </div>
      <div className="seg seg-wide" role="group" aria-label="Colour theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={theme === t.id}
            onClick={() => {
              applyTheme(t.id);
              setTheme(t.id);
            }}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** What a new session starts with on the Record page. Kept in this browser, like the app keeps them on the phone. */
export function SessionDefaultsSection() {
  const [setup, setSetup] = useState<SessionSetup>(readSetup);
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<SessionSetup>) => {
    const next = { ...setup, ...patch };
    if (next.mode === "paced" && next.lengthSec === 0) next.lengthSec = 300;
    setSetup(next);
    saveSetup(next);
    setSaved(true);
  };

  return (
    <section className="pane pane-pad" aria-labelledby="defaults-h">
      <div className="pane-h">
        <h2 id="defaults-h">Session defaults</h2>
        <span className="meta" role="status">
          {saved ? "Saved" : "Used when you start a session"}
        </span>
      </div>
      <div className="defaults-grid">
        <label className="field">
          Session
          <select value={setup.mode} onChange={(e) => set({ mode: e.target.value as SessionSetup["mode"] })}>
            <option value="paced">Paced</option>
            <option value="open">Open</option>
          </select>
        </label>
        <label className="field">
          Pacer
          <select value={setup.pacer} onChange={(e) => set({ pacer: Number(e.target.value) === 2 ? 2 : 5 })}>
            <option value={5}>5-5 · slow</option>
            <option value={2}>2-2 · quicker</option>
          </select>
        </label>
        <label className="field">
          Length
          <select value={setup.lengthSec} onChange={(e) => set({ lengthSec: Number(e.target.value) })}>
            {LENGTHS.filter((l) => setup.mode === "open" || l.sec > 0).map((l) => (
              <option key={l.sec} value={l.sec}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Pacer view
          <select value={setup.view} onChange={(e) => set({ view: e.target.value as SessionSetup["view"] })}>
            <option value="circle">Circle</option>
            <option value="line">Line</option>
          </select>
        </label>
        <label className="field">
          Sound
          <select value={setup.sound ? "on" : "off"} onChange={(e) => set({ sound: e.target.value === "on" })}>
            <option value="on">Tones on</option>
            <option value="off">Silent</option>
          </select>
        </label>
        <label className="field">
          Skill level
          <select value={setup.skill} onChange={(e) => set({ skill: e.target.value as SessionSetup["skill"] })}>
            {SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} · {s.detail}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">Your skill level sets how close to the pacer counts as on target when a paced session is scored.</p>
    </section>
  );
}
