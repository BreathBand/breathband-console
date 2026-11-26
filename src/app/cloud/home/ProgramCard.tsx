"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { describeMode } from "@/lib/domain/format";
import { PROGRAMS, programDayHref, programProgress, progressLine, promotedProgram } from "@/lib/domain/programs";
import type { ProgramEnrolment, ProgramId, SessionSummary } from "@/lib/domain/types";
import { useLoad } from "@/lib/useLoad";
import { changeGamification } from "./gamification";

const DAY = 86_400_000;
/** A finished program stays on Home for a week, then makes way. */
const FINISHED_SHOWN_DAYS = 7;

/**
 * The program on Home (J5): the one the person follows, with today's day one
 * tap from the instrument and how far they are; or, before they enrol, the
 * one their goal promotes (Calm's Foundations), offered quietly to the other
 * goals. A clinician's client follows the clinician's plan only (02 §5.1).
 */
export function ProgramCard({ sessions, now, clinicianClient }: { sessions: SessionSummary[]; now: Date; clinicianClient: boolean }) {
  const auth = useAuth();
  const backend = useBackend();
  const uid = auth.status === "signed-in" ? auth.user.uid : null;
  // Read afresh: an enrolment made earlier in this visit isn't in the profile from sign-in.
  const stored = useLoad(uid ? `program:${uid}` : null, () => backend.data.getProfile(uid!));
  const [started, setStarted] = useState<ProgramEnrolment | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");

  const prefs = stored.status === "ready" ? stored.data?.preferences : undefined;
  if (!uid || !prefs) return null;
  const enrolment = started ?? prefs.gamification?.program;

  if (!enrolment) {
    if (clinicianClient) return null;
    const promoted = promotedProgram(prefs.goal);
    const program = PROGRAMS[promoted ?? "foundations"];
    const enrol = async (id: ProgramId) => {
      const next: ProgramEnrolment = { id, startedAt: new Date().toISOString() };
      setSaving("saving");
      try {
        await changeGamification(backend, uid, (g) => ({ ...g, program: next }));
        setStarted(next);
        setSaving("idle");
      } catch {
        setSaving("error");
      }
    };
    return (
      <section className="pane home-program" data-state="offer" data-promoted={promoted !== null || undefined} aria-labelledby="program-h">
        <div className="home-program-what">
          <span className="label">Program · {program.days.length} days</span>
          <h2 id="program-h">{program.name}</h2>
          <p>{program.summary} Miss a day and it waits for you.</p>
          {saving === "error" && (
            <p className="home-program-error" role="alert">
              That didn&rsquo;t save. Try again.
            </p>
          )}
        </div>
        <button
          type="button"
          className="button"
          data-variant={promoted ? undefined : "ghost"}
          disabled={saving === "saving"}
          onClick={() => void enrol(program.id)}
        >
          Start {program.name}
        </button>
      </section>
    );
  }

  const p = programProgress(enrolment, sessions, now);
  const total = p.program.days.length;
  if (p.finishedAt && now.getTime() - Date.parse(p.finishedAt) > FINISHED_SHOWN_DAYS * DAY) return null;
  return (
    <section className="pane home-program" data-state={p.next ? "active" : "finished"} aria-labelledby="program-h">
      <div className="home-program-what">
        <span className="label">
          Program · {p.done} of {total} days done
        </span>
        <h2 id="program-h">{p.program.name}</h2>
        <ol className="program-days" aria-hidden="true">
          {p.program.days.map((d) => (
            <li key={d.day} data-done={d.day <= p.done || undefined} data-next={d.day === p.next?.day || undefined} />
          ))}
        </ol>
        <p className="home-program-line">{progressLine(p)}</p>
      </div>
      {p.next && (
        <div className="home-program-day">
          <p className="home-program-next">
            <span className="label">{p.doneToday ? "Tomorrow" : "Today"}</span>
            <b>
              Day {p.next.day} · {p.next.name}
            </b>
            <span>
              {describeMode({ mode: p.next.setup.mode, pacerHalfCycleSec: p.next.setup.pacer })} · {Math.round(p.next.setup.lengthSec / 60)} min.{" "}
              {p.next.line}
            </span>
          </p>
          {!p.doneToday && (
            <Link href={programDayHref(p.program, p.next, prefs.skillLevel)} className="button">
              <span className="rec-dot" aria-hidden="true" />
              Start day {p.next.day}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
