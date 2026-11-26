"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/lib/backend/BackendProvider";
import { AthleteWorkspace } from "../AthleteWorkspace";
import type { AthleteTab } from "../links";

const TABS: AthleteTab[] = ["overview", "trends", "sessions", "plan", "notes"];

// /cloud/sessions/?athlete=<uid>[&tab=sessions|plan|notes][&assign=1] — one
// athlete's workspace. A query string instead of /cloud/athletes/[id] because
// static export can't prerender per-user dynamic routes. Without `athlete`,
// athletes get their own.
export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <AthleteSessions />
    </Suspense>
  );
}

function AthleteSessions() {
  const auth = useAuth();
  const params = useSearchParams();
  const self = auth.status === "signed-in" ? auth.user.uid : null;
  const athleteId = params.get("athlete") || self;
  if (!athleteId) return null;
  // Athletes' own overview is the home page (/cloud/), so their workspace opens on the session list.
  const tab = TABS.find((t) => t === params.get("tab")) ?? (athleteId === self ? "sessions" : "overview");

  return <AthleteWorkspace key={athleteId} athleteId={athleteId} tab={tab} assign={params.get("assign") === "1"} />;
}
