"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Icon, Mark, type IconName } from "@/components/Icon";
import { LiveTrace } from "@/components/LiveTrace";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useDevice } from "@/lib/device/DeviceProvider";
import { currentSupport, supportAdvice, UNKNOWN_SUPPORT, type BandSupport } from "@/lib/device/support";
import { firstSession, firstSessionHref } from "@/lib/domain/first-session";
import { defaultDetails, planDefaults, withOnboardingAnswers, type Plan, type TrackDetails } from "@/lib/domain/goal-questions";
import { defaultPreferences, GOALS, goalOf, SKILL_LEVELS, skillBandText } from "@/lib/domain/preferences";
import { cleanProProfile, defaultProProfile, practiceProblem, proSummary, usesProblem } from "@/lib/domain/pro-profile";
import { peopleNouns } from "@/lib/domain/terminology";
import type { BandRoute, BreathGoal, GoalDetails, ProKind, ProProfile, UserPreferences, UserProfile } from "@/lib/domain/types";
import { LENGTHS } from "@/lib/prefs";
import { markSetupFinished } from "../CloudShell";
import { stateWords } from "../device/words";
import { bandSummary, deviceKindFor, finishActions, initialRoute, onboardingFor, ROUTE_OPTIONS, routeAvailable } from "./band-route";
import { GoalQuestions } from "./GoalQuestions";
import { daysText, PlanStep } from "./PlanStep";
import { KindStep, PeopleStep, PracticeStep, UsesStep } from "./ProSteps";
import { Waitlist } from "./Waitlist";

type Step = "name" | "goal" | "questions" | "level" | "sessions" | "plan" | "band" | "kind" | "practice" | "uses" | "people" | "done";
const ATHLETE_STEPS: Step[] = ["name", "goal", "questions", "level", "sessions", "plan", "band", "done"];
// Professionals sign up with role "coach"; the kind step says which kind of work (planning/v1/02 §4.1).
const COACH_STEPS: Step[] = ["name", "kind", "practice", "uses", "people", "done"];
const STEP_LABELS: Record<Step, string> = {
  name: "You",
  goal: "Your goal",
  questions: "About your goal",
  level: "Experience",
  sessions: "Your sessions",
  plan: "Your plan",
  band: "Your band",
  kind: "Your work",
  practice: "Your practice",
  uses: "What it's for",
  people: "Your people",
  done: "Ready",
};

