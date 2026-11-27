"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/lib/backend/BackendProvider";
import { Brand } from "../auth/Brand";
import { SITE_HOME } from "../links";
import { DOC_LINKS } from "./doc-links";
import "../auth.css";
import "./docs.css";

/**
 * The frame for the help and legal pages (T-0151): the signed-out console's
 * carbon bar and footer around a reading column. The same frame shows signed in
 * and signed out, so the text is in the exported HTML and reads without
 * JavaScript; only the bar's buttons follow the auth state.
 */
export function DocFrame({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  return (
    <div className="bc-page bc-docs">
      <a href="#doc-main" className="bc-skip">
        Skip to content
      </a>
      <header className="bc-bar">
        <div className="bc-bar-row">
          <Brand />
          <nav className="bc-bar-nav" aria-label="BreathCloud">
            {auth.status === "signed-in" ? (
              <Link href="/cloud/" className="bc-bar-button">
                <Icon name="arrowLeft" size={18} />
                <span>
                  Back <span className="bc-hide-sm">to BreathCloud</span>
                </span>
              </Link>
            ) : auth.status === "signed-out" ? (
              <>
                <Link href="/cloud/login/" className="bc-bar-button">
                  Sign in
                </Link>
                <Link href="/cloud/signup/" className="button bc-bar-cta bc-docs-cta">
                  Create account
                </Link>
              </>
            ) : null}
          </nav>
        </div>
      </header>

      <main id="doc-main" tabIndex={-1} className="bc-doc-main">
        {children}
      </main>

      <footer className="bc-footer">
        <div className="bc-wrap bc-footer-row">
          <p>
            Breathband<sup>®</sup> BreathCloud
          </p>
          <nav aria-label="Help and legal">
            <ul>
              {DOC_LINKS.map((d) => (
                <li key={d.href}>
                  <Link href={d.href} aria-current={pathname === d.href ? "page" : undefined}>
                    {d.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={SITE_HOME}>Breathband home</a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
