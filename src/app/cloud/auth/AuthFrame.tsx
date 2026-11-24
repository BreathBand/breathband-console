import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Brand } from "./Brand";
import { BreathTrace } from "./BreathTrace";
import "../auth.css";

const POINTS = [
  "One account for the Breathband app and BreathCloud",
  "Sessions you record in the app sync here",
  "Share with a coach on your terms, and stop at any time",
];

/**
 * Signed-out frame for /cloud/login/, /cloud/signup/ and /cloud/reset/:
 * a graphite bar, then the form beside a calm brand panel. The form comes
 * first in the DOM so phones (and screen readers) reach it first.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bc-page bc-auth">
      <a href="#auth-main" className="bc-skip">
        Skip to form
      </a>
      <header className="bc-bar">
        <div className="bc-bar-row">
          <Brand />
          <nav className="bc-bar-nav" aria-label="BreathCloud">
            <Link href="/cloud/" className="bc-bar-link">
              <Icon name="arrowLeft" size={18} />
              <span>
                About <span className="bc-hide-sm">BreathCloud</span>
              </span>
            </Link>
          </nav>
        </div>
      </header>
      <div className="bc-auth-body">
        <main className="bc-auth-main" id="auth-main" tabIndex={-1}>
          {children}
        </main>
        <aside className="bc-auth-aside" aria-label="About BreathCloud">
          <div className="bc-auth-aside-inner">
            <p className="bc-eyebrow">BreathCloud</p>
            <p className="bc-auth-pitch">Every Breathband session, reviewed on a bigger screen.</p>
            <BreathTrace />
            <ul className="bc-points">
              {POINTS.map((p) => (
                <li key={p}>
                  <Icon name="check" size={18} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
