"use client";

import { Suspense } from "react";
import { useAuth } from "@/lib/backend/BackendProvider";
import { AthleteWorkspace } from "./AthleteWorkspace";
import { CoachDashboard } from "./CoachDashboard";

/** Coaches land on their dashboard; athletes on their own overview. */
export default function CloudHome() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;

  if (auth.profile?.role === "coach") return <CoachDashboard coachId={auth.user.uid} />;
  return (
    <Suspense fallback={null}>
      <AthleteWorkspace athleteId={auth.user.uid} tab="overview" assign={false} />
    </Suspense>
  );
}
