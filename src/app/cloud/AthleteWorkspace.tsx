"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { activity } from "@/lib/domain/activity";
import { assignmentProgress, isOpen, type AssignmentProgress } from "@/lib/domain/coaching";
import { sessionsCsv } from "@/lib/domain/csv";
import { formatLongDay, initials } from "@/lib/domain/format";
import { targetsFor } from "@/lib/domain/targets";
import { DEFAULT_ALERTS, type AlertRules, type AthleteTargets, type CoachLink, type ProKind, type SessionComment } from "@/lib/domain/types";
import { downloadText, slug } from "@/lib/download";
import { useLoad } from "@/lib/useLoad";
import type { ConsoleContext } from "./AthleteConsole";
import { AthleteHome } from "./AthleteHome";
import { AthleteOverview } from "./AthleteOverview";
import { athleteHref, sessionHref, type AthleteTab } from "./links";
import { NotesTab } from "./NotesTab";
import { PlanTab } from "./PlanTab";
import { SessionsTab } from "./SessionsTab";
import { reportHref, TrendsTab } from "./TrendsTab";
import { termsOf } from "./useTerms";

/** Everything one athlete's workspace shows, loaded once and shared by the tabs. */
export interface Workspace extends ConsoleContext {
  /** The signed-in user. */
  viewerId: string;
  /** The coach's link to this athlete; null when athletes look at their own data. */
  link: CoachLink | null;
  /** Newest first, including finished ones. */
  plans: AssignmentProgress[];
  /** Oldest first. */
  comments: SessionComment[];
  /** The coach's alert rules; defaults for athletes. */
  rules: AlertRules;
  targets: AthleteTargets;
  coachName?: string;
  /** What kind of professional `coachName` is; unset for older accounts (read as a coach). */
  coachKind?: ProKind;
  now: Date;
  tabHref: (tab: AthleteTab, assign?: boolean) => string;
  reload: () => void;
}

/**
 * One athlete's data under a header and tabs: Overview, Sessions, Plan and
 * (for coaches) private Notes. Athletes get the same workspace for their own
 * data, read-write where it's theirs to change.
 */
