"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useBackend } from "@/lib/backend/BackendProvider";
import { firstSession, firstSessionHref } from "@/lib/domain/first-session";
import { gettingStarted, showChecklist, type ChecklistItem, type ChecklistItemId, type GettingStartedFacts } from "@/lib/domain/getting-started";
import type { ProKind } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { inviteState } from "../InviteAthlete";
import { athleteHref } from "../links";
import type { Team } from "../useTeam";
import { useTerms } from "../useTerms";
import "./dashboard.css";

/** Items that need someone to have joined first. */
const NEEDS_PEOPLE: ChecklistItemId[] = ["squad", "first-practice", "class-session", "weekly-target"];

const ACTION: Record<ChecklistItemId, string> = {
  invite: "Invite",
  "try-session": "Record",
  squad: "Set a squad",
  "first-practice": "Set practice",
  "class-session": "Start one",
  "weekly-target": "Set targets",
};

/**
 * The "getting started" checklist for the professional's kind (planning/v1/02
 * §4.1 step 11). Each item's done-state comes from their own data, so it ticks
 * itself; the list goes away once everything is done.
 */
export function GettingStarted({ coachId, kind, team }: { coachId: string; kind: ProKind; team: Team }) {
  const backend = useBackend();
  const t = useTerms();
  const [now] = useState(() => new Date());
  const own = useLoad(`getting-started:${coachId}`, async () => {
    const [invites, sessions, groups] = await Promise.all([
      backend.data.listCoachInvites(coachId),
      backend.data.listSessions(coachId, { limit: 1 }),
      kind === "educator" ? backend.data.listGroupSessions(coachId) : Promise.resolve([]),
    ]);
    return {
      pendingInvites: invites.filter((i) => inviteState(i, now) === "pending").length,
      ownSessions: sessions.length,
      classSessions: groups.filter((g) => g.hostId === coachId).length,
    };
  });
  // The checklist is a guide, not the page: until its own counts arrive (or if they can't), it stays out of the way.
  if (own.status !== "ready") return null;

  const members = team.members;
  const facts: GettingStartedFacts = {
    ...own.data,
    people: members.length,
    squads: team.squads.length,
    practiceSet: members.reduce((n, m) => n + m.plans.length, 0),
    targetsSet: members.filter((m) => m.link?.targets).length,
  };
  const items = gettingStarted(kind, facts, t);
  if (!showChecklist(kind, items)) return null;
  const first = members[0]?.profile.uid;
  const href = (id: ChecklistItemId): string | null => {
    if (NEEDS_PEOPLE.includes(id) && !first) return null;
    switch (id) {
      case "invite":
        return "/cloud/athletes/#invite-athlete";
      case "try-session":
        return firstSessionHref(firstSession(null));
      case "squad":
        return "/cloud/athletes/#squads";
      case "first-practice":
        return athleteHref(first!, "plan", true);
      case "class-session":
        return "/cloud/group/";
      case "weekly-target":
        return athleteHref(first!, "trends");
    }
  };
  const doneCount = items.filter((i) => i.done).length;

  return (
    <section className="pane pane-pad gs" aria-labelledby="gs-h">
      <div className="pane-h">
        <h2 id="gs-h">Getting started</h2>
        <span className="meta">
          {doneCount} of {items.length} done
        </span>
      </div>
      <ol className="gs-list">
        {items.map((item, i) => (
          <Item key={item.id} item={item} n={i + 1} href={href(item.id)} waiting={`After your first ${t.one} joins`} />
        ))}
      </ol>
    </section>
  );
}

function Item({ item, n, href, waiting }: { item: ChecklistItem; n: number; href: string | null; waiting: string }) {
  return (
    <li data-done={item.done || undefined}>
      <span className="gs-mark" aria-hidden="true">
        {item.done ? <Icon name="check" size={14} /> : n}
      </span>
      <span className="gs-body">
        <b>
          {item.done && <span className="sr-only">Done: </span>}
          {item.label}
        </b>
        <small>{item.detail}</small>
      </span>
      {item.done ? (
        <span className="label gs-state">Done</span>
      ) : href ? (
        <Link className="button" data-variant="ghost" data-size="small" href={href}>
          {ACTION[item.id]}
        </Link>
      ) : (
        <span className="label gs-state">{waiting}</span>
      )}
    </li>
  );
}
