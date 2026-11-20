"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Dot } from "@/components/Score";
import { ErrorState, Skeleton } from "@/components/States";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { describeMode, formatDay, formatDuration, formatTime } from "@/lib/domain/format";
import { headline } from "@/lib/domain/scores";
import type { SessionSummary } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { athleteHref } from "./links";

export interface ConsoleContext {
  athleteId: string;
  /** The athlete's display name ("Athlete" until the profile loads). */
  name: string;
  /** True when athletes look at their own data; false for a coach. */
  self: boolean;
  /** Newest first. */
  sessions: SessionSummary[];
  overviewHref: string;
  sessionHref: (id: string) => string;
}

type Filter = "all" | "paced" | "open";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paced", label: "Paced" },
  { value: "open", label: "Open" },
];

/**
 * One athlete's data, laid out like the Coach Console: the session list in a
 * rail on the left, and the overview or a session review beside it. Used by
 * athletes (their own data) and coaches (read-only).
 */
export function AthleteConsole({
  athleteId,
  sessionId,
  children,
}: {
  athleteId: string;
  sessionId?: string;
  children: (ctx: ConsoleContext) => ReactNode;
}) {
  const backend = useBackend();
  const auth = useAuth();
  const params = useSearchParams();
  const filter = (["paced", "open"] as const).find((f) => f === params.get("type")) ?? "all";

  const self = auth.status === "signed-in" && auth.user.uid === athleteId;
  const sessions = useLoad(`sessions:${athleteId}`, () => backend.data.listSessions(athleteId, { limit: 200 }));
  const profile = useLoad(self ? null : `profile:${athleteId}`, () => backend.data.getProfile(athleteId));
  const name =
    (self
      ? auth.status === "signed-in" && auth.profile?.displayName
      : profile.status === "ready" && profile.data?.displayName) || "Athlete";

  const keep = filter === "all" ? "" : `&type=${filter}`;
  const base = `?athlete=${encodeURIComponent(athleteId)}${keep}`;
  const overviewHref = self ? "/cloud/" : athleteHref(athleteId);
  const sessionHref = (id: string) => `/cloud/session/${base}&id=${encodeURIComponent(id)}`;

  const railRef = useRef<HTMLUListElement>(null);
  const loaded = sessions.status === "ready";
  useEffect(() => {
    // Bring the open session into view inside the rail without scrolling the page.
    const list = railRef.current;
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !current) return;
    const top = current.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + current.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - list.clientHeight / 3;
    }
  }, [sessionId, loaded]);

  if (sessions.status === "error") {
    return (
      <div className="container">
        <ErrorState error={sessions.error} what="sessions" onRetry={sessions.retry} />
      </div>
    );
  }

  const all = sessions.status === "ready" ? sessions.data : [];
  const shown = filter === "all" ? all : all.filter((s) => s.mode === filter);
  const ctx: ConsoleContext = { athleteId, name, self, sessions: all, overviewHref, sessionHref };

  return (
    <div className="console" data-view={sessionId ? "session" : "overview"}>
      <aside className="rail" aria-label="Sessions">
        <div className="rail-h">
          <h2>
            Sessions
            {all.length > 0 && (
              <span>
                {all.length} since {formatDay(all[all.length - 1].startedAt, undefined, false)}
              </span>
            )}
          </h2>
          <nav className="seg" aria-label="Show sessions">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={`${sessionId ? "/cloud/session/" : "/cloud/sessions/"}?athlete=${encodeURIComponent(athleteId)}${f.value === "all" ? "" : `&type=${f.value}`}${sessionId ? `&id=${encodeURIComponent(sessionId)}` : ""}`}
                aria-current={f.value === filter ? "true" : undefined}
                replace
                scroll={false}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        <ul className="rail-list" ref={railRef}>
          <li>
            <Link href={overviewHref} className="rail-overview" aria-current={sessionId ? undefined : "page"}>
              <Icon name="chevronLeft" size={18} />
              {self ? "Overview" : name}
            </Link>
          </li>
          {sessions.status === "loading" ? (
            <li>
              <Skeleton lines={6} label="Loading sessions…" />
            </li>
          ) : shown.length === 0 ? (
            <li className="rail-empty muted">{all.length === 0 ? "No sessions yet." : `No ${filter} sessions.`}</li>
          ) : (
            shown.map((s) => <RailItem key={s.id} session={s} href={sessionHref(s.id)} current={s.id === sessionId} />)
          )}
        </ul>
      </aside>
      <div className="console-body">
        {sessions.status === "loading" ? <Skeleton lines={8} label="Loading sessions…" /> : children(ctx)}
      </div>
    </div>
  );
}

function RailItem({ session, href, current }: { session: SessionSummary; href: string; current: boolean }) {
  const h = headline(session);
  return (
    <li>
      <Link href={href} aria-current={current ? "page" : undefined} scroll={false}>
        <span className="d">{formatDay(session.startedAt)}</span>
        <span className="t">
          {describeMode(session)} · {formatDuration(session.durationSec)} · {formatTime(session.startedAt)}
        </span>
        <span className="r">
          {h.text}
          <small>
            {h.kind === "transition" ? (
              <>
                <Dot band={h.band} />
                {h.word}
              </>
            ) : h.kind === "legacy" ? (
              <>
                <Dot band={h.band} />
                legacy
              </>
            ) : (
              "br/min"
            )}
          </small>
        </span>
      </Link>
    </li>
  );
}