const noop = () => () => {};

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
  const support = useSyncExternalStore(noop, currentSupport, () => UNKNOWN_SUPPORT);
  // The band step's choice: null until a route is picked (or when skipped).
  const [route, setRoute] = useState<BandRoute | null>(() => initialRoute(profile.preferences?.onboarding, currentSupport()));
  const [sampleData, setSampleData] = useState(() => profile.preferences?.onboarding?.sampleData ?? true);
  // Professionals: the kind, and answers kept per kind so going back to change it loses nothing; only the chosen kind's are saved.
  const [proKind, setProKind] = useState<ProKind | null>(() => profile.proKind ?? null);
  const [proAnswers, setProAnswers] = useState<Partial<Record<ProKind, ProProfile>>>(() =>
    profile.proProfile ? { [profile.proProfile.kind]: profile.proProfile } : {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const index = steps.indexOf(step);
  const first = name.trim().split(" ")[0] || "there";

  const details: TrackDetails = answers[prefs.goal] ?? defaultDetails(prefs.goal);
  const shownPlan = plan ?? planDefaults(prefs.goal, details);
  const choice = route ? onboardingFor(route, sampleData) : null;
  const answered = withOnboardingAnswers(prefs, answers[prefs.goal] ?? null, plan);
  const final = coach ? prefs : choice ? { ...answered, onboarding: choice } : answered;
  // With a band in hand, finishing goes straight into fit, calibration and the track's first session (§3.1, order rule).
  const suggested = firstSession(final);
  const withBand = choice ? deviceKindFor(choice.bandRoute) !== null : false;
  const actions = finishActions(choice, firstSessionHref(suggested));
  const secondary = actions.secondary;
  const pro = proKind ? cleanProProfile(proAnswers[proKind] ?? defaultProProfile(proKind)) : null;
  const shownPro = proKind ? (proAnswers[proKind] ?? defaultProProfile(proKind)) : null;
  const setPro = (next: ProProfile) => setProAnswers((a) => ({ ...a, [next.kind]: next }));
  const nouns = peopleNouns(pro ? { proKind: pro.kind, proProfile: pro } : profile);

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
        ...(coach && pro ? { proKind: pro.kind, proProfile: pro } : {}),
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
                  ? "BreathCloud shows you the people who share their sessions with you: who practised, who needs a look, and every breath against the pacer. A few questions first, about a minute."
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

          {step === "kind" && (
            <section>
              <KindStep kind={proKind} onPick={setProKind} first={first} />
              <Nav onBack={() => go(-1)} onNext={() => go(1)} nextDisabled={!proKind} />
            </section>
          )}

          {step === "practice" && shownPro && pro && (
            <section>
              <PracticeStep value={shownPro} onChange={setPro} />
              <Nav onBack={() => go(-1)} onNext={() => go(1)} nextDisabled={practiceProblem(pro) !== null} />
            </section>
          )}

          {step === "uses" && shownPro && pro && (
            <section>
              <UsesStep value={shownPro} onChange={setPro} />
              <Nav onBack={() => go(-1)} onNext={() => go(1)} nextDisabled={usesProblem(pro) !== null} />
            </section>
          )}

          {step === "people" && shownPro && (
            <section>
              <PeopleStep value={shownPro} onChange={setPro} />
              <Nav onBack={() => go(-1)} onNext={() => go(1)} />
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

          {step === "band" && (
            <BandStep
              support={support}
              route={route}
              onRoute={setRoute}
              sampleData={sampleData}
              onSampleData={setSampleData}
              email={profile.email}
              onBack={() => go(-1)}
              onNext={() => go(1)}
              onSkip={() => {
                setRoute(null);
                go(1);
              }}
            />
          )}

          {step === "done" && (
            <section>
              <h1>{coach ? `You're set, ${first}.` : `You're ready, ${first}.`}</h1>
              {coach ? (
                <>
                  <p className="welcome-lede">
                    Add your first {nouns.many} by sending them a link or entering the code they give you.
                  </p>
                  {pro && (
                    <dl className="welcome-summary">
                      {proSummary(pro).map(([term, detail]) => (
                        <div key={term}>
                          <dt>{term}</dt>
                          <dd>{detail}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
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
                  <div>
                    <dt>Band</dt>
                    <dd>{bandSummary(choice)}</dd>
                  </div>
                  {withBand && (
                    <div>
                      <dt>First session</dt>
                      <dd>
                        {suggested.name} · {suggested.setup.mode === "paced" ? `Paced ${suggested.setup.pacer}-${suggested.setup.pacer}` : "Open"} ·{" "}
                        {Math.round(suggested.setup.lengthSec / 60)} min, after a strap check and calibration
                      </dd>
                    </div>
                  )}
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
                    {saving ? "Saving…" : `Add ${nouns.many}`}
                    <Icon name="arrowRight" size={18} />
                  </button>
                ) : (
                  <button type="button" className="button" data-size="large" disabled={saving} onClick={() => finish(actions.primary.href)}>
                    {actions.primary.record && <span className="rec-dot" aria-hidden="true" />}
                    {saving ? "Saving…" : actions.primary.label}
                    {!actions.primary.record && !saving && <Icon name="arrowRight" size={18} />}
                  </button>
                )}
                {coach ? (
                  <button type="button" className="button" data-variant="ghost" disabled={saving} onClick={() => finish("/cloud/")}>
                    Go to the dashboard
                  </button>
                ) : (
                  secondary && (
                    <button type="button" className="button" data-variant="ghost" disabled={saving} onClick={() => finish(secondary.href)}>
                      {secondary.label}
                    </button>
                  )
                )}
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
  nextDisabled = false,
  onSkip,
  skipLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  return (
    <div className="welcome-actions">
      <button type="button" className="button" data-size="large" disabled={nextDisabled} onClick={onNext}>
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


const ROUTE_ICONS: Record<BandRoute, IconName> = { bluetooth: "bluetooth", app: "phone", none: "lungs", simulated: "signal" };

/**
 * The band step: the browser check first, then the four ways in (planning/v1/02
 * §3.1, step 9). Only the real band depends on the browser, so a person on
 * Safari, Firefox or an iPhone is told plainly what works and can still finish.
 */
function BandStep({
  support,
  route,
  onRoute,
  sampleData,
  onSampleData,
  email,
  onBack,
  onNext,
  onSkip,
}: {
  support: BandSupport;
  route: BandRoute | null;
  onRoute: (route: BandRoute) => void;
  sampleData: boolean;
  onSampleData: (on: boolean) => void;
  email: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const device = useDevice();
  const advice = supportAdvice(support);
  const busy = ["requesting", "connecting", "reconnecting"].includes(device.status.state);
  const connects = route ? deviceKindFor(route) : null;

  const choose = (next: BandRoute) => {
    onRoute(next);
    const kind = deviceKindFor(next);
    if (!kind || kind === device.kind) return;
    if (device.connected || busy) void device.disconnect();
    device.setKind(kind);
  };

  return (
    <section>
      <h1>Your band</h1>
      <p className="welcome-lede">Breathband reads the rise and fall of your belly. Choose how you&rsquo;ll breathe with it; you can change this any time under Band.</p>

      {advice && (
        <div className="welcome-notice" role="note" aria-label="Browser check">
          <Icon name="info" size={18} />
          <div>
            <b>{advice.title}</b>
            <p>{advice.detail}</p>
            <p>You can still finish setting up: use the phone app, look around with sample sessions, or try the simulated band.</p>
          </div>
        </div>
      )}

      <div className="band-choices" role="radiogroup" aria-label="How you'll breathe with Breathband">
        {ROUTE_OPTIONS.map((o) => {
          const open = routeAvailable(o.id, support);
          return (
            <button key={o.id} type="button" role="radio" aria-checked={route === o.id} className="source" disabled={!open} onClick={() => choose(o.id)}>
              <span className="source-icon">
                <Icon name={ROUTE_ICONS[o.id]} size={22} />
              </span>
              <span className="source-text">
                <b>{o.label}</b>
                <span>{open ? o.detail : o.unavailable}</span>
              </span>
            </button>
          );
        })}
      </div>

      {connects && (
        <div className="welcome-band theme-dark">
          {device.connected && device.kind === connects ? (
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
                <Icon name={connects === "simulated" ? "signal" : "bluetooth"} size={18} />
                {busy ? "Connecting…" : connects === "simulated" ? "Start the simulated band" : "Connect"}
              </button>
            </div>
          )}
        </div>
      )}
      {route === "bluetooth" && !device.connected && (
        <p className="welcome-hint">
          <Icon name="info" size={16} />
          Won&rsquo;t connect? Charge the band, bring it closer, close the phone app, and turn Bluetooth off and on.
        </p>
      )}

      {route === "app" && (
        <div className="welcome-route">
          <p>
            Record with the Breathband app on your phone, signed in as <b>{email}</b>. Your sessions, goal and plan show up here.
          </p>
        </div>
      )}

      {route === "none" && (
        <div className="welcome-route">
          <label className="welcome-check">
            <input type="checkbox" checked={sampleData} onChange={(e) => onSampleData(e.target.checked)} />
            <span>
              <b>Explore with sample sessions</b>
              <small>A made-up person&rsquo;s sessions, marked Sample. Nothing is added to your account, and you can leave sample mode any time.</small>
            </span>
          </label>
          <Waitlist email={email} />
        </div>
      )}

      <Nav onBack={onBack} onNext={onNext} nextDisabled={!route} skipLabel="Skip for now" onSkip={onSkip} />
    </section>
  );
}
