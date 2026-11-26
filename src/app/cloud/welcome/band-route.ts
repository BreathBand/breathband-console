import type { BandSupport } from "@/lib/device/support";
import type { SourceKind } from "@/lib/device/types";
import type { BandRoute, OnboardingChoices } from "@/lib/domain/types";

/** Where the sample person's sessions are shown. */
export const SAMPLE_PATH = "/cloud/welcome/sample/";

export interface RouteOption {
  id: BandRoute;
  label: string;
  detail: string;
  /** Shown instead of `detail` when the route can't be taken from this browser. */
  unavailable?: string;
}

/** The four ways in, in the spec's order (planning/v1/02 §3.1, step 9). */
export const ROUTE_OPTIONS: readonly RouteOption[] = [
  {
    id: "bluetooth",
    label: "Connect my Breathband",
    detail: "Over Bluetooth, from this browser. Turn the band on and keep it close.",
    unavailable: "Not from this browser. See above for what works.",
  },
  {
    id: "app",
    label: "I'll use the phone app",
    detail: "Record with the Breathband app. Your sessions show up here.",
  },
  {
    id: "none",
    label: "I don't have a band yet",
    detail: "Look around with sample sessions, marked Sample, until yours arrives.",
  },
  {
    id: "simulated",
    label: "Simulated band",
    detail: "A breathing person, streamed exactly like the band. For demos and trying it out.",
  },
];

/** Only the real band depends on the browser; every other route works anywhere. */
export function routeAvailable(route: BandRoute, support: BandSupport): boolean {
  return route !== "bluetooth" || support.bluetooth === "supported";
}

/** The route chosen before (onboarding run again), unless this browser can't take it. */
export function initialRoute(saved: OnboardingChoices | undefined, support: BandSupport): BandRoute | null {
  if (!saved) return null;
  return routeAvailable(saved.bandRoute, support) ? saved.bandRoute : null;
}

/** Which source the device provider should connect for this route, or null when nothing connects here. */
export function deviceKindFor(route: BandRoute): SourceKind | null {
  if (route === "bluetooth") return "bluetooth";
  if (route === "simulated") return "simulated";
  return null;
}

/** What gets stored. Sample data only goes with "no band yet". */
export function onboardingFor(route: BandRoute, sampleData: boolean): OnboardingChoices {
  return { bandRoute: route, sampleData: route === "none" && sampleData };
}

/** One line for the done step's summary. */
export function bandSummary(choice: OnboardingChoices | null): string {
  if (!choice) return "Not set up yet";
  switch (choice.bandRoute) {
    case "bluetooth":
      return "Breathband over Bluetooth";
    case "app":
      return "The phone app";
    case "simulated":
      return "Simulated band";
    case "none":
      return choice.sampleData ? "No band yet · sample sessions" : "No band yet";
  }
}

export interface FinishAction {
  label: string;
  href: string;
  /** The record button's red dot. */
  record?: boolean;
}

/**
 * Where the done step leads. With a band (or the simulator) the first session
 * comes next; with the phone app or no band, Home; in sample mode, the sample
 * sessions. Home is always offered too.
 */
export function finishActions(choice: OnboardingChoices | null): { primary: FinishAction; secondary: FinishAction | null } {
  const home: FinishAction = { label: "Go to my home", href: "/cloud/" };
  if (!choice || choice.bandRoute === "bluetooth" || choice.bandRoute === "simulated") {
    return { primary: { label: "Start my first session", href: "/cloud/record/", record: true }, secondary: home };
  }
  if (choice.sampleData) return { primary: { label: "Explore sample sessions", href: SAMPLE_PATH }, secondary: home };
  return { primary: home, secondary: null };
}
