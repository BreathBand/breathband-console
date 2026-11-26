"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, Mark } from "@/components/Icon";
import { LiveTrace } from "@/components/LiveTrace";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { bluetoothSupport } from "@/lib/device/bluetooth";
import { useDevice } from "@/lib/device/DeviceProvider";
import { defaultDetails, planDefaults, withOnboardingAnswers, type Plan, type TrackDetails } from "@/lib/domain/goal-questions";
import { defaultPreferences, GOALS, goalOf, SKILL_LEVELS, skillBandText } from "@/lib/domain/preferences";
import type { BreathGoal, GoalDetails, UserPreferences, UserProfile } from "@/lib/domain/types";
import { LENGTHS } from "@/lib/prefs";
import { markSetupFinished } from "../CloudShell";
import { stateWords } from "../device/words";
import { GoalQuestions } from "./GoalQuestions";
import { daysText, PlanStep } from "./PlanStep";

type Step = "name" | "goal" | "questions" | "level" | "sessions" | "plan" | "band" | "done";
const ATHLETE_STEPS: Step[] = ["name", "goal", "questions", "level", "sessions", "plan", "band", "done"];
const COACH_STEPS: Step[] = ["name", "done"];
const STEP_LABELS: Record<Step, string> = {
  name: "You",
  goal: "Your goal",
  questions: "About your goal",
  level: "Experience",
  sessions: "Your sessions",
  plan: "Your plan",
  band: "Your band",
  done: "Ready",
};

/** A plan already on the profile (onboarding run again), or null to follow the track's defaults. */
function savedPlan(p: UserPreferences | null | undefined): Plan | null {
  if (!p?.dailyMinutes || !p.reminders) return null;
  return { sessionsPerWeek: p.sessionsPerWeek, dailyMinutes: p.dailyMinutes, reminders: { ...p.reminders } };
}

/** /cloud/welcome/ — first-run setup. Everything chosen here can be changed later in Settings. */
export default function WelcomePage() {
  const auth = useAuth();
  if (auth.status !== "signed-in" || !auth.profile) return null;
  return <Welcome key={auth.profile.uid} profile={auth.profile} />;
}

