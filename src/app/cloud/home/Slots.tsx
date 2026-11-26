import type { Ring } from "@/lib/domain/habit";
import { DailyRing } from "./DailyRing";
import { FocusExams, FocusMood } from "./FocusSlots";
import type { HomeSlot as Slot } from "./tailor";

/**
 * Seams for parts of a goal's Home that later cards fill (planning/v1/02 §5.1).
 * Each renders nothing until its data exists, so the layout already says where
 * it goes:
 *
 * - `focus-mood`: Focus's mood change before and after a session (J6), while
 *   the check-in is on.
 * - `focus-exams`: Focus's exam countdown, from the exam dates asked in
 *   onboarding (D4–D6); the study-day strip is still to come.
 * - `calm-ring`: Calm's daily ring (J1), today's minutes against the plan.
 */
export function HomeSlot({ id, ring }: { id: Slot; ring?: Ring | null }) {
  switch (id) {
    case "calm-ring":
      return ring ? <DailyRing ring={ring} /> : null;
    case "focus-mood":
      return <FocusMood />;
    case "focus-exams":
      return <FocusExams />;
  }
}
