import { describe, expect, it } from "vitest";
import { pausedLine, homeLayout, withMechanics } from "./tailor";

describe("pausedLine", () => {
  it("speaks in the goal's tone, as 02 §8 writes it", () => {
    expect(pausedLine("train", 10)).toBe("Streak paused. Back at it today.");
    expect(pausedLine("focus", 3)).toBe("Your streak paused. Three minutes picks it back up.");
    expect(pausedLine("calm", 3)).toBe("Your streak paused. Start today to pick it back up.");
  });

  it("names Focus's own minutes a day", () => {
    expect(pausedLine("focus", 1)).toBe("Your streak paused. One minute picks it back up.");
    expect(pausedLine("focus", 15)).toBe("Your streak paused. 15 minutes picks it back up.");
  });

  it("never says lost", () => {
    for (const goal of ["train", "focus", "calm", null] as const) expect(pausedLine(goal, 5)).not.toMatch(/lost|broke|reset/i);
  });
});

describe("withMechanics", () => {
  const calm = homeLayout({ goal: "calm", professional: null, plans: [] });

  it("keeps Calm's ring and streak when they're on", () => {
    const layout = withMechanics(calm, { ring: true, streak: true, milestones: true });
    expect(layout.slots).toContain("calm-ring");
    expect(layout.streak).toBe(true);
  });

  it("drops the ring and the streak when they're switched off", () => {
    const layout = withMechanics(calm, { ring: false, streak: false, milestones: true });
    expect(layout.slots).not.toContain("calm-ring");
    expect(layout.streak).toBe(false);
  });

  it("never turns the streak on where the layout keeps it off", () => {
    const clinician = { ...calm, streak: false };
    expect(withMechanics(clinician, { ring: true, streak: true, milestones: true }).streak).toBe(false);
  });
});
