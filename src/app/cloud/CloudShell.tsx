"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { Icon, Mark } from "@/components/Icon";
import type { Backend } from "@/lib/backend";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { resetBrowserDb } from "@/lib/backend/local/db";
import { AthletePicker } from "./AthletePicker";
import { CloudLanding } from "./CloudLanding";

/** Pages for signed-out visitors. They render without the app chrome and bring their own header. */
const PUBLIC_PATHS = ["/cloud/login/", "/cloud/signup/", "/cloud/reset/"];
const LANDING = "/cloud/";

// Set just before a deliberate sign-out, so the gate sends the visitor to the
// BreathCloud landing page instead of the login page.
const exit = { toLanding: false };

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

/**
 * Client-side auth gate for everything under /cloud. A static export has no
 * server to redirect from, so signed-out visitors are sent to the login page
 * here (with `?next=` so they come back), and /cloud/ itself shows the
 * BreathCloud landing page until they sign in. This is UX only — data access
 * is enforced by the backend's rules.
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
    if (auth.status === "signed-out") exit.toLanding = false;
    if (auth.status === "signed-in" && isPublic) {
      router.replace(safeNext(new URLSearchParams(window.location.search).get("next")));
    }
  }, [auth.status, isPublic, isLanding, router]);

  if (auth.status === "loading") {
    return (
      <p className="container muted" aria-busy="true">
        Loading…
      </p>
    );
  }

  // Signed-out pages are full-bleed: the landing page and the auth screens.
  if (auth.status === "signed-out") {
    if (isLanding) return <CloudLanding />;
    return isPublic ? <>{children}</> : null;
  }
  if (isPublic) return null;

  const role = auth.profile?.role ?? "athlete";
  const nav =
    role === "coach"
      ? [
          { href: "/cloud/", label: "Dashboard", icon: "dashboard" as const, match: ["/cloud/"] },
          {
            href: "/cloud/athletes/",
            label: "Athletes",
            icon: "athletes" as const,
            match: ["/cloud/athletes/", "/cloud/sessions/", "/cloud/session/"],
          },
          { href: "/cloud/trends/", label: "Compare", icon: "compare" as const, match: ["/cloud/trends/"] },
          { href: "/cloud/group/", label: "Group sessions", icon: "group" as const, match: ["/cloud/group/", "/cloud/group/live/"] },
        ]
      : [
          { href: "/cloud/", label: "Sessions", icon: "history" as const, match: ["/cloud/", "/cloud/sessions/", "/cloud/session/"] },
          { href: "/cloud/sharing/", label: "Sharing", icon: "share" as const, match: ["/cloud/sharing/"] },
        ];
  const inAthlete = pathname === "/cloud/sessions/" || pathname === "/cloud/session/";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row">
          <Link href="/cloud/" className="brand">
            <Mark />
            <span>
              BreathBand<sup>®</sup> <span className="brand-sub">BreathCloud</span>
            </span>
          </Link>

          <nav className="topnav" aria-label="Main">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={item.match.includes(pathname) ? "page" : undefined}>
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            ))}
          </nav>

          {role === "coach" && inAthlete && (
            <Suspense fallback={null}>
              <AthletePicker coachId={auth.user.uid} />
            </Suspense>
          )}

          <div className="topbar-end">
            {backend.kind === "local" && (
              <span className="sync">
                <i className="live" aria-hidden="true" />
                <span className="sync-text">Local demo data</span>
                <button
                  type="button"
                  className="chrome-button"
                  title="Wipe this browser's demo data and start again"
                  onClick={() => signOutToLanding(backend, true)}
                >
                  <Icon name="refresh" size={16} />
                  Reset
                </button>
              </span>
            )}
            <span className="who">
              <Link
                href="/cloud/account/"
                className="who-name"
                aria-current={pathname === "/cloud/account/" ? "page" : undefined}
                title="Your account"
              >
                {auth.profile?.displayName ?? auth.user.email}
                <small>{role === "coach" ? "Coach" : "Athlete"}</small>
              </Link>
              <button type="button" className="chrome-button" onClick={() => signOutToLanding(backend)}>
                <Icon name="signOut" size={16} />
                Sign out
              </button>
            </span>
          </div>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
