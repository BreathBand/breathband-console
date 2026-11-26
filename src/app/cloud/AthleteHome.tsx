"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { RateBars, type TrendPoint } from "@/components/charts";
import { Measured } from "@/components/Measured";
import { Progress } from "@/components/Progress";
import { Arrow, Dot } from "@/components/Score";
import { TimeTrend, type TimePoint } from "@/components/trendCharts";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useDevice } from "@/lib/device/DeviceProvider";
import { activity } from "@/lib/domain/activity";
import { dailyMinutesOf, mechanicsOf, ringOf, streakOf } from "@/lib/domain/habit";
import { describeAssignment, dueText, isOpen } from "@/lib/domain/coaching";
import { describeMode, formatDay, formatDuration, formatTime } from "@/lib/domain/format";
import { formatScore, headline, isTransitionScores, scoreWord } from "@/lib/domain/scores";
import { goalOf } from "@/lib/domain/preferences";
import type { SessionSummary, UserPreferences, Waveform } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import type { Workspace } from "./AthleteWorkspace";
import { calmLine, homeLayout, professionalOf, trendPeriod, withMechanics } from "./home/tailor";
import { NewMilestones } from "./home/Milestones";
import { LatestComment, ProfessionalCard } from "./home/ProfessionalCard";
import { WeekCard } from "./home/WeekCard";

const DAY = 86_400_000;

