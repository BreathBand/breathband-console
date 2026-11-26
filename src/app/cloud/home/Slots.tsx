import type { HomeSlot as Slot } from "./tailor";

/**
 * Seams for parts of a goal's Home that later cards fill (planning/v1/02 §5.1).
 * Each renders nothing until its data exists, so the layout already says where
 * it goes:
 *
 * - `focus-mood`: Focus's mood change before and after a session (J6).
 * - `focus-exams`: Focus's exam countdown and study-day strip, from the goal
 *   details asked in onboarding (D4–D6).
 * - `calm-ring`: Calm's daily ring (J1).
 */
export function HomeSlot({ id }: { id: Slot }) {
  switch (id) {
    case "focus-mood":
    case "focus-exams":
    case "calm-ring":
      return null;
  }
}
