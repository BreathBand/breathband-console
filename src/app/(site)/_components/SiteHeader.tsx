"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "../_lib/meta";
import { Mark, Wordmark } from "./ui";

function normalise(path: string | null): string {
  if (!path) return "/";
  return path.endsWith("/") ? path : path + "/";
}

export function SiteHeader() {
  const current = normalise(usePathname());
  return (
    <header className="s-header">
      <div className="s-header-in s-wrap">
        <Link href="/" className="s-brand" aria-label="Breathband home">
          <Mark size={22} />
          <Wordmark />
        </Link>

        <nav className="s-nav" aria-label="Site">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="s-nav-link" aria-current={current === item.href ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="s-nav-signin">
              <Link href="/cloud/" className="s-nav-link">
                BreathCloud sign in
              </Link>
            </li>
          </ul>
        </nav>

        <div className="s-header-actions">
          <Link href="/cloud/" className="s-signin">
            BreathCloud sign in
          </Link>
          <a href="#waitlist" className="s-btn s-btn-sm">
            Join the waitlist
          </a>
        </div>
      </div>
    </header>
  );
}
