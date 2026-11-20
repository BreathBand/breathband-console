"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { HeadlineScore, Score } from "@/components/Score";
import { EmptyState } from "@/components/States";
import { useBackend } from "@/lib/backend/BackendProvider";
import { countsToward, threads } from "@/lib/domain/coaching";
import { sessionsCsv } from "@/lib/domain/csv";
import { describeMode, formatDay, formatDuration, formatTime } from "@/lib/domain/format";
import { headline, isTransitionScores } from "@/lib/domain/scores";
import { downloadText, slug } from "@/lib/download";
import { useLoad } from "@/lib/useLoad";
import type { Workspace } from "./AthleteWorkspace";

type Mode = "all" | "paced" | "open";
type Range = 30 | 90 | 0;
const PAGE = 25;

/** Every session in a sortable-at-a-glance table, with filters and a CSV of what's shown. */
export function SessionsTab({ ws }: { ws: Workspace }) {
  const backend = useBackend();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("all");
  const [range, setRange] = useState<Range>(0);
  const [limit, setLimit] = useState(PAGE);
  // Coaches see which sessions they haven't opened yet.
  const seen = useLoad(ws.self ? null : `seen:${ws.viewerId}`, () => backend.data.listSeenSessions(ws.viewerId));
  const seenKeys = seen.status === "ready" ? new Set(seen.data) : null;

  const cutoff = range ? ws.now.getTime() - range * 86_400_000 : -Infinity;
  const shown = ws.sessions.filter((s) => (mode === "all" || s.mode === mode) && Date.parse(s.startedAt) >= cutoff);
  const byThread = threads(ws.comments);
  const openPlans = ws.plans.filter((p) => p.status !== "cancelled");

  if (ws.sessions.length === 0) {
    return (
      <EmptyState title="No sessions yet">
        <p className="muted">Sessions appear here once the app uploads them.</p>
      </EmptyState>
    );
  }

  return (
    <section className="pane pane-pad" aria-label="Sessions">
      <div className="toolbar">
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
        <span className="label toolbar-end">
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
        <div className="table-scroll">
          <table className="table sessions">
            <thead>
              <tr>
                <th>Date</th>
                <th>Session</th>
                <th className="num">Score</th>
                <th className="num">Timing in · out</th>
                <th className="num">Depth in · out</th>
                <th className="num">Rate</th>
                <th>
                  <span className="sr-only">Notes, comments and practice</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((s) => {
                const t = isTransitionScores(s.scores) ? s.scores : null;
                const thread = byThread.get(s.id);
                const isNew = seenKeys !== null && !seenKeys.has(`${s.athleteId}/${s.id}`);
                const plan = openPlans.some((p) => countsToward(p.assignment, s));
                const href = ws.sessionHref(s.id);
                return (
                  <tr key={s.id} className="clickable" onClick={() => router.push(href)}>
                    <td>
                      <Link href={href} className="row-link" onClick={(e) => e.stopPropagation()}>
                        {formatDay(s.startedAt)}
                      </Link>
                      {isNew && <i className="new-dot" aria-label="Not opened yet" title="You haven't opened this one" />}
                      <span className="sub-line">{formatTime(s.startedAt)}</span>
                    </td>
                    <td className="sub">
                      {describeMode(s)} · {formatDuration(s.durationSec)}
                    </td>
                    <td className="num">
                      {s.scores ? <HeadlineScore headline={headline(s)} /> : <span className="muted">–</span>}
                    </td>
                    <td className="num">{t ? <Pair a={t.timing.inhale} b={t.timing.exhale} /> : <span className="muted">–</span>}</td>
                    <td className="num">{t ? <Pair a={t.depth.inhale} b={t.depth.exhale} /> : <span className="muted">–</span>}</td>
                    <td className="num sub">{s.respirationRateBpm === null ? "–" : `${s.respirationRateBpm} br/min`}</td>
                    <td>
                      <span className="marks">
                        {s.note && (
                          <span title={`Note: ${s.note}`}>
                            <Icon name="note" size={16} />
                            <span className="sr-only">Has a note</span>
                          </span>
                        )}
                        {thread && thread.comments.length > 0 && (
                          <span title={`${thread.comments.length} comments`}>
                            <Icon name="comment" size={16} />
                            {thread.comments.length}
                          </span>
                        )}
                        {thread && thread.kudos.length > 0 && (
                          <span title="Kudos" className="kudos-mark">
                            <Icon name="kudos" size={16} />
                            <span className="sr-only">Kudos</span>
                          </span>
                        )}
                        {s.groupSessionId && (
                          <span title="Recorded in a group session">
                            <Icon name="group" size={16} />
                            <span className="sr-only">Group session</span>
                          </span>
                        )}
                        {plan && (
                          <span title="Counts toward practice" className="plan-mark">
                            <Icon name="plan" size={16} />
                            <span className="sr-only">Counts toward practice</span>
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
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

/** Inhale and exhale sub-scores side by side, compact. */
function Pair({ a, b }: { a: number; b: number }) {
  return (
    <span className="pair">
      <Score value={a} compact />
      <Score value={b} compact />
    </span>
  );
}
