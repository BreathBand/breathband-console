"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, ViewTransition, type ReactNode } from "react";
import { Icon, Mark, type IconName } from "@/components/Icon";
import type { Backend } from "@/lib/backend";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { resetBrowserDb } from "@/lib/backend/local/db";
import { initials } from "@/lib/domain/format";
import { AthletePicker } from "./AthletePicker";
import { CloudLanding } from "./CloudLanding";
import { DeviceStatus } from "./device/DeviceStatus";

/** Pages for signed-out visitors. They render without the app chrome and bring their own header. */
const PUBLIC_PATHS = ["/cloud/login/", "/cloud/signup/", "/cloud/reset/"];
const LANDING = "/cloud/";
/** Full-screen pages: the recording instrument brings its own frame. */
const BARE_PATHS = ["/cloud/record/live/", "/cloud/record/duo/", "/cloud/welcome/"];
/** Pages a signed-in person can open before finishing setup. */
const BEFORE_SETUP = ["/cloud/welcome/", "/cloud/join/"];

// Set just before a deliberate sign-out, so the gate sends the visitor to the
// BreathCloud landing page instead of the login page.
const exit = { toLanding: false };

// Set when onboarding saves, so the gate doesn't bounce the person back to
// /cloud/welcome/ in the moment before the refreshed profile arrives.
const setup = { finished: false };

/** Called by the welcome flow once the person's preferences are saved. */
export function markSetupFinished(): void {
  setup.finished = true;
}

/** Signs out and lands on /cloud/ (rather than bouncing to the login page). */
export async function signOutToLanding(backend: Backend, reset = false): Promise<void> {
  exit.toLanding = true;
  await backend.auth.signOut();
  if (reset) resetBrowserDb();
}

/** Same-origin console paths only, so `?next=` can't send anyone off-site. */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/cloud/") && !raw.startsWith("//") ? raw : LANDING;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  match: string[];
}

const ATHLETE_NAV: NavItem[] = [
  { href: "/cloud/", label: "Home", icon: "home", match: ["/cloud/"] },
  { href: "/cloud/record/", label: "Record", icon: "record", match: ["/cloud/record/", "/cloud/record/live/"] },
  { href: "/cloud/sessions/?tab=sessions", label: "Sessions", icon: "history", match: ["/cloud/sessions/", "/cloud/session/"] },
  { href: "/cloud/device/", label: "Band", icon: "band", match: ["/cloud/device/"] },
  { href: "/cloud/account/", label: "Settings", icon: "settings", match: ["/cloud/account/", "/cloud/sharing/"] },
];

const COACH_NAV: NavItem[] = [
  { href: "/cloud/", label: "Dashboard", icon: "dashboard", match: ["/cloud/"] },
  { href: "/cloud/athletes/", label: "Athletes", icon: "athletes", match: ["/cloud/athletes/", "/cloud/sessions/", "/cloud/session/"] },
  { href: "/cloud/trends/", label: "Compare", icon: "compare", match: ["/cloud/trends/"] },
  { href: "/cloud/group/", label: "Live group", icon: "group", match: ["/cloud/group/", "/cloud/group/live/"] },
  { href: "/cloud/record/duo/", label: "Two-person", icon: "users", match: ["/cloud/record/duo/"] },
];

/**
 * Client-side auth gate and app frame for everything under /cloud. A static
 * export has no server to redirect from, so signed-out visitors are sent to
 * the login page here (with `?next=` so they come back), and /cloud/ itself
 * shows the BreathCloud landing page until they sign in. This is UX only —
 * data access is enforced by the backend's rules.
 *
 * Signed in, the frame is a carbon sidebar (brand, the one primary action,
 * navigation, the band's status and the account) beside the page. Below
 * 1024px the sidebar folds into a top bar and its navigation docks at the
 * bottom of the screen as a tab bar.
 */
