"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState, Skeleton } from "@/components/States";
import { useBackend } from "@/lib/backend/BackendProvider";
import { formatLongDay } from "@/lib/domain/format";
import { useLoad } from "@/lib/useLoad";
import type { Workspace } from "./AthleteWorkspace";

/** The coach's private notes on one athlete, and what the athlete shares with them. */
export function NotesTab({ ws }: { ws: Workspace }) {
  const backend = useBackend();
  const note = useLoad(`coach-note:${ws.viewerId}:${ws.athleteId}`, () => backend.data.getCoachNote(ws.viewerId, ws.athleteId));
  const first = ws.name.split(" ")[0];

  return (
    <div className="notes-grid">
      <section className="pane pane-pad" aria-labelledby="notes-h">
        <div className="pane-h">
          <h2 id="notes-h">Your notes on {first}</h2>
          <span className="meta">
            <Icon name="lock" size={14} /> Only you can see these
          </span>
        </div>
        {note.status === "loading" ? (
          <Skeleton lines={4} />
        ) : note.status === "error" ? (
          <ErrorState error={note.error} what="your notes" onRetry={note.retry} />
        ) : (
          <NoteEditor key={note.data} initial={note.data} ws={ws} />
        )}
      </section>

      <section className="pane pane-pad" aria-labelledby="sharing-h">
        <div className="pane-h">
          <h2 id="sharing-h">What {first} shares</h2>
        </div>
        {ws.link ? (
          <dl className="facts">
            <dt>Access</dt>
            <dd>
              {ws.link.scope === "curves"
                ? "Scores, notes and breathing curves"
                : "Scores and notes. Breathing curves are private"}
            </dd>
            <dt>Since</dt>
            <dd>{formatLongDay(ws.link.createdAt)}</dd>
            <dt>You can</dt>
            <dd>Read sessions, comment, send kudos and set practice. You can&apos;t change their data.</dd>
          </dl>
        ) : (
          <p className="muted">Not linked.</p>
        )}
        <p className="label">
          {first} controls this under Sharing, and can change it or stop sharing at any time.
        </p>
      </section>
    </div>
  );
}

function NoteEditor({ initial, ws }: { initial: string; ws: Workspace }) {
  const backend = useBackend();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = text !== saved;

  async function save() {
    setStatus("saving");
    try {
      await backend.data.saveCoachNote(ws.viewerId, ws.athleteId, text);
      setSaved(text);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="field">
        <span className="sr-only">Notes</span>
        <textarea
          rows={10}
          maxLength={5000}
          value={text}
          placeholder="Goals, injuries, what works for them…"
          onChange={(e) => {
            setText(e.target.value);
            if (status === "saved") setStatus("idle");
          }}
        />
      </label>
      <div className="row">
        <button type="submit" className="button" data-size="small" disabled={!dirty || status === "saving"}>
          {status === "saving" ? "Saving…" : "Save notes"}
        </button>
        {status === "saved" && !dirty && (
          <span className="ok-text inline" role="status">
            <Icon name="check" size={16} /> Saved
          </span>
        )}
        {status === "error" && (
          <span className="error" role="alert">
            Couldn&apos;t save. Try again.
          </span>
        )}
        {dirty && status !== "saving" && <span className="label">Unsaved changes</span>}
      </div>
    </form>
  );
}
