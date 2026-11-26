import { describe, expect, it } from "vitest";
import { parseSetup } from "@/lib/prefs";
import { defaultDetails } from "./goal-questions";
import { FIRST_SESSION_SEC, firstSession, firstSessionHref, firstSessionName } from "./first-session";
import { defaultPreferences } from "./preferences";

describe("the first suggested session per track", () => {
  it("Train: Breath Control, paced 5-5 for three minutes, at the person's level", () => {
    const s = firstSession({ ...defaultPreferences("train", "advanced"), goalDetails: { train: defaultDetails("train") } });
    expect(s.id).toBe("breath-control");
    expect(s.name).toBe("Breath Control");
    expect(s.setup).toEqual({ mode: "paced", pacer: 5, lengthSec: 180, view: "circle", sound: true, skill: "advanced" });
  });

  it("Train with recovery among the wants: Post-training Downshift, same settings", () => {
    const train = { ...defaultDetails("train"), wants: ["control" as const, "recovery" as const] };
    const s = firstSession({ ...defaultPreferences("train"), goalDetails: { train } });
    expect(s.id).toBe("post-training-downshift");
    expect(s.name).toBe("Post-training Downshift");
    expect(s.setup).toMatchObject({ mode: "paced", pacer: 5, lengthSec: FIRST_SESSION_SEC });
  });

  it("Train without answers stored still gets Breath Control", () => {
    expect(firstSession(defaultPreferences("train")).id).toBe("breath-control");
  });

  it("Focus: Focus Sprint, paced 5-5 for three minutes", () => {
    const s = firstSession(defaultPreferences("focus", "beginner"));
    expect(s.id).toBe("focus-sprint");
    expect(s.setup).toEqual({ mode: "paced", pacer: 5, lengthSec: 180, view: "circle", sound: true, skill: "beginner" });
  });

  it("keeps the person's choice of silent sessions for paced first sessions", () => {
    const prefs = defaultPreferences("focus");
    expect(firstSession({ ...prefs, session: { ...prefs.session, sound: false } }).setup.sound).toBe(false);
  });

  it("Calm: Just breathe, open for three minutes with tones off", () => {
    const prefs = defaultPreferences("calm");
    const s = firstSession({ ...prefs, session: { ...prefs.session, sound: true } });
    expect(s.id).toBe("just-breathe");
    expect(s.name).toBe("Just breathe");
    expect(s.setup).toEqual({ mode: "open", pacer: 5, lengthSec: 180, view: "line", sound: false, skill: "intermediate" });
  });

  it("falls back to a paced 5-5 of three minutes when there is no goal", () => {
    for (const prefs of [null, undefined, {}]) {
      const s = firstSession(prefs);
      expect(s.id).toBe("first-session");
      expect(s.name).toBe("Your first session");
      expect(s.setup).toEqual({ mode: "paced", pacer: 5, lengthSec: 180, view: "circle", sound: true, skill: "intermediate" });
    }
  });
});

describe("the hand-off to the instrument", () => {
  it("carries the settings the instrument reads, plus the first-session flag", () => {
    for (const goal of ["train", "focus", "calm"] as const) {
      const s = firstSession(defaultPreferences(goal));
      const href = firstSessionHref(s);
      expect(href.startsWith("/cloud/record/live/?")).toBe(true);
      const q = new URLSearchParams(href.split("?")[1]);
      expect(parseSetup(q)).toEqual(s.setup);
      expect(firstSessionName(q)).toBe(s.name);
    }
  });

  it("names nothing for an ordinary recording or an unknown flag", () => {
    expect(firstSessionName(new URLSearchParams("mode=paced&pacer=5&len=300"))).toBeNull();
    expect(firstSessionName(new URLSearchParams("first=toString"))).toBeNull();
    expect(firstSessionName(new URLSearchParams("first=nope"))).toBeNull();
  });
});