function Welcome({ profile }: { profile: UserProfile }) {
  const backend = useBackend();
  const router = useRouter();
  const coach = profile.role === "coach";
  const steps = coach ? COACH_STEPS : ATHLETE_STEPS;
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(profile.displayName);
  const [prefs, setPrefs] = useState<UserPreferences>(() => profile.preferences ?? defaultPreferences());
  // Answers are kept per track while onboarding, so going back to change the goal loses nothing; only the chosen goal's are saved.
  const [answers, setAnswers] = useState<GoalDetails>(() => ({ ...profile.preferences?.goalDetails }));
  // Null until the plan step is touched: until then it follows the track and the answers.
  const [plan, setPlan] = useState<Plan | null>(() => savedPlan(profile.preferences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = steps.indexOf(step);
  const first = name.trim().split(" ")[0] || "there";

  const details: TrackDetails = answers[prefs.goal] ?? defaultDetails(prefs.goal);
  const shownPlan = plan ?? planDefaults(prefs.goal, details);
  const final = coach ? prefs : withOnboardingAnswers(prefs, answers[prefs.goal] ?? null, plan);

  const go = (delta: number) => setStep(steps[Math.max(0, Math.min(steps.length - 1, index + delta))]);
  const pickGoal = (goal: BreathGoal) => {
    const g = goalOf(goal);
    setPrefs((p) => ({ ...p, goal, session: { ...g.session }, sessionsPerWeek: g.sessionsPerWeek }));
  };

  async function finish(next: string) {
    setSaving(true);
    setError(null);
    try {
      await backend.data.updateProfile(profile.uid, {
        displayName: name.trim() || profile.displayName,
        preferences: { ...final, onboardedAt: new Date().toISOString() },
      });
      markSetupFinished();
      router.replace(next);
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Couldn't save your choices. Try again.");
    }
  }

  return (
    <div className="welcome">
      <aside className="welcome-side theme-dark" aria-label="Setup steps">
        <div className="welcome-brand">
          <Mark size={28} label="" />
          <span>
            Breathband<sup>®</sup>
          </span>
        </div>
        <div className="welcome-breath" aria-hidden="true">
          <span />
        </div>
        <ol className="welcome-steps">
          {steps.map((s, i) => (
            <li key={s} data-state={i < index ? "done" : i === index ? "current" : "next"} aria-current={i === index ? "step" : undefined}>
              <span className="ws-n">{i < index ? <Icon name="check" size={14} /> : i + 1}</span>
              {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
        <p className="welcome-note">Everything here can be changed later in Settings.</p>
      </aside>

      <main className="welcome-main">
        <div className="welcome-progress" aria-hidden="true">
          <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="welcome-step" key={step}>
          {step === "name" && (
            <form
              className="welcome-form"
              onSubmit={(e) => {
                e.preventDefault();
                go(1);
              }}
            >
              <h1>{coach ? "Welcome to BreathCloud." : "Welcome to Breathband."}</h1>
              <p className="welcome-lede">
                {coach
                  ? "BreathCloud shows you the athletes who share their sessions with you: who trained, who needs a look, and every breath against the pacer."
                  : "A few questions so your sessions, scores and goals fit you. It takes about a minute."}
              </p>
              <label className="field welcome-field">
                What should we call you?
                <input value={name} maxLength={80} autoComplete="name" autoFocus onChange={(e) => setName(e.target.value)} required />
              </label>
              <div className="welcome-actions">
                <button type="submit" className="button" data-size="large" disabled={!name.trim()}>
                  Continue
                  <Icon name="arrowRight" size={18} />
                </button>
              </div>
            </form>
          )}

          {step === "goal" && (
            <section>
              <h1>What brings you to Breathband, {first}?</h1>
              <p className="welcome-lede">This sets your starting sessions and weekly goal. It never changes how you&rsquo;re scored.</p>
              <div className="goal-cards" role="radiogroup" aria-label="Your goal">
                {GOALS.map((g) => (
                  <button key={g.id} type="button" role="radio" aria-checked={prefs.goal === g.id} className="goal-card" onClick={() => pickGoal(g.id)}>
                    <small>{g.who}</small>
                    <b className="display">{g.label}</b>
                    <span>{g.detail}</span>
                  </button>
                ))}
              </div>
              <Nav onBack={() => go(-1)} onNext={() => go(1)} />
            </section>
          )}

          {step === "questions" && (
            <section>
              <GoalQuestions goal={prefs.goal} value={details} onChange={(next) => setAnswers((a) => ({ ...a, [prefs.goal]: next }))} />
              <Nav
                onBack={() => go(-1)}
                onNext={() => go(1)}
                skipLabel="Skip these"
                onSkip={() => {
                  setAnswers((a) => ({ ...a, [prefs.goal]: defaultDetails(prefs.goal) }));
                  go(1);
                }}
              />
            </section>
          )}

          {step === "level" && (
            <section>
              <h1>How much breath training have you done?</h1>
              <p className="welcome-lede">Your level sets how close to the pacer counts as on target, so a score of 8 means the same effort for everyone.</p>
              <div className="level-list" role="radiogroup" aria-label="Experience">
                {SKILL_LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    aria-checked={prefs.skillLevel === l.id}
                    className="level-opt"
                    onClick={() => setPrefs((p) => ({ ...p, skillLevel: l.id }))}
                  >
                    <span className="level-radio" aria-hidden="true" />
                    <span>
                      <b>{l.label}</b>
                      <small>{l.detail}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p className="welcome-hint">
                <Icon name="info" size={16} />
                At this level, {skillBandText(prefs.skillLevel)}.
              </p>
              <Nav onBack={() => go(-1)} onNext={() => go(1)} />
            </section>
          )}

          {step === "sessions" && (
            <section>
              <h1>Your sessions</h1>
              <p className="welcome-lede">
                Set up for <b>{goalOf(prefs.goal).label}</b>. Adjust anything; New session starts from here every time.
              </p>
              <div className="welcome-grid">
                <fieldset className="choice">
                  <legend>Session</legend>
                  <div className="seg" role="group" aria-label="Session">
                    {(["paced", "open"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={prefs.session.mode === m}
                        onClick={() =>
                          setPrefs((p) => ({
                            ...p,
                            session: { ...p.session, mode: m, durationSec: m === "paced" && p.session.durationSec === 0 ? 300 : p.session.durationSec },
                          }))
                        }
                      >
                        {m === "paced" ? "Paced" : "Open"}
                      </button>
                    ))}
                  </div>
                </fieldset>
                {prefs.session.mode === "paced" && (
                  <fieldset className="choice">
                    <legend>Pacer</legend>
                    <div className="seg" role="group" aria-label="Pacer">
                      {([5, 2] as const).map((h) => (
                        <button key={h} type="button" aria-pressed={prefs.session.pacerHalfCycleSec === h} onClick={() => setPrefs((p) => ({ ...p, session: { ...p.session, pacerHalfCycleSec: h } }))}>
                          {h}-{h} {h === 5 ? "slow" : "quicker"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <fieldset className="choice">
                  <legend>Length</legend>
                  <div className="seg" role="group" aria-label="Length">
                    {LENGTHS.filter((l) => prefs.session.mode === "open" || l.sec > 0).map((l) => (
                      <button key={l.sec} type="button" aria-pressed={prefs.session.durationSec === l.sec} onClick={() => setPrefs((p) => ({ ...p, session: { ...p.session, durationSec: l.sec } }))}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="choice">
                  <legend>Tones</legend>
                  <div className="seg" role="group" aria-label="Tones">
                    {[true, false].map((on) => (
                      <button key={String(on)} type="button" aria-pressed={prefs.session.sound === on} onClick={() => setPrefs((p) => ({ ...p, session: { ...p.session, sound: on } }))}>
                        {on ? "On" : "Silent"}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <Nav onBack={() => go(-1)} onNext={() => go(1)} />
            </section>
          )}

          {step === "plan" && (
            <section>
              <PlanStep goal={prefs.goal} plan={shownPlan} onChange={setPlan} />
              <Nav
                onBack={() => go(-1)}
                onNext={() => go(1)}
                skipLabel="Use the defaults"
                onSkip={() => {
                  setPlan(null);
                  go(1);
                }}
              />
            </section>
          )}

          {step === "band" && <BandStep onBack={() => go(-1)} onNext={() => go(1)} />}

          {step === "done" && (
            <section>
              <h1>{coach ? `You're set, ${first}.` : `You're ready, ${first}.`}</h1>
              {coach ? (
                <p className="welcome-lede">Add your first athletes by sending them a link or entering the code they give you.</p>
              ) : (
                <dl className="welcome-summary">
                  <div>
                    <dt>Goal</dt>
                    <dd>{goalOf(prefs.goal).label}</dd>
                  </div>
                  <div>
                    <dt>Level</dt>
                    <dd>{SKILL_LEVELS.find((l) => l.id === prefs.skillLevel)?.label}</dd>
                  </div>
                  <div>
                    <dt>Sessions</dt>
                    <dd>
                      {prefs.session.mode === "paced" ? `Paced ${prefs.session.pacerHalfCycleSec}-${prefs.session.pacerHalfCycleSec}` : "Open"} ·{" "}
                      {LENGTHS.find((l) => l.sec === prefs.session.durationSec)?.label ?? ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Weekly goal</dt>
                    <dd>{final.sessionsPerWeek} a week</dd>
                  </div>
                  <div>
                    <dt>Each day</dt>
                    <dd>{final.dailyMinutes} min a day</dd>
                  </div>
                  <div>
                    <dt>Reminder</dt>
                    <dd>{final.reminders?.enabled ? `${final.reminders.time}, ${daysText(final.reminders.days)}` : "Off"}</dd>
                  </div>
                </dl>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="welcome-actions">
                {coach ? (
                  <button type="button" className="button" data-size="large" disabled={saving} onClick={() => finish("/cloud/athletes/")}>
                    {saving ? "Saving…" : "Add athletes"}
                    <Icon name="arrowRight" size={18} />
                  </button>
                ) : (
                  <button type="button" className="button" data-size="large" disabled={saving} onClick={() => finish("/cloud/record/")}>
                    <span className="rec-dot" aria-hidden="true" />
                    {saving ? "Saving…" : "Start my first session"}
                  </button>
                )}
                <button type="button" className="button" data-variant="ghost" disabled={saving} onClick={() => finish("/cloud/")}>
                  {coach ? "Go to the dashboard" : "Go to my home"}
                </button>
                <button type="button" className="link" disabled={saving} onClick={() => go(-1)}>
                  Back
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextLabel = "Continue",
  onSkip,
  skipLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  return (
    <div className="welcome-actions">
      <button type="button" className="button" data-size="large" onClick={onNext}>
        {nextLabel}
        <Icon name="arrowRight" size={18} />
      </button>
      {onSkip && (
        <button type="button" className="button" data-variant="ghost" onClick={onSkip}>
          {skipLabel}
        </button>
      )}
      <button type="button" className="link" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

/** Connect the band now (or the simulator), or skip: either way the next session can connect it. */
function BandStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const device = useDevice();
  const support = typeof window === "undefined" ? "unsupported" : bluetoothSupport();
  const busy = ["requesting", "connecting", "reconnecting"].includes(device.status.state);

  return (
    <section>
      <h1>Connect your band</h1>
      <p className="welcome-lede">Breathband reads the rise and fall of your belly. No band yet? The simulated band streams a breathing athlete so you can try everything.</p>
      <div className="band-choices">
        <button
          type="button"
          className="source"
          aria-pressed={device.kind === "bluetooth"}
          disabled={support !== "supported"}
          onClick={() => device.setKind("bluetooth")}
        >
          <span className="source-icon">
            <Icon name="bluetooth" size={22} />
          </span>
          <span className="source-text">
            <b>My Breathband</b>
            <span>{support === "supported" ? "Over Bluetooth. Turn it on and keep it close." : "Needs Chrome or Edge over HTTPS."}</span>
          </span>
        </button>
        <button type="button" className="source" aria-pressed={device.kind === "simulated"} onClick={() => device.setKind("simulated")}>
          <span className="source-icon">
            <Icon name="signal" size={22} />
          </span>
          <span className="source-text">
            <b>Simulated band</b>
            <span>A breathing athlete, streamed exactly like the band.</span>
          </span>
        </button>
      </div>
      <div className="welcome-band theme-dark">
        {device.connected ? (
          <>
            <LiveTrace read={device.recent} window={240} height={80} label="Live signal from your band" />
            <p>
              <i className="live" aria-hidden="true" /> {device.kind === "simulated" ? "Simulated band" : (device.status.deviceName ?? "Breathband")} connected. That&rsquo;s your breathing.
            </p>
          </>
        ) : (
          <div className="welcome-band-off">
            <p>{device.status.message ?? stateWords(device.status.state)}</p>
            <button type="button" className="button" disabled={busy} onClick={() => void device.connect()}>
              <Icon name={device.kind === "simulated" ? "signal" : "bluetooth"} size={18} />
              {busy ? "Connecting…" : device.kind === "simulated" ? "Start the simulated band" : "Connect"}
            </button>
          </div>
        )}
      </div>
      <Nav onBack={onBack} onNext={onNext} nextLabel={device.connected ? "Continue" : "Skip for now"} />
      <p className="welcome-hint">
        <Icon name="info" size={16} />
        You can change bands any time under Band in the menu.
      </p>
    </section>
  );
}
