"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { useBackend } from "@/lib/backend/BackendProvider";
import type { Squad, UserProfile } from "@/lib/domain/types";
import { useTerms } from "./useTerms";

/**
 * The coach's squads: create, rename, change members, delete. Squads are the
 * coach's own grouping (a team, a class, a training group); athletes don't see them.
 */
export function SquadManager({
  coachId,
  squads,
  athletes,
  onChange,
}: {
  coachId: string;
  squads: Squad[];
  athletes: UserProfile[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const t = useTerms();

  return (
    <section className="pane pane-pad" aria-labelledby="squads-h" id="squads">
      <div className="pane-h">
        <h2 id="squads-h">Squads</h2>
        <span className="meta">Your own groups, for filtering and group sessions. {t.Many} don&apos;t see them.</span>
      </div>
      <ul className="squads">
        {squads.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <SquadForm coachId={coachId} squad={s} athletes={athletes} onDone={() => (setEditing(null), onChange())} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className="squad-row">
              <b>{s.name}</b>
              <span className="label">
                {s.athleteIds.length === 0
                  ? `No ${t.many} yet`
                  : s.athleteIds.map((id) => athletes.find((a) => a.uid === id)?.displayName ?? t.One).join(", ")}
              </span>
              <button type="button" className="link small" onClick={() => setEditing(s.id)}>
                <Icon name="pencil" size={14} />
                Edit
              </button>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <SquadForm coachId={coachId} athletes={athletes} onDone={() => (setEditing(null), onChange())} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} />
          New squad
        </button>
      )}
    </section>
  );
}

function SquadForm({
  coachId,
  squad,
  athletes,
  onDone,
  onCancel,
}: {
  coachId: string;
  squad?: Squad;
  athletes: UserProfile[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const backend = useBackend();
  const t = useTerms();
  const [name, setName] = useState(squad?.name ?? "");
  const [members, setMembers] = useState(new Set(squad?.athleteIds ?? []));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });

  async function run(action: () => Promise<unknown>) {
    setStatus({ busy: true, error: "" });
    try {
      await action();
      onDone();
    } catch {
      setStatus({ busy: false, error: "Couldn't save the squad. Try again." });
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => backend.data.saveSquad(coachId, { id: squad?.id, name, athleteIds: [...members] }));
  };

  return (
    <form className="squad-form" onSubmit={submit}>
      <label className="field">
        Squad name
        <input required maxLength={40} value={name} placeholder="e.g. Sprint squad" onChange={(e) => setName(e.target.value)} />
      </label>
      <fieldset className="field">
        <legend>{t.Many}</legend>
        <div className="chip-picks">
          {athletes.map((a) => (
            <label key={a.uid} className="chip-pick" data-on={members.has(a.uid) || undefined}>
              <input
                type="checkbox"
                checked={members.has(a.uid)}
                onChange={() => {
                  const next = new Set(members);
                  if (next.has(a.uid)) next.delete(a.uid);
                  else next.add(a.uid);
                  setMembers(next);
                }}
              />
              {a.displayName}
            </label>
          ))}
        </div>
      </fieldset>
      {status.error && (
        <p className="error" role="alert">
          {status.error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="button" data-size="small" disabled={status.busy}>
          {squad ? "Save squad" : "Create squad"}
        </button>
        <button type="button" className="button" data-variant="ghost" data-size="small" onClick={onCancel}>
          Cancel
        </button>
        {squad &&
          (confirmDelete ? (
            <button
              type="button"
              className="button"
              data-variant="danger"
              data-size="small"
              disabled={status.busy}
              onClick={() => run(() => backend.data.deleteSquad(coachId, squad.id))}
            >
              Delete {squad.name}
            </button>
          ) : (
            <button type="button" className="link small squad-delete" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={14} />
              Delete squad
            </button>
          ))}
      </div>
    </form>
  );
}
