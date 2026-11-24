"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Arrow, Dot } from "@/components/Score";
import { EmptyState } from "@/components/States";
import { useBackend } from "@/lib/backend/BackendProvider";
import { countsToward, threads } from "@/lib/domain/coaching";
import { sessionsCsv } from "@/lib/domain/csv";
import { describeMode, formatDuration, formatTime } from "@/lib/domain/format";
import { formatScore, headline, isTransitionScores, scoreWord } from "@/lib/domain/scores";
import type { SessionSummary } from "@/lib/domain/types";
import { downloadText, slug } from "@/lib/download";
import { useLoad } from "@/lib/useLoad";
import type { Workspace } from "./AthleteWorkspace";

type Mode = "all" | "paced" | "open";
type Range = 30 | 90 | 0;
const PAGE = 25;
const DAY = 86_400_000;

/** Monday 00:00 of the week a date falls in. */
export function weekStart(d: Date): Date {
  const w = new Date(d);
  w.setHours(0, 0, 0, 0);
  w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
  return w;
}

/** "This week", "Last week" or "Nov 9 – 15". */
export function weekLabel(start: Date, now: Date): string {
  const thisWeek = weekStart(now).getTime();
  if (start.getTime() === thisWeek) return "This week";
  if (start.getTime() === thisWeek - 7 * DAY) return "Last week";
  const end = new Date(start.getTime() + 6 * DAY);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return start.getMonth() === end.getMonth()
    ? `${month(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}

/** Newest first, grouped into Monday-to-Sunday weeks. */
export function byWeek(sessions: SessionSummary[]): { start: Date; sessions: SessionSummary[] }[] {
  const groups: { start: Date; sessions: SessionSummary[] }[] = [];
  for (const s of sessions) {
    const start = weekStart(new Date(s.startedAt));
    const last = groups[groups.length - 1];
    if (last && last.start.getTime() === start.getTime()) last.sessions.push(s);
    else groups.push({ start, sessions: [s] });
  }
  return groups;
}

/** Every session, week by week, with filters and a CSV of what's shown. */
export function SessionsTab({ ws }: { ws: Workspace }) {
  const backend = useBackend();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("all");
  const [range, setRange] = useState<Range>(0);
  const [limit, setLimit] = useState(PAGE);
  // Coaches see which sessions they haven't opened yet.
  const seen = useLoad(ws.self ? null : `seen:${ws.viewerId}`, () => backend.data.listSeenSessions(ws.viewerId));
  const seenKeys = seen.status === "ready" ? new Set(seen.data) : null;

  const cutoff = range ? ws.now.getTime() - range * DAY : -Infinity;
  const shown = ws.sessions.filter((s) => (mode === "all" || s.mode === mode) && Date.parse(s.startedAt) >= cutoff);
  const byThread = threads(ws.comments);
  const openPlans = ws.plans.filter((p) => p.status !== "cancelled");

  if (ws.sessions.length === 0) {
    return (
      <EmptyState title="No sessions yet">
        <p className="muted">{ws.self ? "Record your first session and it appears here." : "Sessions appear here once they're recorded."}</p>
        {ws.self && (
          <Link href="/cloud/record/" className="button" data-size="small">
            <span className="rec-dot" aria-hidden="true" />
            Start a session
          </Link>
        )}
      </EmptyState>
    );
  }

  const weeks = byWeek(shown.slice(0, limit));

  return (
    <section className="sl" aria-label="Sessions">
      <div className="sl-tools">
        <div className="seg" role="group" aria-label="Session type">
          {(["all", "paced", "open"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === "all" ? "All" : m === "paced" ? "Paced" : "Open"}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Time range">
          {([30, 90, 0] as const).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {r ? `${r} days` : "All time"}
            </button>
          ))}
        </div>
        <span className="sl-count">
          {shown.length} of {ws.sessions.length}
        </span>
        <button
          type="button"
          className="button"
          data-variant="ghost"
          data-size="small"
          disabled={shown.length === 0}
          onClick={() => downloadText(`breathband-${slug(ws.name)}-sessions.csv`, sessionsCsv(shown))}
        >
          <Icon name="download" size={16} />
          CSV of these
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="muted dash-empty">No sessions match these filters.</p>
      ) : (
        <div className="pane sl-pane">
          <table className="sl-table">
            <thead className="sr-only">
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Session</th>
                <th scope="col">Total Breath Score or breathing rate</th>
                <th scope="col">Timing, inhale and exhale</th>
                <th scope="col">Depth, inhale and exhale</th>
                <th scope="col">Notes, comments and practice</th>
              </tr>
            </thead>
            {weeks.map((week) => {
              const scored = week.sessions.filter((s) => isTransitionScores(s.scores));
              const avg = scored.length
                ? scored.reduce((sum, s) => sum + (isTransitionScores(s.scores) ? s.scores.total : 0), 0) / scored.length
                : null;
              return (
                <tbody key={week.start.toISOString()}>
                  <tr className="sl-week">
                    <th scope="rowgroup" colSpan={6}>
                      <span>{weekLabel(week.start, ws.now)}</span>
                      <small>
                        {week.sessions.length} {week.sessions.length === 1 ? "session" : "sessions"}
                        {avg !== null && ` · average ${formatScore(Math.round(avg * 10) / 10)}`}
                      </small>
                    </th>
                  </tr>
                  {week.sessions.map((s) => {
                    const t = isTransitionScores(s.scores) ? s.scores : null;
                    const h = headline(s);
                    const thread = byThread.get(s.id);
                    const isNew = seenKeys !== null && !seenKeys.has(`${s.athleteId}/${s.id}`);
                    const plan = openPlans.some((p) => countsToward(p.assignment, s));
                    const href = ws.sessionHref(s.id);
                    const d = new Date(s.startedAt);
                    return (
                      <tr key={s.id} className="sl-row" onClick={() => router.push(href)}>
                        <td className="sl-date">
                          <div className="sl-date-in">
                          <span className="sl-day display">{d.getDate()}</span>
                          <span>
                            <Link href={href} className="sl-link" onClick={(e) => e.stopPropagation()}>
                              {d.toLocaleDateString(undefined, { weekday: "short" })} · {d.toLocaleDateString(undefined, { month: "short" })}
                            </Link>
                            <small>{formatTime(s.startedAt)}</small>
                          </span>
                          {isNew && (
                            <i className="new-dot" title="You haven't opened this one">
                              <span className="sr-only">Not opened yet</span>
                            </i>
                          )}
                          </div>
                        </td>
                        <td>
                          <span className="sl-mode" data-mode={s.mode}>
                            {describeMode(s)}
                          </span>
                          <small className="sl-sub">
                            {formatDuration(s.durationSec)}
                            {s.source === "web" && " · recorded on the web"}
                          </small>
                        </td>
                        <td className="sl-score">
                          {h.kind === "transition" ? (
                            <>
                              <b className="display">{h.text}</b>
                              <small>
                                <Dot band={h.band} />
                                {h.word}
                              </small>
                            </>
                          ) : h.kind === "legacy" ? (
                            <>
                              <b className="display">{h.text}</b>
                              <small>earlier scoring</small>
                            </>
                          ) : (
                            <>
                              <b className="display">{h.value === null ? "–" : formatScore(h.value)}</b>
                              <small>br/min</small>
                            </>
                          )}
                        </td>
                        <td className="sl-pair">{t ? <Pair label="Timing" a={t.timing.inhale} b={t.timing.exhale} /> : null}</td>
                        <td className="sl-pair">{t ? <Pair label="Depth" a={t.depth.inhale} b={t.depth.exhale} /> : null}</td>
                        <td>
                          <span className="sl-tags">
                            {s.note && (
                              <span title={s.note}>
                                <Icon name="note" size={14} />
                                Note
                              </span>
                            )}
                            {thread && thread.comments.length > 0 && (
                              <span>
                                <Icon name="comment" size={14} />
                                {thread.comments.length}
                                <span className="sr-only"> comments</span>
                              </span>
                            )}
                            {thread && thread.kudos.length > 0 && (
                              <span data-k="kudos">
                                <Icon name="kudos" size={14} />
                                Kudos
                              </span>
                            )}
                            {s.groupSessionId && (
                              <span>
                                <Icon name="group" size={14} />
                                Group
                              </span>
                            )}
                            {plan && (
                              <span data-k="plan">
                                <Icon name="plan" size={14} />
                                Practice
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      {shown.length > limit && (
        <div className="row more">
          <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setLimit((n) => n + PAGE)}>
            Show {Math.min(PAGE, shown.length - limit)} more
          </button>
        </div>
      )}
    </section>
  );
}

/** Inhale and exhale sub-scores with their arrows; only a low one is marked, in amber. */
function Pair({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <span className="sl-pair-in">
      <small>{label}</small>
      <span>
        <Arrow dir="in" size={8} />
        <b data-low={scoreWord(a).band === "low" || undefined}>{formatScore(a)}</b>
        <Arrow dir="out" size={8} />
        <b data-low={scoreWord(b).band === "low" || undefined}>{formatScore(b)}</b>
      </span>
    </span>
  );
}