export function AthleteWorkspace({ athleteId, tab, assign }: { athleteId: string; tab: AthleteTab; assign: boolean }) {
  const backend = useBackend();
  const auth = useAuth();
  const [now] = useState(() => new Date());
  const viewerId = auth.status === "signed-in" ? auth.user.uid : "";
  const self = viewerId === athleteId;

  const data = useLoad(`workspace:${athleteId}`, async () => {
    const firstCoach = async () => {
      const [coach] = await backend.data.listCoaches(athleteId);
      return coach
        ? { name: coach.displayName, kind: coach.proKind ?? coach.proProfile?.kind, link: await backend.data.getCoachLink(coach.uid, athleteId) }
        : null;
    };
    const [sessions, profile, assignments, comments, link, rules, coach] = await Promise.all([
      backend.data.listSessions(athleteId, { limit: 200 }),
      self ? null : backend.data.getProfile(athleteId),
      backend.data.listAssignments(athleteId),
      backend.data.listComments(athleteId),
      self ? null : backend.data.getCoachLink(viewerId, athleteId),
      self ? DEFAULT_ALERTS : backend.data.getAlertRules(viewerId),
      self ? firstCoach() : null,
    ]);
    return { sessions, profile, assignments, comments, link, rules, coach };
  });

  if (data.status === "loading") {
    return (
      <div className="container review">
        <Skeleton lines={8} label="Loading sessions…" />
      </div>
    );
  }
  if (data.status === "error") {
    return (
      <div className="container review">
        <ErrorState error={data.error} what="sessions" onRetry={data.retry} />
      </div>
    );
  }

  const { sessions, profile, assignments, comments, link, rules, coach } = data.data;
  const terms = termsOf(auth);
  const ownPreferences = auth.status === "signed-in" ? auth.profile?.preferences : null;
  const name = (self ? auth.status === "signed-in" && auth.profile?.displayName : profile?.displayName) || (self ? "Athlete" : terms.One);
  const tabHref = (t: AthleteTab, open = false) =>
    self ? (t === "overview" && !open ? "/cloud/" : `/cloud/sessions/?tab=${t}${open ? "&assign=1" : ""}`) : athleteHref(athleteId, t, open);

  const ws: Workspace = {
    athleteId,
    name,
    self,
    sessions,
    overviewHref: tabHref("overview"),
    sessionHref: (id) => sessionHref(athleteId, id),
    viewerId,
    link,
    plans: assignments.map((a) => assignmentProgress(a, sessions, now)),
    comments,
    rules,
    targets: targetsFor(self ? coach?.link : link, self ? ownPreferences : profile?.preferences),
    coachName: coach?.name,
    coachKind: coach?.kind,
    now,
    tabHref,
    reload: data.retry,
  };

  // An athlete's own overview is their home page, with its own layout and no tabs.
  if (self && tab === "overview") return <AthleteHome ws={ws} />;

  const tabs: { id: AthleteTab; label: string; count?: number }[] = self
    ? [
        { id: "sessions", label: "Sessions", count: sessions.length },
        { id: "trends", label: "Trends" },
        { id: "plan", label: "From your coach", count: ws.plans.filter(isOpen).length || undefined },
      ]
    : [
        { id: "overview", label: "Overview" },
        { id: "trends", label: "Trends" },
        { id: "sessions", label: "Sessions", count: sessions.length },
        { id: "plan", label: "Plan", count: ws.plans.filter(isOpen).length || undefined },
        { id: "notes", label: "Notes" },
      ];
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <div className="container page workspace">
      {!self && (
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/cloud/athletes/" className="link">
            <Icon name="chevronLeft" size={18} />
            {terms.Many}
          </Link>
        </nav>
      )}
      <Header ws={ws} />
      <nav className="tabs" aria-label={`${self ? "Your" : `${name}'s`} data`}>
        {tabs.map((t) => (
          <Link key={t.id} href={tabHref(t.id)} aria-current={t.id === current ? "page" : undefined} scroll={false}>
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </Link>
        ))}
      </nav>
      <TabBody>
        {current === "overview" && <AthleteOverview ws={ws} />}
        {current === "trends" && <TrendsTab ws={ws} />}
        {current === "sessions" && <SessionsTab ws={ws} />}
        {current === "plan" && <PlanTab ws={ws} startOpen={assign} />}
        {current === "notes" && <NotesTab ws={ws} />}
      </TabBody>
    </div>
  );
}

function TabBody({ children }: { children: ReactNode }) {
  return <div className="tab-body">{children}</div>;
}

function Header({ ws }: { ws: Workspace }) {
  const { sessions, self, name, link } = ws;
  const a = activity(sessions, ws.now, ws.rules, ws.targets);
  const oldest = sessions[sessions.length - 1];

  const meta: ReactNode[] = [];
  if (link) {
    meta.push(
      <span key="scope" className="scope" data-scope={link.scope}>
        <Icon name={link.scope === "curves" ? "share" : "lock"} size={14} />
        {link.scope === "curves" ? "Shares scores and curves" : "Shares scores only"}
      </span>,
      `since ${formatLongDay(link.createdAt)}`,
    );
  }
  meta.push(oldest ? `${sessions.length} sessions since ${formatLongDay(oldest.startedAt)}` : "No sessions yet");

  return (
    <header className="ws-head" data-self={self || undefined}>
      {!self && (
        <span className="avatar lg" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      <div className="ws-title">
        <h1>{self ? "Sessions" : name}</h1>
        <p className="ws-meta">
          {meta.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </p>
        {!self && a.flags.length > 0 && (
          <span className="flag-list">
            {a.flags.map((f) => (
              <span key={f.kind} className="flag">
                {f.text}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="ws-actions">
        {!self && (
          <Link className="button" data-size="small" href={ws.tabHref("plan", true)}>
            <Icon name="plan" size={16} />
            Assign practice
          </Link>
        )}
        <Link className="button" data-variant="ghost" data-size="small" href={reportHref(ws, 30)}>
          <Icon name="print" size={16} />
          Report
        </Link>
        <button
          type="button"
          className="button"
          data-variant="ghost"
          data-size="small"
          disabled={sessions.length === 0}
          onClick={() => downloadText(`breathband-${slug(name)}-sessions.csv`, sessionsCsv(sessions))}
        >
          <Icon name="download" size={16} />
          Export CSV
        </button>
      </div>
    </header>
  );
}