export function CloudShell({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isLanding = pathname === LANDING;

  useEffect(() => {
    if (auth.status === "signed-out" && !isPublic && !isLanding) {
      const here = window.location.pathname + window.location.search;
      router.replace(exit.toLanding ? LANDING : `/cloud/login/?next=${encodeURIComponent(here)}`);
    }
    if (auth.status === "signed-out") {
      exit.toLanding = false;
      setup.finished = false;
    }
    if (auth.status === "signed-in" && isPublic) {
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
    }
    // New accounts set up their goal, level and sessions before anything else.
    const needsSetup = auth.status === "signed-in" && auth.profile !== null && !auth.profile.preferences?.onboardedAt && !setup.finished;
    if (needsSetup && !isPublic && !BEFORE_SETUP.includes(pathname)) router.replace("/cloud/welcome/");
  }, [auth, isPublic, isLanding, pathname, router]);

  if (auth.status === "loading") {
    return (
      <div className="boot" aria-busy="true">
        <Mark size={36} />
        <span className="sr-only">Loading BreathCloud…</span>
      </div>
    );
  }

  // Signed-out pages are full-bleed: the landing page and the auth screens.
  if (auth.status === "signed-out") {
    if (isLanding) return <CloudLanding />;
    return isPublic ? <>{children}</> : null;
  }
  if (isPublic) return null;
  if (BARE_PATHS.includes(pathname)) return <>{children}</>;

  const role = auth.profile?.role ?? "athlete";
  const name = auth.profile?.displayName ?? auth.user.email ?? "You";
  const nav = role === "coach" ? COACH_NAV : ATHLETE_NAV;
  const inAthlete = pathname === "/cloud/sessions/" || pathname === "/cloud/session/";

  return (
    <div className="app">
      <aside className="side">
        <div className="side-top">
          <Link href="/cloud/" className="brand" aria-label="Breathband BreathCloud, home">
            <Mark size={26} label="" />
            <span className="brand-words" aria-hidden="true">
              <span className="brand-name">
                Breathband<sup>®</sup>
              </span>
              <span className="brand-sub">BreathCloud</span>
            </span>
          </Link>
          <Link href="/cloud/account/" className="mbar-account">
            <span className="avatar sm" aria-hidden="true">
              {initials(name)}
            </span>
            <span className="sr-only">Your account</span>
          </Link>
        </div>

        {role === "athlete" && (
          <Link href="/cloud/record/" className="side-cta">
            <span className="side-cta-dot" aria-hidden="true" />
            Start a session
          </Link>
        )}

        <nav className="side-nav" aria-label="Main">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.match.includes(pathname) ? "page" : undefined}>
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {role === "coach" && inAthlete && (
          <div className="side-picker">
            <span className="side-label">Viewing</span>
            <Suspense fallback={null}>
              <AthletePicker coachId={auth.user.uid} />
            </Suspense>
          </div>
        )}

        <div className="side-foot">
          {role === "athlete" && <DeviceStatus />}
          {backend.kind === "local" && (
            <div className="side-demo">
              <span>
                <i className="live" aria-hidden="true" />
                Demo data, stored in this browser
              </span>
              <button
                type="button"
                className="side-link"
                title="Wipe this browser's demo data and start again"
                onClick={() => signOutToLanding(backend, true)}
              >
                Reset
              </button>
            </div>
          )}
          <div className="side-who">
            <Link
              href="/cloud/account/"
              className="who-name"
              aria-current={pathname === "/cloud/account/" ? "page" : undefined}
              title="Your account"
            >
              <span className="avatar" aria-hidden="true">
                {initials(name)}
              </span>
              <span>
                {name}
                <small>{role === "coach" ? "Coach" : "Athlete"}</small>
              </span>
            </Link>
            <button type="button" className="side-icon" onClick={() => signOutToLanding(backend)} title="Sign out">
              <Icon name="signOut" size={18} />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="app-main">
        {/* Each route crossfades in as it changes; the sidebar stays put (view-transition-name in shell.css). */}
        <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
          <div className="page-frame">{children}</div>
        </ViewTransition>
      </main>
    </div>
  );
}
