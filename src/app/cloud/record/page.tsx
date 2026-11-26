"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { LiveTrace } from "@/components/LiveTrace";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useDevice } from "@/lib/device/DeviceProvider";
import { assignmentProgress, describeAssignment, dueText, isOpen } from "@/lib/domain/coaching";
import { LENGTHS, readSetup, saveSetup, setupFromPreferences, setupQuery, SKILLS, type SessionSetup } from "@/lib/prefs";
import { useLoad } from "@/lib/useLoad";
import { PERSONAS, stateWords } from "../device/words";
import { PRO_WORD, withPractice } from "../home/tailor";

export default function RecordSetupPage() {
  return (
    <Suspense fallback={null}>
      <RecordSetup />
    </Suspense>
  );
}

/**
 * Set up a session: what kind, which pacer, how long, how it looks and sounds. Then start.
 * Home's start button sends a professional's practice in the query (home/tailor.ts `homeStart`), and it's set here.
 */
function RecordSetup() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const backend = useBackend();
  const device = useDevice();
  // The person's saved defaults (from onboarding and Settings); this browser's last setup when there are none.
  const [setup, setSetup] = useState<SessionSetup>(() => {
    const prefs = auth.status === "signed-in" ? auth.profile?.preferences : null;
    return withPractice(prefs ? setupFromPreferences(prefs) : readSetup(), new URLSearchParams(params.toString()));
  });
  const uid = auth.status === "signed-in" ? auth.user.uid : null;
  const isAthlete = auth.status === "signed-in" && auth.profile?.role === "athlete";

  const practice = useLoad(uid && isAthlete ? `record-practice:${uid}` : null, async () => {
    const [assignments, sessions, professionals] = await Promise.all([
      backend.data.listAssignments(uid!),
      backend.data.listSessions(uid!, { limit: 200 }),
      backend.data.listCoaches(uid!),
    ]);
    const now = new Date();
    return { plans: assignments.map((a) => assignmentProgress(a, sessions, now)).filter(isOpen), professionals };
  });

  const set = (patch: Partial<SessionSetup>) => setSetup((s) => ({ ...s, ...patch }));
  const start = () => {
    saveSetup(setup);
    router.push(`/cloud/record/live/?${setupQuery(setup)}`);
  };
  const plan = practice.status === "ready" ? practice.data.plans[0] : undefined;
  // Who set it, in the word for their kind: "From your clinician" (older accounts read as a coach).
  const setBy = plan && practice.status === "ready" ? practice.data.professionals.find((p) => p.uid === plan.assignment.coachId) : undefined;
  const proWord = PRO_WORD[setBy?.proKind ?? setBy?.proProfile?.kind ?? "coach"];
  const busy = ["requesting", "connecting", "reconnecting"].includes(device.status.state);

  return (
    <div className="container page record-setup">
      <header className="page-head">
        <div>
          <h1>New session</h1>
          <p className="page-lede">Choose how you want to breathe. Your band calibrates at the start, and your score is ready the moment you stop.</p>
        </div>
        <Link href="/cloud/record/duo/" className="button" data-variant="ghost" data-size="small">
          <Icon name="users" size={16} />
          Two-person session
        </Link>
      </header>

      {plan && (
        <section className="practice-hint" aria-label={`Practice from your ${proWord}`}>
          <Icon name="plan" size={20} />
          <p>
            <b>From your {proWord}:</b> {describeAssignment(plan.assignment)}. {plan.done} of {plan.assignment.target} done,{" "}
            {dueText(plan.daysLeft).toLowerCase()}.
          </p>
          <button
            type="button"
            className="button"
            data-variant="ghost"
            data-size="small"
            onClick={() =>
              set({
                mode: plan.assignment.mode,
                pacer: plan.assignment.pacerHalfCycleSec ?? setup.pacer,
                lengthSec: plan.assignment.durationSec,
              })
            }
          >
            Use these settings
          </button>
        </section>
      )}

      <div className="setup-main">
        <div className="setup-top">
            <fieldset className="choice">
              <legend>Session</legend>
              <div className="mode-cards">
                <button type="button" className="mode-card" aria-pressed={setup.mode === "paced"} onClick={() => set({ mode: "paced", lengthSec: setup.lengthSec || 300 })}>
                  <PacedGlyph />
                  <b>Paced</b>
                  <span>Follow the pacer in and out. You get a Total Breath Score from 1 to 10.</span>
                </button>
                <button type="button" className="mode-card" aria-pressed={setup.mode === "open"} onClick={() => set({ mode: "open" })}>
                  <OpenGlyph />
                  <b>Open</b>
                  <span>Breathe your own way. You see your rate, rhythm and depth, before and after anything you mark.</span>
                </button>
              </div>
            </fieldset>
          <div className="setup-band-col">
            <h2 className="choice-label" id="band-label">
              Band
            </h2>
            <aside className="setup-band pane" aria-labelledby="band-label">
              <div className="setup-band-head">
                <b>{device.kind === "simulated" ? "Simulated band" : (device.status.deviceName ?? "Breathband")}</b>
                <span className="device-state" data-state={device.status.state}>
                  <i aria-hidden="true" />
                  {device.stalled ? "No signal" : stateWords(device.status.state)}
                </span>
              </div>
              {device.connected ? (
                <>
                  <div className="setup-band-trace theme-dark">
                    <LiveTrace read={device.recent} window={240} height={72} label="Live signal" />
                  </div>
                  {device.kind === "simulated" && (
                    <label className="field">
                      Simulated athlete
                      <select value={device.persona} onChange={(e) => device.setPersona(e.target.value as typeof device.persona)}>
                        {PERSONAS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} · {p.detail}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              ) : (
                <>
                  <p className="muted small">
                    {device.kind === "simulated"
                      ? "The simulated band will stand in for your Breathband."
                      : "Turn your Breathband on and keep it close."}
                  </p>
                  <button type="button" className="button" data-variant="ghost" disabled={busy} onClick={() => void device.connect()}>
                    <Icon name={device.kind === "simulated" ? "signal" : "bluetooth"} size={18} />
                    {busy ? "Connecting…" : device.kind === "simulated" ? "Start the simulated band" : "Connect your band"}
                  </button>
                  <Link href="/cloud/device/" className="link small">
                    Band settings
                  </Link>
                </>
              )}
            </aside>
          </div>
        </div>

          {setup.mode === "paced" && (
            <fieldset className="choice">
              <legend>Pacer</legend>
              <div className="seg seg-lg" role="group" aria-label="Pacer">
                {([5, 2] as const).map((p) => (
                  <button key={p} type="button" aria-pressed={setup.pacer === p} onClick={() => set({ pacer: p })}>
                    <b>
                      {p}-{p}
                    </b>
                    <small>{p === 5 ? "Slow · 6 breaths a minute" : "Quicker · 15 breaths a minute"}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="choice">
            <legend>Length</legend>
            <div className="seg seg-lg" role="group" aria-label="Length">
              {LENGTHS.filter((l) => setup.mode === "open" || l.sec > 0).map((l) => (
                <button key={l.sec} type="button" aria-pressed={setup.lengthSec === l.sec} onClick={() => set({ lengthSec: l.sec })}>
                  <b>{l.label}</b>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="choice-row">
            {setup.mode === "paced" && (
              <fieldset className="choice">
                <legend>Pacer view</legend>
                <div className="seg" role="group" aria-label="Pacer view">
                  {(["circle", "line"] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={setup.view === v} onClick={() => set({ view: v })}>
                      {v === "circle" ? "Circle" : "Line"}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <fieldset className="choice">
              <legend>Sound</legend>
              <div className="seg" role="group" aria-label="Sound">
                {[true, false].map((on) => (
                  <button key={String(on)} type="button" aria-pressed={setup.sound === on} onClick={() => set({ sound: on })}>
                    <Icon name={on ? "volume" : "volumeOff"} size={16} />
                    {on ? "Tones on" : "Silent"}
                  </button>
                ))}
              </div>
            </fieldset>
            {setup.mode === "paced" && (
              <fieldset className="choice">
                <legend>Level</legend>
                <label className="field select-field">
                  <span className="sr-only">Skill level</span>
                  <select value={setup.skill} onChange={(e) => set({ skill: e.target.value as SessionSetup["skill"] })}>
                    {SKILLS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} · {s.detail}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>
            )}
          </div>
      </div>

      <div className="setup-go">
        <p>
          {setup.mode === "paced" ? `Paced ${setup.pacer}-${setup.pacer}` : "Open"} ·{" "}
          {setup.lengthSec ? LENGTHS.find((l) => l.sec === setup.lengthSec)?.label ?? `${Math.round(setup.lengthSec / 60)} min` : "until you stop"}
          {setup.mode === "paced" ? ` · ${setup.view === "circle" ? "circle" : "line"} pacer` : ""} · {setup.sound ? "tones on" : "silent"}
        </p>
        <button type="button" className="button" data-size="large" onClick={start}>
          <span className="rec-dot" aria-hidden="true" />
          Start session
        </button>
      </div>
    </div>
  );
}

function PacedGlyph() {
  return (
    <svg viewBox="0 0 64 40" className="mode-glyph" aria-hidden="true">
      <path d="M2 30 C 12 30 12 10 22 10 S 32 30 42 30 S 52 10 62 10" className="g-pacer" />
      <path d="M2 31 C 12 31 13 12 22 12" className="g-in" />
      <path d="M22 12 C 31 12 33 29 42 29" className="g-out" />
    </svg>
  );
}

function OpenGlyph() {
  return (
    <svg viewBox="0 0 64 40" className="mode-glyph" aria-hidden="true">
      <path d="M2 20 H62" className="g-mid" />
      <path d="M2 28 C 8 28 9 12 14 12" className="g-in" />
      <path d="M14 12 C 22 12 24 28 32 28" className="g-out" />
      <path d="M32 28 C 37 28 38 13 43 13" className="g-in" />
      <path d="M43 13 C 52 13 54 28 62 28" className="g-out" />
    </svg>
  );
}
