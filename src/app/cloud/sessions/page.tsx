"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useLoad } from "@/lib/useLoad";
import { SessionList } from "../SessionList";

// /cloud/sessions/?athlete=<uid> — a coach viewing one athlete's history.
// A query string instead of /cloud/athletes/[id] because static export
// can't prerender per-user dynamic routes.
export default function SessionsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <AthleteSessions />
    </Suspense>
  );
}

function AthleteSessions() {
  const auth = useAuth();
  const backend = useBackend();
  const params = useSearchParams();
  const self = auth.status === "signed-in" ? auth.user.uid : null;
  const athleteId = params.get("athlete") ?? self;
  const profile = useLoad(athleteId && `profile:${athleteId}`, () =>
    backend.data.getProfile(athleteId!),
  );

  if (!athleteId) return null;
  const name = profile.status === "ready" ? profile.data?.displayName : null;

  return (
    <div className="stack">
      <Link href="/cloud/">← Back</Link>
      <h1>{athleteId === self ? "Your sessions" : (name ?? "Athlete")}</h1>
      <SessionList athleteId={athleteId} />
    </div>
  );
}
