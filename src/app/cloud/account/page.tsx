"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useDevice } from "@/lib/device/DeviceProvider";
import { formatLongDay, initials } from "@/lib/domain/format";
import { defaultPreferences, GOALS, goalOf, SKILL_LEVELS, skillBandText } from "@/lib/domain/preferences";
import { peopleNouns } from "@/lib/domain/terminology";
import type { UserPreferences, UserProfile } from "@/lib/domain/types";
import { LENGTHS } from "@/lib/prefs";
import { signOutToLanding } from "../CloudShell";
import { stateWords } from "../device/words";
import { SharingPanel } from "../settings/SharingPanel";
import { AlertRulesSection } from "./AlertRulesForm";
import { AppearanceSection } from "./Preferences";

// /cloud/account/ — Settings: who you are, what you're working towards, how
// your sessions start, who sees them, and how BreathCloud looks.
export default function SettingsPage() {
  const auth = useAuth();
  if (auth.status !== "signed-in" || !auth.profile) return null;
  return <Settings key={auth.profile.uid} profile={auth.profile} />;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Settings({ profile }: { profile: UserProfile }) {
  const backend = useBackend();
  const coach = profile.role === "coach";
  const [prefs, setPrefs] = useState<UserPreferences>(() => profile.preferences ?? defaultPreferences());
  const [prefsState, setPrefsState] = useState<SaveState>("idle");

  /** Saves a preferences change straight away, the way the app's settings do. */
  async function save(next: UserPreferences) {
    setPrefs(next);
    setPrefsState("saving");
    try {
      await backend.data.updateProfile(profile.uid, { preferences: next });
      setPrefsState("saved");
    } catch {
      setPrefsState("error");
    }
  }

  const sections = coach
    ? [
        { id: "profile", label: "Profile" },
        { id: "alerts", label: "Needs a look" },
        { id: "appearance", label: "Appearance" },
      ]
    : [
        { id: "profile", label: "Profile" },
        { id: "goal", label: "Goal and level" },
        { id: "sessions", label: "Sessions" },
        { id: "coaches", label: "Coaches and sharing" },
        { id: "band", label: "Band" },
        { id: "appearance", label: "Appearance" },
      ];

  return (
    <div className="container page settings">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-lede">The same account signs you in to the Breathband app, and your choices follow you there.</p>
        </div>
        <span className="settings-saved" role="status" data-state={prefsState}>
          {prefsState === "saving" ? "Saving…" : prefsState === "saved" ? "Saved" : prefsState === "error" ? "Couldn't save. Try again." : ""}
        </span>
      </header>

      <div className="settings-grid">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="settings-body">
          <ProfileSection profile={profile} />

          {!coach && (
            <>
              <Section id="goal" title="Goal and level" meta="Sets your defaults and how close counts as on target">
                <div className="goal-cards compact" role="radiogroup" aria-label="Your goal">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={prefs.goal === g.id}
                      className="goal-card"
                      onClick={() => save({ ...prefs, goal: g.id, session: { ...g.session }, sessionsPerWeek: g.sessionsPerWeek })}
                    >
                      <small>{g.who}</small>
                      <b className="display">{g.label}</b>
                      <span>{g.detail}</span>
                    </button>
                  ))}
                </div>
                <p className="settings-note">Choosing a goal resets your session defaults and weekly goal to suit it.</p>
                <label className="field settings-field">
                  Experience
                  <select value={prefs.skillLevel} onChange={(e) => save({ ...prefs, skillLevel: e.target.value as UserPreferences["skillLevel"] })}>
                    {SKILL_LEVELS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}: {l.detail}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="settings-note">
                  <Icon name="info" size={16} />
                  At this level, {skillBandText(prefs.skillLevel)}.
                </p>
              </Section>

              <Section id="sessions" title="Sessions" meta={`Starts set up for ${goalOf(prefs.goal).label}`}>
                <div className="settings-choices">
                  <Choice label="Session">
                    {(["paced", "open"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={prefs.session.mode === m}
                        onClick={() =>
                          save({ ...prefs, session: { ...prefs.session, mode: m, durationSec: m === "paced" && prefs.session.durationSec === 0 ? 300 : prefs.session.durationSec } })
                        }
                      >
                        {m === "paced" ? "Paced" : "Open"}
                      </button>
                    ))}
                  </Choice>
                  <Choice label="Pacer">
                    {([5, 2] as const).map((h) => (
                      <button key={h} type="button" aria-pressed={prefs.session.pacerHalfCycleSec === h} onClick={() => save({ ...prefs, session: { ...prefs.session, pacerHalfCycleSec: h } })}>
                        {h}-{h}
                      </button>
                    ))}
                  </Choice>
                  <Choice label="Length">
                    {LENGTHS.filter((l) => prefs.session.mode === "open" || l.sec > 0).map((l) => (
                      <button key={l.sec} type="button" aria-pressed={prefs.session.durationSec === l.sec} onClick={() => save({ ...prefs, session: { ...prefs.session, durationSec: l.sec } })}>
                        {l.label}
                      </button>
                    ))}
                  </Choice>
                  <Choice label="Pacer view">
                    {(["circle", "line"] as const).map((v) => (
                      <button key={v} type="button" aria-pressed={prefs.session.view === v} onClick={() => save({ ...prefs, session: { ...prefs.session, view: v } })}>
                        {v === "circle" ? "Circle" : "Line"}
                      </button>
                    ))}
                  </Choice>
                  <Choice label="Tones">
                    {[true, false].map((on) => (
                      <button key={String(on)} type="button" aria-pressed={prefs.session.sound === on} onClick={() => save({ ...prefs, session: { ...prefs.session, sound: on } })}>
                        {on ? "On" : "Silent"}
                      </button>
                    ))}
                  </Choice>
                  <Choice label="Weekly goal" hint="A coach's target replaces it while you share with them.">
                    {[2, 3, 4, 5, 6, 7].map((n) => (
                      <button key={n} type="button" aria-pressed={prefs.sessionsPerWeek === n} onClick={() => save({ ...prefs, sessionsPerWeek: n })}>
                        {n}
                      </button>
                    ))}
                  </Choice>
                </div>
              </Section>

              <Section id="coaches" title="Coaches and sharing">
                <SharingPanel athleteId={profile.uid} />
              </Section>

              <BandSection />
            </>
          )}

          {coach && (
            <div id="alerts" className="settings-anchor">
              <AlertRulesSection coachId={profile.uid} />
            </div>
          )}

          <div id="appearance" className="settings-anchor">
            <AppearanceSection />
          </div>

          <section className="settings-end" aria-label="Setup and sign out">
            <Link href="/cloud/welcome/" className="button" data-variant="ghost">
              <Icon name="refresh" size={16} />
              Run setup again
            </Link>
            <button type="button" className="button" data-variant="ghost" onClick={() => signOutToLanding(backend)}>
              <Icon name="signOut" size={18} />
              Sign out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, meta, children }: { id: string; title: string; meta?: string; children: ReactNode }) {
  return (
    <section id={id} className="pane pane-pad settings-section" aria-labelledby={`${id}-h`}>
      <div className="pane-h">
        <h2 id={`${id}-h`}>{title}</h2>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Choice({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      <div className="seg" role="group" aria-label={label}>
        {children}
      </div>
      {hint && <small className="settings-hint">{hint}</small>}
    </fieldset>
  );
}

function ProfileSection({ profile }: { profile: UserProfile }) {
  const backend = useBackend();
  const [name, setName] = useState(profile.displayName);
  const [status, setStatus] = useState<SaveState>("idle");
  const coach = profile.role === "coach";
  const terms = peopleNouns(profile);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    try {
      await backend.data.updateProfile(profile.uid, { displayName: name });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Section id="profile" title="Profile">
      <div className="account-who">
        <span className="avatar lg" aria-hidden="true">
          {initials(profile.displayName)}
        </span>
        <dl className="facts">
          <dt>Email</dt>
          <dd>{profile.email}</dd>
          <dt>Account type</dt>
          <dd>{coach ? "Coach" : "Athlete"}</dd>
          <dt>Member since</dt>
          <dd>{formatLongDay(profile.createdAt)}</dd>
        </dl>
      </div>
      <form className="invite-form" onSubmit={onSubmit}>
        <label className="field grow">
          Name shown to {coach ? `your ${terms.many}` : "your coaches"}
          <input
            required
            maxLength={80}
            value={name}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value);
              setStatus("idle");
            }}
          />
        </label>
        <button type="submit" className="button" disabled={status === "saving" || !name.trim() || name.trim() === profile.displayName}>
          {status === "saving" ? "Saving…" : "Save name"}
        </button>
      </form>
      {status === "saved" && (
        <p className="ok-text" role="status">
          <Icon name="check" size={18} /> Saved
        </p>
      )}
      {status === "error" && (
        <p className="error" role="alert">
          Couldn&apos;t save your name. Try again.
        </p>
      )}
    </Section>
  );
}

function BandSection() {
  const device = useDevice();
  return (
    <Section id="band" title="Band" meta={device.connected ? "Connected" : stateWords(device.status.state)}>
      <div className="settings-band">
        <span className="source-icon">
          <Icon name={device.kind === "simulated" ? "signal" : "bluetooth"} size={22} />
        </span>
        <p>
          <b>{device.kind === "simulated" ? "Simulated band" : "Breathband over Bluetooth"}</b>
          <span>
            {device.connected
              ? `${device.kind === "simulated" ? "Streaming" : (device.status.deviceName ?? "Your band")}${typeof device.status.battery === "number" ? ` · battery ${device.status.battery}%` : ""}`
              : "Connects at the start of each session, or now from the Band page."}
          </span>
        </p>
        <Link href="/cloud/device/" className="button" data-variant="ghost" data-size="small">
          Open Band
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </Section>
  );
}
