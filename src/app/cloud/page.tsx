"use client";

import Link from "next/link";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useLoad } from "@/lib/useLoad";
import { SessionList } from "./SessionList";

/** Athletes land on their own history; coaches land on their athlete list. */
export default function CloudHome() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;

  if (auth.profile?.role === "coach") return <CoachHome coachId={auth.user.uid} />;
  return (
    <div className="stack">
      <h1>Your sessions</h1>
      <SessionList athleteId={auth.user.uid} />
    </div>
  );
}

function CoachHome({ coachId }: { coachId: string }) {
  const backend = useBackend();
  const athletes = useLoad(`athletes:${coachId}`, () => backend.data.listAthletes(coachId));

  return (
    <div className="stack">
      <h1>Your athletes</h1>
      {athletes.status === "loading" && <p className="muted">Loading athletes…</p>}
      {athletes.status === "error" && <p className="error">Couldn&apos;t load your athletes.</p>}
      {athletes.status === "ready" &&
        (athletes.data.length === 0 ? (
          <p className="muted">
            No athletes yet. Ask an athlete for an invite code from the Breathband app.
          </p>
        ) : (
          <ul className="list">
            {athletes.data.map((a) => (
              <li key={a.uid} className="card">
                <Link href={`/cloud/sessions/?athlete=${encodeURIComponent(a.uid)}`}>
                  {a.displayName}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
