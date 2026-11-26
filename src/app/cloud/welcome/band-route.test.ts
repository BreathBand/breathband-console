import { describe, expect, it } from "vitest";
import type { BandSupport } from "@/lib/device/support";
import { onboardingProblem } from "@/lib/domain/onboarding";
import {
  bandSummary,
  deviceKindFor,
  finishActions,
  initialRoute,
  onboardingFor,
  ROUTE_OPTIONS,
  routeAvailable,
  SAMPLE_PATH,
} from "./band-route";

const WITH_BT: BandSupport = { bluetooth: "supported", browser: "chromium" };
const NO_BT: BandSupport = { bluetooth: "unsupported", browser: "safari" };
const INSECURE: BandSupport = { bluetooth: "insecure", browser: "chromium" };

describe("the band step's routes", () => {
  it("offers the spec's four routes, in its order", () => {
    expect(ROUTE_OPTIONS.map((o) => o.id)).toEqual(["bluetooth", "app", "none", "simulated"]);
  });

  it("closes only the Bluetooth route when the browser can't use Bluetooth", () => {
    for (const support of [NO_BT, INSECURE]) {
      expect(routeAvailable("bluetooth", support)).toBe(false);
      for (const r of ["app", "none", "simulated"] as const) expect(routeAvailable(r, support)).toBe(true);
    }
    for (const o of ROUTE_OPTIONS) expect(routeAvailable(o.id, WITH_BT)).toBe(true);
  });

  it("connects the band or the simulator, and nothing for the app or no band", () => {
    expect(deviceKindFor("bluetooth")).toBe("bluetooth");
    expect(deviceKindFor("simulated")).toBe("simulated");
    expect(deviceKindFor("app")).toBeNull();
    expect(deviceKindFor("none")).toBeNull();
  });

  it("starts from the route chosen before, unless this browser can't take it", () => {
    expect(initialRoute(undefined, WITH_BT)).toBeNull();
    expect(initialRoute({ bandRoute: "app", sampleData: false }, NO_BT)).toBe("app");
    expect(initialRoute({ bandRoute: "bluetooth", sampleData: false }, WITH_BT)).toBe("bluetooth");
    expect(initialRoute({ bandRoute: "bluetooth", sampleData: false }, NO_BT)).toBeNull();
  });
});

describe("what the choice records", () => {
  it("keeps sample data only with no band, and every record passes the adapter's check", () => {
    expect(onboardingFor("none", true)).toEqual({ bandRoute: "none", sampleData: true });
    expect(onboardingFor("none", false)).toEqual({ bandRoute: "none", sampleData: false });
    for (const r of ["bluetooth", "app", "simulated"] as const) expect(onboardingFor(r, true)).toEqual({ bandRoute: r, sampleData: false });
    for (const o of ROUTE_OPTIONS) {
      for (const sample of [true, false]) expect(onboardingProblem(onboardingFor(o.id, sample))).toBeNull();
    }
  });

  it("summarises the choice for the done step", () => {
    expect(bandSummary(null)).toBe("Not set up yet");
    expect(bandSummary(onboardingFor("none", true))).toBe("No band yet · sample sessions");
    expect(bandSummary(onboardingFor("none", false))).toBe("No band yet");
    expect(bandSummary(onboardingFor("app", false))).toBe("The phone app");
    expect(bandSummary(onboardingFor("simulated", false))).toBe("Simulated band");
    expect(bandSummary(onboardingFor("bluetooth", false))).toBe("Breathband over Bluetooth");
  });
});

describe("where finishing leads", () => {
  it("goes to the first session with a band or the simulator, as before when skipped", () => {
    for (const choice of [null, onboardingFor("bluetooth", false), onboardingFor("simulated", false)]) {
      const { primary, secondary } = finishActions(choice);
      expect(primary).toEqual({ label: "Start my first session", href: "/cloud/record/", record: true });
      expect(secondary?.href).toBe("/cloud/");
    }
  });

  it("goes to the sample sessions in sample mode, with Home offered too", () => {
    const { primary, secondary } = finishActions(onboardingFor("none", true));
    expect(primary.href).toBe(SAMPLE_PATH);
    expect(secondary?.href).toBe("/cloud/");
  });

  it("goes Home with the phone app or no band and no samples", () => {
    for (const choice of [onboardingFor("app", false), onboardingFor("none", false)]) {
      expect(finishActions(choice)).toEqual({ primary: { label: "Go to my home", href: "/cloud/" }, secondary: null });
    }
  });
});
