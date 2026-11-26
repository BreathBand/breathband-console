import { describe, expect, it } from "vitest";
import { templateLine, templatesFor } from "./pro-templates";

describe("practice templates per kind (planning/v1/02 §4.1 step 8)", () => {
  it("coach: Pre-training Activation (2-2, 2 min), Post-training Downshift (5-5, 8 min), Breath Control Block", () => {
    const [activation, downshift, block] = templatesFor("coach");
    expect(activation).toMatchObject({ name: "Pre-training Activation", mode: "paced", pacerHalfCycleSec: 2, durationSec: 120, format: "session" });
    expect(downshift).toMatchObject({ name: "Post-training Downshift", mode: "paced", pacerHalfCycleSec: 5, durationSec: 480 });
    expect(block).toMatchObject({ name: "Breath Control Block", format: "plan", days: 28 });
  });

  it("clinician: Daily slow breathing (5-5, 5 min), weekly open check (Open, 3 min), a between-visits plan", () => {
    const [daily, check, between] = templatesFor("clinician");
    expect(daily).toMatchObject({ name: "Daily slow breathing", pacerHalfCycleSec: 5, durationSec: 300, perWeek: 7 });
    expect(check).toMatchObject({ name: "Weekly open check", mode: "open", pacerHalfCycleSec: null, durationSec: 180 });
    expect(between).toMatchObject({ id: "between-visits", format: "plan" });
  });

  it("educator: Focus Sprint (5-5, 3 min), Exam Week, Class calm (group, 5-5, 3 min)", () => {
    const [sprint, exam, calm] = templatesFor("educator");
    expect(sprint).toMatchObject({ name: "Focus Sprint", pacerHalfCycleSec: 5, durationSec: 180 });
    expect(exam).toMatchObject({ name: "Exam Week", format: "plan", days: 7 });
    expect(calm).toMatchObject({ name: "Class calm", format: "group", pacerHalfCycleSec: 5, durationSec: 180 });
  });

  it("gives every template a unique id across kinds, and plans their frequency", () => {
    const all = (["coach", "clinician", "educator"] as const).flatMap(templatesFor);
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    for (const t of all) {
      expect(t.mode === "open").toBe(t.pacerHalfCycleSec === null);
      expect(t.format === "plan").toBe(t.perWeek !== null && t.days !== null);
    }
  });

  it("describes each in one line", () => {
    const [activation, , block] = templatesFor("coach");
    expect(templateLine(activation)).toBe("Paced 2-2 · 2 min");
    expect(templateLine(block)).toBe("Paced 5-5 · 10 min · 4 times a week for 28 days");
    expect(templateLine(templatesFor("clinician")[0])).toBe("Paced 5-5 · 5 min · daily for 7 days");
    expect(templateLine(templatesFor("clinician")[1])).toBe("Open · 3 min");
    expect(templateLine(templatesFor("educator")[2])).toBe("Paced 5-5 · 3 min · with a group");
  });
});
