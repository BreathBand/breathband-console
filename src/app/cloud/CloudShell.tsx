"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { resetBrowserDb } from "@/lib/backend/local/db";

const PUBLIC_PATHS = ["/cloud/login/", "/cloud/signup/"];

/**
 * Client-side auth gate for everything under /cloud. A static export has no
 * server to redirect from, so signed-out visitors are sent to the login page
 * here. This is UX only — data access is enforced by the backend's rules.
 */
export function CloudShell({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (auth.status === "signed-out" && !isPublic) router.replace("/cloud/login/");
    if (auth.status === "signed-in" && isPublic) router.replace("/cloud/");
  }, [auth.status, isPublic, router]);

  const ready = isPublic ? auth.status === "signed-out" : auth.status === "signed-in";

  return (
    <>
      {backend.kind === "local" && (
        <div className="notice">
          Local demo data — nothing here is real or leaves this browser.{" "}
          <button
            type="button"
            className="button"
            data-variant="ghost"
            style={{ minHeight: 28, marginLeft: 8 }}
            onClick={async () => {
              // Signing out sends us to the login page; the next read reseeds.
              await backend.auth.signOut();
              resetBrowserDb();
            }}
          >
            Reset demo data
          </button>
        </div>
      )}
      <header className="container row" style={{ justifyContent: "space-between" }}>
        <Link href="/cloud/" style={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>
          BreathCloud
        </Link>
        {auth.status === "signed-in" && (
          <div className="row">
            <span className="muted">{auth.profile?.displayName ?? auth.user.email}</span>
            <button
              type="button"
              className="button"
              data-variant="ghost"
              onClick={() => backend.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="container">
        {ready ? children : <p className="muted" aria-busy="true">Loading…</p>}
      </main>
    </>
  );
}
