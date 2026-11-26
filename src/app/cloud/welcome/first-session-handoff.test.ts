import { describe, expect, it } from "vitest";
import { firstSession, firstSessionHref } from "@/lib/domain/first-session";
import { defaultPreferences } from "@/lib/domain/preferences";
import { finishActions, onboardingFor, SAMPLE_PATH } from "./band-route";

// T-0115: with a band in hand, finishing onboarding goes straight into fit,
// calibration and the track's first suggested session (planning/v1/02 §3.1).

const href = firstSessionHref(firstSession(defaultPreferences("train")));

describe("finishing onboarding with the first session to hand", () => {
  it("goes straight to the instrument with a band or the simulator, Home offered as later", () => {
    for (const route of ["bluetooth", "simulated"] as const) {
      const { primary, secondary } = finishActions(onboardingFor(route, false), href);
      expect(primary).toEqual({ label: "Start my first session", href, record: true });
      expect(secondary?.href).toBe("/cloud/");
    }
  });

  it("keeps today's endings for a skipped band step, the phone app, no band and sample mode", () => {
    expect(finishActions(null, href).primary.href).toBe("/cloud/record/");
    expect(finishActions(onboardingFor("none", true), href).primary.href).toBe(SAMPLE_PATH);
    for (const choice of [onboardingFor("app", false), onboardingFor("none", false)]) {
      expect(finishActions(choice, href)).toEqual({ primary: { label: "Go to my home", href: "/cloud/" }, secondary: null });
    }
  });
});