/** Flag texts are written for a coach ("their target"); on the athlete's own home they read as "your". */
export function ownWords(text: string): string {
  return text.replace(/\btheir\b/g, "your").replace(/\bThey\b/g, "You").replace(/\bthey\b/g, "you");
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * Days in a row, with one rest day per rolling 7 days (lib/domain/habit.ts).
 * Re-exported here for the results line and the session review, which read it from Home.
 */
export { streakDays } from "@/lib/domain/habit";

/**
 * The athlete's home, built to fit one laptop screen: a greeting with the
 * suggested session as the one primary action, the last session as a dark
 * instrument card beside the week at a glance, then the score trend beside
 * what the coach has set and said and the latest sessions.
 *
 * The goal tailors it (home/tailor.ts): Train is dense, Focus keeps the score
 * and a shorter trend, Calm is minimal with one encouraging line. Someone
 * linked to a professional sees that person's card first.
 */
export function AthleteHome({ ws }: { ws: Workspace }) {
  const auth = useAuth();
  const { sessions, now, targets } = ws;
  const first = ws.name.split(" ")[0];
  const prefs = auth.status === "signed-in" ? auth.profile?.preferences : null;

  if (sessions.length === 0) return <FirstRun name={first} now={now} />;

  const professional = professionalOf(ws.coachName, ws.coachKind);
  const mechanics = mechanicsOf(prefs, professional?.kind === "clinician");
  const layout = withMechanics(homeLayout({ goal: prefs?.goal ?? null, professional, plans: ws.plans }), mechanics);
  const a = activity(sessions, now, ws.rules, targets);
  const latest = sessions[0];
  const streak = streakOf(sessions, now);
  const dailyMinutes = dailyMinutesOf(prefs);
  const ring = layout.slots.includes("calm-ring") ? ringOf(sessions, now, dailyMinutes) : null;
  const open = ws.plans.filter(isOpen);
  const suggestion = prefs ? suggestedSession(prefs) : "Start a session";
  const line =
    layout.line &&
    calmLine({
      streakDays: streak.days,
      doneToday: streak.doneToday,
      minutes: Math.round((prefs?.session.durationSec ?? 180) / 60),
      streak: layout.streak,
    });

  return (
    <div className="container home" data-goal={layout.goal ?? undefined} data-density={layout.density}>
      <header className="home-head">
        <div>
          <h1>
            {greeting(now)}, {first}.
          </h1>
          <p className="home-date">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {prefs && (
              <>
                {" · "}Goal: <b>{goalOf(prefs.goal).label}</b>, {targets.sessionsPerWeek} sessions a week
              </>
            )}
          </p>
          {line && <p className="home-line">{line}</p>}
        </div>
        <div className="home-actions">
          <Link href="/cloud/device/" className="button" data-variant="ghost">
            <Icon name="band" size={18} />
            Band
          </Link>
          <Link href="/cloud/record/" className="button" data-size="large">
            <span className="rec-dot" aria-hidden="true" />
            {suggestion}
          </Link>
        </div>
      </header>

      {a.flags.length > 0 && (
        <ul className="flags home-flags" aria-label="Reminders">
          {a.flags.slice(0, 2).map((f) => (
            <li key={f.kind} data-kind={f.kind}>
              <Icon name="info" size={16} />
              {ownWords(f.text)}
            </li>
          ))}
        </ul>
      )}

      {mechanics.milestones && <NewMilestones sessions={sessions} now={now} />}

      {layout.professional && <ProfessionalCard ws={ws} pro={layout.professional} />}

      <div className="home-grid">
        <LastSession session={latest} sessions={sessions} href={ws.sessionHref(latest.id)} />

        <WeekCard ws={ws} layout={layout} activity={a} streak={streak} ring={ring} dailyMinutes={dailyMinutes} />

        {layout.trendDays !== null && <ScoreTrend ws={ws} days={layout.trendDays} rate={layout.rate} />}

        <section className="pane home-side" aria-label={layout.professional ? "Recent sessions" : "Coach and recent sessions"}>
          {/* With the professional's card leading the page, their practice and comments are there instead. */}
          {!layout.professional && (
            <div className="home-side-block">
              <div className="pane-h">
                <h2>From your coach</h2>
                <Link className="link small" href={ws.tabHref("plan")}>
                  Practice
                  <Icon name="chevronRight" size={16} />
                </Link>
              </div>
              {open.length === 0 ? (
                <p className="muted small-text">{ws.coachName ? "Nothing set right now." : "Share with a coach in Settings and their practice shows up here."}</p>
              ) : (
                <div className="home-plan">
                  <span className="plan-what">{describeAssignment(open[0].assignment)}</span>
                  <Progress done={open[0].done} target={open[0].assignment.target} status={open[0].status} />
                  <span className="plan-due label">{dueText(open[0].daysLeft)}</span>
                </div>
              )}
              <LatestComment ws={ws} />
            </div>
          )}
          <div className="home-side-block">
            <div className="pane-h">
              <h2>Recent</h2>
              <Link className="link small" href={ws.tabHref("sessions")}>
                All {sessions.length}
                <Icon name="chevronRight" size={16} />
              </Link>
            </div>
            <ul className="recent">
              {sessions.slice(0, 3).map((s) => {
                const h = headline(s);
                return (
                  <li key={s.id}>
                    <Link href={ws.sessionHref(s.id)}>
                      <span className="recent-what">
                        <b>{describeMode(s)}</b>
                        <span>
                          {formatDay(s.startedAt)} · {formatDuration(s.durationSec)}
                        </span>
                      </span>
                      <span className="recent-score">
                        <b className="display">{h.text}</b>
                        <span>
                          {h.kind === "transition" ? (
                            <>
                              <Dot band={h.band} />
                              {h.word}
                            </>
                          ) : h.kind === "rate" ? (
                            "br/min"
                          ) : (
                            "earlier scoring"
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

/** "Start Paced 5-5 · 10 min", from the athlete's saved defaults. */
export function suggestedSession(p: UserPreferences): string {
  const s = p.session;
  const what = s.mode === "paced" ? `Paced ${s.pacerHalfCycleSec}-${s.pacerHalfCycleSec}` : "Open";
  return `Start ${what}${s.durationSec ? ` · ${Math.round(s.durationSec / 60)} min` : ""}`;
}

/** The last session as an instrument card: score, a strip of the breath itself, and the breakdown. */
function LastSession({ session, sessions, href }: { session: SessionSummary; sessions: SessionSummary[]; href: string }) {
  const backend = useBackend();
  const wave = useLoad(`waveform:${session.athleteId}/${session.id}`, () => backend.data.getWaveform(session));
  const scores = isTransitionScores(session.scores) ? session.scores : null;
  const prev = sessions.slice(1).find((s) => isTransitionScores(s.scores));
  const delta = scores && prev && isTransitionScores(prev.scores) ? Math.round((scores.total - prev.scores.total) * 10) / 10 : null;
  const h = headline(session);

  return (
    <section className="home-last theme-dark" aria-labelledby="last-h">
      <div className="last-score">
        <h2 id="last-h">Last session</h2>
        <p className="last-n display">
          {h.text}
          <small>{scores ? "/10" : h.kind === "rate" ? "br/min" : ""}</small>
        </p>
        <p className="last-w">
          {scores ? (
            <>
              <Dot band={scoreWord(scores.total).band} />
              {scoreWord(scores.total).word}
              {delta !== null && <span className="muted"> · {delta >= 0 ? "+" : "−"}{formatScore(Math.abs(delta))} on the one before</span>}
            </>
          ) : (
            "Breathing rate"
          )}
        </p>
        {scores && (
          <dl className="last-subs">
            <div>
              <dt>Timing</dt>
              <dd>
                <Arrow dir="in" size={8} /> {formatScore(scores.timing.inhale)} <Arrow dir="out" size={8} /> {formatScore(scores.timing.exhale)}
              </dd>
            </div>
            <div>
              <dt>Depth</dt>
              <dd>
                <Arrow dir="in" size={8} /> {formatScore(scores.depth.inhale)} <Arrow dir="out" size={8} /> {formatScore(scores.depth.exhale)}
              </dd>
            </div>
            {session.paced && (
              <div>
                <dt>On target</dt>
                <dd>{Math.round((session.paced.onTargetPct.timing + session.paced.onTargetPct.depth) / 2)}%</dd>
              </div>
            )}
          </dl>
        )}
        <p className="last-meta">
          {describeMode(session)} · {formatDay(session.startedAt)}, {formatTime(session.startedAt)} · {formatDuration(session.durationSec)}
        </p>
        <Link href={href} className="button" data-variant="ghost" data-size="small">
          Open the review
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>
      <div className="last-wave">
        {wave.status === "ready" ? (
          <Measured height={128}>{(width) => <BreathStrip waveform={wave.data} width={width} height={128} />}</Measured>
        ) : (
          <div className="last-wave-wait" />
        )}
        <span className="last-wave-key">
          <span data-k="in">In</span>
          <span data-k="out">Out</span>
          {session.mode === "paced" && <span data-k="pacer">Pacer</span>}
          <span>First 60 seconds</span>
        </span>
      </div>
    </section>
  );
}

/** The first minute of a session's breath, red rising and blue falling, over the pacer. */
function BreathStrip({ waveform, width, height }: { waveform: Waveform; width: number; height: number }) {
  const paths = useMemo(() => {
    const hz = 1000 / waveform.sampleIntervalMs;
    const n = Math.min(waveform.user.length, Math.round(60 * hz));
    const user = waveform.user.slice(0, n);
    const pacer = waveform.pacer?.slice(0, n) ?? null;
    const all = pacer ? [...user, ...pacer] : user;
    const sorted = [...all].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.01)];
    const hi = sorted[Math.floor(sorted.length * 0.99)];
    const pad = (hi - lo) * 0.12 || 1;
    const X = (i: number) => (i / Math.max(1, n - 1)) * width;
    const Y = (v: number) => height - 6 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (height - 12);
    const step = Math.max(1, Math.floor(n / (width * 1.2)));
    let rising = "";
    let falling = "";
    for (let i = step; i < n; i += step) {
      const seg = `M${X(i - step).toFixed(1)} ${Y(user[i - step]).toFixed(1)}L${X(i).toFixed(1)} ${Y(user[i]).toFixed(1)}`;
      if (user[i] >= user[i - step]) rising += seg;
      else falling += seg;
    }
    let p = "";
    if (pacer) for (let i = 0; i < n; i += step) p += `${p ? "L" : "M"}${X(i).toFixed(1)} ${Y(pacer[i]).toFixed(1)}`;
    return { rising, falling, pacer: p };
  }, [waveform, width, height]);

  return (
    <svg width={width} height={height} className="breath-strip" aria-hidden="true">
      {paths.pacer && <path d={paths.pacer} className="bs-pacer" />}
      <path d={paths.falling} className="bs-out" />
      <path d={paths.rising} className="bs-in" />
    </svg>
  );
}

function ScoreTrend({ ws, days, rate }: { ws: Workspace; days: number; rate: boolean }) {
  const { sessions, now, targets } = ws;
  const t1 = now.getTime();
  const t0 = t1 - days * DAY;
  const points: TimePoint[] = sessions
    .filter((s): s is SessionSummary & { scores: { total: number } } => isTransitionScores(s.scores) && Date.parse(s.startedAt) >= t0)
    .map((s) => ({
      t: Date.parse(s.startedAt),
      v: s.scores.total,
      label: `${formatDay(s.startedAt)} · ${describeMode(s)}`,
      out: s.scores.total < targets.score,
      href: ws.sessionHref(s.id),
    }))
    .reverse();
  const rates: TrendPoint[] = sessions
    .filter((s) => s.mode === "open" && s.respirationRateBpm !== null && Date.parse(s.startedAt) >= t0)
    .slice(0, 12)
    .reverse()
    .map((s) => ({
      value: s.respirationRateBpm!,
      label: formatDay(s.startedAt, undefined, false),
      title: `${formatDay(s.startedAt)}: ${formatScore(s.respirationRateBpm!)} br/min`,
    }));

  return (
    <section className="pane pane-pad home-trend" aria-labelledby="trend-h">
      <div className="pane-h">
        <h2 id="trend-h">Total Breath Score, {trendPeriod(days)}</h2>
        <Link className="link small" href={ws.tabHref("trends")}>
          All trends
          <Icon name="chevronRight" size={16} />
        </Link>
      </div>
      {points.length > 1 ? (
        <Measured height={150}>
          {(width) => (
            <TimeTrend
              points={points}
              t0={t0}
              t1={t1}
              yMin={1}
              yMax={10}
              yTicks={[2, 4, 6, 8, 10]}
              line={{ v: targets.score, label: `Target ${formatScore(targets.score)}` }}
              width={width}
              height={150}
              format={formatScore}
              ariaLabel={`Total Breath Score for ${points.length} paced sessions over the ${trendPeriod(days)}`}
            />
          )}
        </Measured>
      ) : (
        <p className="muted chart-empty">Two or more scored sessions draw your trend here.</p>
      )}
      {rate && (
        <div className="home-rate">
          <div className="pane-h">
            <h3>Breathing rate, open sessions</h3>
            <span className="meta">
              br/min, shaded {targets.rateLow}–{targets.rateHigh}
            </span>
          </div>
          {rates.length > 0 ? (
            <Measured height={96}>{(width) => <RateBars points={rates} lo={targets.rateLow} hi={targets.rateHigh} width={width} height={96} />}</Measured>
          ) : (
            <p className="muted small-text">Record an open session to see your resting rate here.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** A new athlete with no sessions: three steps from band to first score, with the simulator as a way in. */
function FirstRun({ name, now }: { name: string; now: Date }) {
  const device = useDevice();
  const auth = useAuth();
  const prefs = auth.status === "signed-in" ? auth.profile?.preferences : null;
  // A minute for the strap check and calibration, then the session itself.
  const minutes = 1 + Math.round((prefs?.session.durationSec || 180) / 60);
  return (
    <div className="container page home">
      <header className="home-head">
        <div>
          <h1>Welcome, {name}.</h1>
          <p className="home-date">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            {prefs && (
              <>
                {" · "}Goal: <b>{goalOf(prefs.goal).label}</b>
              </>
            )}
          </p>
        </div>
      </header>
      <section className="home-first theme-dark" aria-labelledby="first-h">
        <h2 id="first-h" className="display">Your first session takes about {minutes} minutes.</h2>
        <ol className="first-steps">
          <li>
            <b>Put on your band</b>
            <span>Around your belly, just below the ribs, snug but comfortable.</span>
          </li>
          <li>
            <b>Connect it</b>
            <span>Over Bluetooth in Chrome or Edge, or try the simulated band first.</span>
          </li>
          <li>
            <b>Follow the pacer</b>
            <span>Calibrate with 20 seconds of full breaths, then breathe with the pacer. Your score is ready when you stop.</span>
          </li>
        </ol>
        <div className="first-actions">
          <Link href="/cloud/record/" className="button" data-size="large">
            <span className="rec-dot" aria-hidden="true" />
            {prefs ? suggestedSession(prefs) : "Record your first session"}
          </Link>
          <Link href="/cloud/device/" className="button" data-variant="ghost">
            {device.connected ? "Band connected" : "Set up your band"}
          </Link>
        </div>
      </section>
    </div>
  );
}
