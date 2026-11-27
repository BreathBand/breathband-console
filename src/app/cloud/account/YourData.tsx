"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { ErrorState } from "@/components/States";
import { BackendError } from "@/lib/backend";
import { useBackend } from "@/lib/backend/BackendProvider";
import type { AccountDeletion } from "@/lib/backend/types";
import { downloadText } from "@/lib/download";
import { formatLongDay, formatTime } from "@/lib/domain/format";
import { useLoad } from "@/lib/useLoad";
import { leaveAfterDeletion, signOutToLanding } from "../CloudShell";

// Settings → Your data: download everything, see who opened your sessions
// (C10), and delete the account, with 24 hours to change your mind (C6, C7).

export function YourData({ uid }: { uid: string }) {
  return (
    <>
      <DownloadData />
      <AccessLog uid={uid} />
      <DeleteAccount />
    </>
  );
}

function DownloadData() {
  const backend = useBackend();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    setState("working");
    try {
      const data = await backend.data.exportMyData();
      const day = String(data.exportedAt ?? new Date().toISOString()).slice(0, 10);
      downloadText(`breathband-data-${day}.json`, JSON.stringify(data, null, 2), "application/json");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="data-block">
      <h3>Download my data</h3>
      <p className="settings-hint">Everything BreathCloud keeps about you, in one JSON file: your profile, sessions, notes, sharing and who opened what.</p>
      <button type="button" className="button" data-variant="ghost" onClick={download} disabled={state === "working"}>
        <Icon name="download" size={16} />
        {state === "working" ? "Preparing…" : "Download my data"}
      </button>
      {state === "error" && (
        <p className="error" role="alert">
          Couldn&apos;t prepare the file. Try again.
        </p>
      )}
    </div>
  );
}

function AccessLog({ uid }: { uid: string }) {
  const backend = useBackend();
  const log = useLoad(`access-log:${uid}`, () => backend.data.listAccessLog());

  return (
    <div className="data-block">
      <h3>Who opened your sessions</h3>
      {log.status === "loading" && <p className="settings-hint">Loading…</p>}
      {log.status === "error" && <ErrorState error={log.error} what="who opened your sessions" onRetry={log.retry} />}
      {log.status === "ready" && log.data.length === 0 && <p className="settings-hint">Nobody you share with has opened a session yet.</p>}
      {log.status === "ready" && log.data.length > 0 && (
        <ul className="access-log">
          {log.data.map((entry, i) => (
            <li key={`${entry.at}-${i}`}>
              <strong>{entry.viewerName}</strong>{" "}
              {entry.sessionId ? (
                <Link href={`/cloud/session/?athlete=${encodeURIComponent(uid)}&id=${encodeURIComponent(entry.sessionId)}`}>opened a session</Link>
              ) : (
                "opened a session you've since deleted"
              )}
              <span className="meta">
                {formatLongDay(entry.at)}, {formatTime(entry.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeleteAccount() {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "working" | "wrong" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("working");
    try {
      await leaveAfterDeletion(backend, () => backend.data.requestAccountDeletion(password));
    } catch (error) {
      setState(error instanceof BackendError && error.code === "invalid-credentials" ? "wrong" : "error");
    }
  }

  return (
    <div className="data-block">
      <h3>Delete my account</h3>
      <p className="settings-hint">
        Deletes your account, sessions and everything shared, 24 hours after you ask, and signs you out everywhere. Changed your mind? Sign in
        before the 24 hours are up and keep it. The people you share with are told you left, not why.
      </p>
      {!open ? (
        <button type="button" className="button" data-variant="ghost" onClick={() => setOpen(true)}>
          Delete my account…
        </button>
      ) : (
        <form className="invite-form" onSubmit={onSubmit}>
          <label className="field grow">
            Your password, to confirm
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setState("idle");
              }}
            />
          </label>
          <button type="submit" className="button" data-variant="danger" disabled={state === "working" || !password}>
            {state === "working" ? "Deleting…" : "Delete my account"}
          </button>
          <button type="button" className="button" data-variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      )}
      {state === "wrong" && (
        <p className="error" role="alert">
          That password isn&apos;t right.
        </p>
      )}
      {state === "error" && (
        <p className="error" role="alert">
          Couldn&apos;t ask for deletion. Try again.
        </p>
      )}
    </div>
  );
}

/** Signed in while a deletion waits: keep the account or sign out; nothing else is open. */
export function PendingDeletion({ deletion, onKept }: { deletion: AccountDeletion; onKept: () => void }) {
  const backend = useBackend();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  async function keep() {
    setState("working");
    try {
      await backend.data.cancelAccountDeletion();
      onKept();
    } catch {
      setState("error");
    }
  }

  return (
    <main className="container page pending-deletion" aria-labelledby="pending-h">
      <h1 id="pending-h">Your account is set to be deleted</h1>
      <p>
        On {formatLongDay(deletion.deleteAfter)} at {formatTime(deletion.deleteAfter)}, your account, sessions and sharing are deleted. Until then
        nobody can see them, you included.
      </p>
      <div className="settings-end">
        <button type="button" className="button" onClick={keep} disabled={state === "working"}>
          {state === "working" ? "Keeping…" : "Keep my account"}
        </button>
        <button type="button" className="button" data-variant="ghost" onClick={() => signOutToLanding(backend)}>
          Sign out
        </button>
      </div>
      {state === "error" && (
        <p className="error" role="alert">
          Couldn&apos;t cancel the deletion. If the 24 hours are up, it can&apos;t be stopped.
        </p>
      )}
    </main>
  );
}
