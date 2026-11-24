"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { Progress, StatusChip } from "@/components/Progress";
import { EmptyState } from "@/components/States";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import { describeAssignment, dueText, isOpen, type AssignmentProgress } from "@/lib/domain/coaching";
import { formatDay, formatLongDay } from "@/lib/domain/format";
import { useLoad } from "@/lib/useLoad";
import type { Workspace } from "./AthleteWorkspace";

const KINDS = [
  { id: "paced-5", label: "Paced 5-5", mode: "paced", half: 5 },
  { id: "paced-2", label: "Paced 2-2", mode: "paced", half: 2 },
  { id: "open", label: "Open", mode: "open", half: null },
] as const;
const LENGTHS = [3, 5, 10];

/**
 * Practice for one athlete. Coaches set it and can cancel what they set;
 * athletes see what their coach asked for and how far along they are.
 */
export function PlanTab({ ws, startOpen }: { ws: Workspace; startOpen: boolean }) {
  const backend = useBackend();
  const [formOpen, setFormOpen] = useState(startOpen && !ws.self);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // Athletes see who set each plan; their coaches' profiles are readable to them.
  const coaches = useLoad(ws.self ? `coaches:${ws.athleteId}` : null, () => backend.data.listCoaches(ws.athleteId));
  const coachName = (uid: string) =>
    uid === ws.viewerId ? "you" : (coaches.status === "ready" && coaches.data.find((c) => c.uid === uid)?.displayName) || "your coach";

  const open = ws.plans.filter(isOpen);
  const past = ws.plans.filter((p) => !isOpen(p));

  return (
    <div className="review">
      {!ws.self &&
        (formOpen ? (
          <AssignForm
            ws={ws}
            onCancel={() => setFormOpen(false)}
            onDone={(id) => {
              setFormOpen(false);
              setJustAdded(id);
              ws.reload();
            }}
          />
        ) : (
          <div className="row">
            <button type="button" className="button" onClick={() => setFormOpen(true)}>
              <Icon name="plus" size={18} />
              Assign practice
            </button>
            {justAdded && (
              <p role="status" className="ok-text inline">
                <Icon name="check" size={18} />
                Assigned. {ws.name.split(" ")[0]} sees it in the app and here.
              </p>
            )}
          </div>
        ))}

      <section className="pane pane-pad" aria-labelledby="current-h">
        <div className="pane-h">
          <h2 id="current-h">{ws.self ? "What your coach asked for" : "Current practice"}</h2>
          <span className="meta">Sessions count when the type and length match, before the due date</span>
        </div>
        {open.length === 0 ? (
          <EmptyState title="Nothing set right now">
            <p className="muted">
              {ws.self
                ? "When your coach sets practice, it shows here and in the app."
                : `Set ${ws.name.split(" ")[0]} a session type, a length and how many times, with a note on what to focus on.`}
            </p>
          </EmptyState>
        ) : (
          <ul className="plan-cards">
            {open.map((p) => (
              <PlanCard key={p.assignment.id} p={p} ws={ws} by={coachName(p.assignment.coachId)} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="pane pane-pad" aria-labelledby="past-h">
          <div className="pane-h">
            <h2 id="past-h">Earlier</h2>
          </div>
          <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="past-h">
            <table className="table">
              <thead>
                <tr>
                  <th>Practice</th>
                  <th>Set</th>
                  <th>Due</th>
                  <th>Done</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {past.map((p) => (
                  <tr key={p.assignment.id}>
                    <td>{describeAssignment(p.assignment)}</td>
                    <td className="sub">{formatDay(p.assignment.createdAt)}</td>
                    <td className="sub">{formatDay(p.assignment.dueAt)}</td>
                    <td>
                      <Progress done={p.done} target={p.assignment.target} status={p.status} />
                    </td>
                    <td>
                      <StatusChip status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function PlanCard({ p, ws, by }: { p: AssignmentProgress; ws: Workspace; by: string }) {
  const backend = useBackend();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const mine = p.assignment.coachId === ws.viewerId;

  async function cancel() {
    setError("");
    try {
      await backend.data.cancelAssignment(ws.athleteId, p.assignment.id);
      ws.reload();
    } catch {
      setError("Couldn't cancel it. Try again.");
    }
  }

  return (
    <li className="plan-card">
      <div className="plan-card-h">
        <h3>{describeAssignment(p.assignment)}</h3>
        <StatusChip status={p.status} />
      </div>
      <Progress done={p.done} target={p.assignment.target} status={p.status} />
      <p className="label">
        {dueText(p.daysLeft)} ({formatLongDay(p.assignment.dueAt)}) · set by {by} on {formatDay(p.assignment.createdAt, undefined, false)}
      </p>
      {p.assignment.note && <p className="plan-note">{p.assignment.note}</p>}
      {p.counted.length > 0 && (
        <p className="label">
          Counted:{" "}
          {p.counted.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ", "}
              <Link href={ws.sessionHref(s.id)}>{formatDay(s.startedAt, undefined, false)}</Link>
            </span>
          ))}
        </p>
      )}
      {mine &&
        (confirming ? (
          <div className="row">
            <button type="button" className="button" data-variant="danger" data-size="small" onClick={cancel}>
              Cancel this practice
            </button>
            <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" className="link small" onClick={() => setConfirming(true)}>
            Cancel practice
          </button>
        ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

/** yyyy-mm-dd for a date input, in local time. */
function dateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AssignForm({ ws, onCancel, onDone }: { ws: Workspace; onCancel: () => void; onDone: (id: string) => void }) {
  const backend = useBackend();
  const today = dateInput(ws.now);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("paced-5");
  const [minutes, setMinutes] = useState(5);
  const [target, setTarget] = useState(4);
  const [due, setDue] = useState(() => dateInput(new Date(ws.now.getTime() + 7 * 86_400_000)));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });
  const k = KINDS.find((x) => x.id === kind)!;
  const first = ws.name.split(" ")[0];

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const [y, m, d] = due.split("-").map(Number);
    // Due at the end of the chosen day, in the coach's time zone.
    const dueAt = new Date(y, m - 1, d, 23, 59, 0).toISOString();
    setStatus({ busy: true, error: "" });
    try {
      const created = await backend.data.createAssignment(ws.viewerId, {
        athleteId: ws.athleteId,
        mode: k.mode,
        pacerHalfCycleSec: k.half,
        durationSec: minutes * 60,
        target,
        dueAt,
        note,
      });
      onDone(created.id);
    } catch (e) {
      setStatus({
        busy: false,
        error:
          e instanceof BackendError && e.code === "invalid-input"
            ? "Check the details: 1 to 30 sessions, due today or later."
            : e instanceof BackendError && e.code === "permission-denied"
              ? `${first} no longer shares with you.`
              : "Couldn't assign it. Try again.",
      });
    }
  }

  return (
    <section className="pane pane-pad assign" aria-labelledby="assign-h">
      <div className="pane-h">
        <h2 id="assign-h">Assign practice to {first}</h2>
        <span className="meta">Shows in their app and on their BreathCloud overview</span>
      </div>
      <form className="assign-form" onSubmit={onSubmit}>
        <fieldset className="field">
          <legend>Session</legend>
          <div className="seg">
            {KINDS.map((x) => (
              <button key={x.id} type="button" aria-pressed={kind === x.id} onClick={() => setKind(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Length</legend>
          <div className="seg">
            {LENGTHS.map((n) => (
              <button key={n} type="button" aria-pressed={minutes === n} onClick={() => setMinutes(n)}>
                {n} min
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field narrow-field">
          How many times
          <input
            type="number"
            min={1}
            max={30}
            required
            value={target}
            onChange={(e) => setTarget(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
        </label>
        <label className="field narrow-field">
          Due by
          <input type="date" required min={today} value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="field wide-field">
          <span>
            What to focus on <span className="muted">(optional)</span>
          </span>
          <textarea
            rows={3}
            maxLength={500}
            value={note}
            placeholder="e.g. Let each exhale finish before the ring turns."
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="wide-field label preview">
          {first} will see: <b>{describeAssignment({ mode: k.mode, pacerHalfCycleSec: k.half, durationSec: minutes * 60, target })}</b>, due{" "}
          {due ? formatLongDay(new Date(`${due}T12:00:00`).toISOString()) : "–"}.
        </p>
        {status.error && (
          <p className="error wide-field" role="alert">
            {status.error}
          </p>
        )}
        <div className="row wide-field">
          <button type="submit" className="button" disabled={status.busy}>
            {status.busy ? "Assigning…" : "Assign practice"}
          </button>
          <button type="button" className="button" data-variant="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
