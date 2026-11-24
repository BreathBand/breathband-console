"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { Measured } from "@/components/Measured";
import { Progress } from "@/components/Progress";
import { Arrow, Dot } from "@/components/Score";
import { TimeTrend, type TimePoint } from "@/components/trendCharts";
import { useBackend } from "@/lib/backend/BackendProvider";
import { useDevice } from "@/lib/device/DeviceProvider";
import { activity, daysAgoText } from "@/lib/domain/activity";
import { describeAssignment, dueText, isOpen, timeAgo } from "@/lib/domain/coaching";
import { describeMode, formatDay, formatDuration, formatTime } from "@/lib/domain/format";
import { formatScore, headline, isTransitionScores, scoreWord } from "@/lib/domain/scores";
import type { SessionSummary, Waveform } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import type { Workspace } from "./AthleteWorkspace";

const DAY = 86_400_000;
const TREND_DAYS = 56;

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Consecutive days, up to today or yesterday, with at least one session. */
export function streakDays(sessions: SessionSummary[], now: Date): number {
  const days = new Set(sessions.map((s) => new Date(s.startedAt).toDateString()));
  const d = new Date(now);
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/**
 * The athlete's home: a greeting and the one primary action, the last session
 * as a dark instrument card (its score, its breath, its breakdown), the week at
 * a glance, the score trend, and what their coach has set and said.
 */
export function AthleteHome({ ws }: { ws: Workspace }) {
  const { sessions, now, targets } = ws;
  const first = ws.name.split(" ")[0];

  if (sessions.length === 0) return <FirstRun name={first} now={now} />;

  const a = activity(sessions, now, ws.rules, targets);
  const latest = sessions[0];
  const recent5 = a.scored.slice(0, 5);
  const average = recent5.length ? recent5.reduce((s, x) => s + x.scores.total, 0) / recent5.length : null;
  const streak = streakDays(sessions, now);
  const lastOpen = sessions.find((s) => s.mode === "open" && s.respirationRateBpm !== null);
  const open = ws.plans.filter(isOpen);

  return (
    <div className="container page home">
      <header className="home-head">
        <div>
          <p className="home-date">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>
            {greeting(now)}, {first}.
          </h1>
        </div>
        <Link href="/cloud/record/" className="button" data-size="large">
          <span className="rec-dot" aria-hidden="true" />
          Start a session
        </Link>
      </header>

      {a.flags.length > 0 && (
        <ul className="flags" aria-label="Reminders">
          {a.flags.map((f) => (
            <li key={f.kind} data-kind={f.kind}>
              <Icon name="info" size={18} />
              {f.text}
            </li>
          ))}
        </ul>
      )}

      <LastSession session={latest} sessions={sessions} href={ws.sessionHref(latest.id)} />

      <section className="home-stats" aria-label="This week">
        <div className="pane stat">
          <span className="lbl">This week</span>
          <span className="n display">
            {a.lastWeek}
            <small> of {targets.sessionsPerWeek}</small>
          </span>
          <Progress done={Math.min(a.lastWeek, targets.sessionsPerWeek)} target={targets.sessionsPerWeek} status={a.lastWeek >= targets.sessionsPerWeek ? "done" : "active"} />
        </div>
        <div className="pane stat">
          <span className="lbl">Streak</span>
          <span className="n display">
            {streak}
            <small> {streak === 1 ? "day" : "days"}</small>
          </span>
          <span className="d">{streak > 0 ? "In a row, up to today" : `Last session ${daysAgoText(a.daysSince ?? 0).toLowerCase()}`}</span>
        </div>
        <div className="pane stat">
          <span className="lbl">Average, last {recent5.length || 5} paced</span>
          <span className="n display">{average === null ? "–" : formatScore(Math.round(average * 10) / 10)}</span>
          <span className="d">Your target is {formatScore(targets.score)}</span>
        </div>
        <div className="pane stat">
          <span className="lbl">Breathing at rest</span>
          <span className="n display">
            {lastOpen ? formatScore(lastOpen.respirationRateBpm!) : "–"}
            <small> br/min</small>
          </span>
          <span className="d">{lastOpen ? `Open session, ${formatDay(lastOpen.startedAt, undefined, false)}` : "Record an open session to see it"}</span>
        </div>
      </section>

      <ScoreTrend ws={ws} />

      <div className="home-low">
        <section className="pane pane-pad" aria-labelledby="recent-h">
          <div className="pane-h">
            <h2 id="recent-h">Recent sessions</h2>
            <Link className="link small" href={ws.tabHref("sessions")}>
              All {sessions.length}
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>
          <ul className="recent">
            {sessions.slice(0, 6).map((s) => {
              const h = headline(s);
              return (
                <li key={s.id}>
                  <Link href={ws.sessionHref(s.id)}>
                    <span className="recent-what">
                      <b>{describeMode(s)}</b>
                      <span>
                        {formatDay(s.startedAt)} · {formatTime(s.startedAt)} · {formatDuration(s.durationSec)}
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
        </section>
        <div className="stack">
          <section className="pane pane-pad" aria-labelledby="practice-h">
            <div className="pane-h">
              <h2 id="practice-h">From your coach</h2>
              <Link className="link small" href={ws.tabHref("plan")}>
                See all
                <Icon name="chevronRight" size={16} />
              </Link>
            </div>
            {open.length === 0 ? (
              <p className="muted small-text">{ws.coachName ? "Nothing set right now." : "Share with a coach under Sharing and their practice shows up here."}</p>
            ) : (
              <ul className="plans compact">
                {open.map((p) => (
                  <li key={p.assignment.id}>
                    <span className="plan-what">{describeAssignment(p.assignment)}</span>
                    <Progress done={p.done} target={p.assignment.target} status={p.status} />
                    <span className="plan-due label">{dueText(p.daysLeft)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Conversation ws={ws} />
        </div>
      </div>
    </div>
  );
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
          <Measured height={150}>{(width) => <BreathStrip waveform={wave.data} width={width} height={150} />}</Measured>
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
      {scores && (
        <table className="last-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Measure</span>
              </th>
              <th scope="col">
                <Arrow dir="in" /> In
              </th>
              <th scope="col">
                <Arrow dir="out" /> Out
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Timing</th>
              <td>{formatScore(scores.timing.inhale)}</td>
              <td>{formatScore(scores.timing.exhale)}</td>
            </tr>
            <tr>
              <th scope="row">Depth</th>
              <td>{formatScore(scores.depth.inhale)}</td>
              <td>{formatScore(scores.depth.exhale)}</td>
            </tr>
            {session.paced && (
              <tr>
                <th scope="row">On target</th>
                <td colSpan={2}>
                  {Math.round((session.paced.onTargetPct.timing + session.paced.onTargetPct.depth) / 2)}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
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

function ScoreTrend({ ws }: { ws: Workspace }) {
  const { sessions, now, targets } = ws;
  const t1 = now.getTime();
  const t0 = t1 - TREND_DAYS * DAY;
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

  return (
    <section className="pane pane-pad home-trend" aria-labelledby="trend-h">
      <div className="pane-h">
        <h2 id="trend-h">Total Breath Score, last 8 weeks</h2>
        <Link className="link small" href={ws.tabHref("trends")}>
          All trends
          <Icon name="chevronRight" size={16} />
        </Link>
      </div>
      {points.length > 1 ? (
        <Measured height={200}>
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
              height={200}
              format={formatScore}
              ariaLabel={`Total Breath Score for ${points.length} paced sessions over the last 8 weeks`}
            />
          )}
        </Measured>
      ) : (
        <p className="muted chart-empty">Two or more scored sessions draw your trend here.</p>
      )}
    </section>
  );
}

function Conversation({ ws }: { ws: Workspace }) {
  const latest = ws.comments
    .filter((c) => c.kind === "comment")
    .slice(-3)
    .reverse();
  return (
    <section className="pane pane-pad" aria-labelledby="conversation-h">
      <div className="pane-h">
        <h2 id="conversation-h">Latest comments</h2>
      </div>
      {latest.length === 0 ? (
        <p className="muted small-text">Comments from your coach show up here.</p>
      ) : (
        <ul className="quotes">
          {latest.map((c) => {
            const s = ws.sessions.find((x) => x.id === c.sessionId);
            return (
              <li key={c.id}>
                <q>{c.text}</q>
                <span className="label">
                  {c.authorId === ws.viewerId ? "You" : c.authorName} · {timeAgo(c.createdAt, ws.now)}
                  {s && (
                    <>
                      {" · "}
                      <Link href={`${ws.sessionHref(s.id)}#comments`}>
                        {describeMode(s)}, {formatDay(s.startedAt, undefined, false)}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** A new athlete with no sessions: three steps from band to first score, with the simulator as a way in. */
function FirstRun({ name, now }: { name: string; now: Date }) {
  const device = useDevice();
  return (
    <div className="container page home">
      <header className="home-head">
        <div>
          <p className="home-date">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>Welcome, {name}.</h1>
        </div>
      </header>
      <section className="home-first theme-dark" aria-labelledby="first-h">
        <h2 id="first-h" className="display">Your first session takes about five minutes.</h2>
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
            <span>Calibrate with five deep breaths, then breathe with the pacer. Your score is ready when you stop.</span>
          </li>
        </ol>
        <div className="first-actions">
          <Link href="/cloud/record/" className="button" data-size="large">
            <span className="rec-dot" aria-hidden="true" />
            Record your first session
          </Link>
          <Link href="/cloud/device/" className="button" data-variant="ghost">
            {device.connected ? "Band connected" : "Set up your band"}
          </Link>
        </div>
      </section>
    </div>
  );
}
