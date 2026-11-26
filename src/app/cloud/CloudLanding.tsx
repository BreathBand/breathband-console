"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useBackend } from "@/lib/backend/BackendProvider";
import { Brand } from "./auth/Brand";
import "./auth.css";

// The BreathCloud landing page: what signed-out visitors see at /cloud/.
// Signed-in users get their dashboard at the same URL (see CloudShell).
// Screenshots in /public/cloud/ were taken from this console with demo data,
// in light and dark, and follow the visitor's colour scheme.

export function CloudLanding() {
  const backend = useBackend();
  return (
    <div className="bc-page bc-landing">
      <a href="#landing-main" className="bc-skip">
        Skip to content
      </a>
      <header className="bc-bar">
        <div className="bc-bar-row">
          <Brand />
          <nav className="bc-bar-nav" aria-label="BreathCloud">
            <Link href="/" className="bc-bar-link bc-hide-md">
              Breathband home
            </Link>
            <Link href="/cloud/login/" className="bc-bar-button">
              Sign in
            </Link>
            <Link href="/cloud/signup/" className="button bc-bar-cta">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        {/* ------------------------------------------------------------ hero */}
        <section className="bc-hero" aria-labelledby="hero-h">
          <div className="bc-wrap bc-hero-grid">
            <div className="bc-hero-copy">
              <h1 id="hero-h">Your Breathband sessions, on a bigger screen.</h1>
              <p className="bc-hero-lede">
                Record with your band right here in the browser, or in the app. See every breath against the pacer, how
                your practice is trending, and share it with a coach. If you coach, follow all your athletes in one place.
              </p>
              <div className="bc-right-place">
                <Icon name="check" size={20} />
                <p>
                  <strong>Have the Breathband app? You&apos;re in the right place.</strong> Sign in with the same email
                  and password. There&apos;s no separate BreathCloud account.
                </p>
              </div>
              <div className="bc-cta-row">
                <Link href="/cloud/login/" className="button bc-cta">
                  Sign in
                  <Icon name="arrowRight" size={18} />
                </Link>
                <Link href="/cloud/signup/" className="bc-bar-button bc-cta-ghost">
                  Create an account
                </Link>
              </div>
              <p className="bc-hero-small">
                <Link href="/cloud/reset/">Forgot your password?</Link>
                {backend.kind === "local" && <> · This build uses demo data: demo accounts are on the sign-in page.</>}
              </p>
            </div>

            <figure className="bc-shot bc-hero-shot">
              <Screenshot
                name="session-review"
                alt="BreathCloud session review: the Total Breath Score with timing and depth for the inhale and exhale, on-target bars, the deviation histogram, and the breathing curve against the pacer within the ±3% band."
                priority
              />
              <figcaption>A paced session in BreathCloud. Shown with demo data.</figcaption>
            </figure>
          </div>
        </section>

        {/* ------------------------------------------------------------ audiences */}
        <section className="bc-section" aria-labelledby="who-h">
          <div className="bc-wrap">
            <header className="bc-section-head">
              <h2 id="who-h">One console, two views</h2>
              <p>
                Sign up as an athlete or a coach. Athletes see their own sessions. Coaches see the athletes who chose to
                share with them.
              </p>
            </header>

            <article className="bc-feature" aria-labelledby="athletes-h">
              <div className="bc-feature-copy">
                <p className="bc-tag">
                  <Icon name="lungs" size={18} />
                  For athletes
                </p>
                <h3 id="athletes-h">See every session, and where your practice is heading.</h3>
                <FeatureList
                  items={[
                    ["record", "Record here", "Connect your band over Bluetooth in Chrome or Edge and follow the pacer on screen, with tones."],
                    ["history", "History", "Every open and paced session, from the app or the web, newest first."],
                    ["dashboard", "Trends", "Total Breath Score across paced sessions, breathing rate across open ones."],
                    [
                      "marker",
                      "Session review",
                      "Your breathing against the pacer, scored 1–10 for timing and depth on every inhale and exhale, and what to change next time.",
                    ],
                    ["comment", "Notes and comments", "Add a note to any session and read what your coach says."],
                    ["plan", "Practice", "See the practice your coach set and how far along you are."],
                  ]}
                />
                <Link href="/cloud/signup/" className="bc-inline-link bc-more">
                  Create an athlete account
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
              <figure className="bc-shot">
                <Screenshot
                  name="athlete-overview"
                  alt="An athlete's BreathCloud home: the last session's score on a dark card with its breath drawn over the pacer, this week, streak and average, and the score trend against the target."
                />
                <figcaption>An athlete&apos;s home. Demo data.</figcaption>
              </figure>
            </article>

            <article className="bc-feature bc-feature-flip" aria-labelledby="coaches-h">
              <div className="bc-feature-copy">
                <p className="bc-tag">
                  <Icon name="athletes" size={18} />
                  For coaches
                </p>
                <h3 id="coaches-h">Know who needs a look before you open a single session.</h3>
                <FeatureList
                  items={[
                    [
                      "dashboard",
                      "Dashboard",
                      "Who needs a look, new sessions to review, a 14-day training grid and practice that's due.",
                    ],
                    ["athletes", "Roster", "Each athlete's latest score, trend and practice side by side."],
                    ["marker", "Session reviews", "The same review your athlete sees, read-only."],
                    ["plan", "Practice plans", "Assign paced or open practice and follow progress."],
                    ["kudos", "Comments, kudos and private notes", "Reply on a session, or keep notes only you can see."],
                    [
                      "group",
                      "Group sessions",
                      "Several athletes breathe to one pacer live, lined up in time on your screen.",
                    ],
                    ["users", "Two-person sessions", "Two bands on one pacer, side by side, for coaching in the room."],
                  ]}
                />
                <Link href="/cloud/signup/" className="bc-inline-link bc-more">
                  Create a coach account
                  <Icon name="arrowRight" size={16} />
                </Link>
              </div>
              <figure className="bc-shot">
                <Screenshot
                  name="coach-dashboard"
                  alt="A coach's BreathCloud dashboard: team numbers for the last 7 days, a Needs a look list, sessions to review, a 14-day training grid per athlete and practice due."
                />
                <figcaption>A coach&apos;s dashboard. Demo data.</figcaption>
              </figure>
            </article>
          </div>
        </section>

        {/* ------------------------------------------------------------ how it connects */}
        <section className="bc-section bc-section-pane" aria-labelledby="flow-h">
          <div className="bc-wrap">
            <header className="bc-section-head">
              <h2 id="flow-h">Record anywhere. Review it here.</h2>
              <p>The app and BreathCloud share one account, so every session ends up in the same place.</p>
            </header>
            <ol className="bc-flow">
              <FlowStep
                n={1}
                icon="band"
                title="Wear the band"
                text="Around your belly, just below the ribs. A quick strap check and five deep breaths calibrate it to you."
              />
              <FlowStep
                n={2}
                icon="record"
                title="Record in the app or here"
                text="Paced, following a 5-5 or 2-2 pacer, or open, breathing your own way. On a computer, BreathCloud connects to the band over Bluetooth."
              />
              <FlowStep
                n={3}
                icon="monitor"
                title="Review and share"
                text="Your score is ready when you stop. Review every breath, follow your trend, and share with a coach."
              />
            </ol>
            <p className="bc-flow-note">
              <Icon name="info" size={18} />
              No band yet? After you sign in, the simulated band lets you try every part of BreathCloud.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------ privacy */}
        <section className="bc-section" aria-labelledby="privacy-h">
          <div className="bc-wrap bc-privacy">
            <div className="bc-privacy-copy">
              <h2 id="privacy-h">Your sessions are yours. You decide who sees them.</h2>
              <ul className="bc-checks">
                <li>
                  <Icon name="lock" size={20} />
                  <span>
                    <strong>Only you, until you share.</strong> No one else sees your sessions unless you invite them.
                  </span>
                </li>
                <li>
                  <Icon name="share" size={20} />
                  <span>
                    <strong>One-time invite codes.</strong> Create a code under Sharing and give it to your coach. Each
                    code works once.
                  </span>
                </li>
                <li>
                  <Icon name="eye" size={20} />
                  <span>
                    <strong>Choose what they see.</strong> Scores only, or scores and breathing curves. Change it
                    whenever you like.
                  </span>
                </li>
                <li>
                  <Icon name="close" size={20} />
                  <span>
                    <strong>Stop sharing at any time.</strong> Coaches can read, comment and set practice, but they
                    can&apos;t change your data.
                  </span>
                </li>
              </ul>
            </div>
            <SharePreview />
          </div>
        </section>

        {/* ------------------------------------------------------------ closing CTA */}
        <section className="bc-closing" aria-labelledby="closing-h">
          <div className="bc-wrap bc-closing-row">
            <div>
              <h2 id="closing-h">Already recording with Breathband?</h2>
              <p>Sign in with the account you use in the app. New to Breathband? Create an account to get started.</p>
            </div>
            <div className="bc-cta-row">
              <Link href="/cloud/login/" className="button bc-cta">
                Sign in
                <Icon name="arrowRight" size={18} />
              </Link>
              <Link href="/cloud/signup/" className="bc-bar-button bc-cta-ghost">
                Create an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bc-footer">
        <div className="bc-wrap bc-footer-row">
          <p>
            Breathband<sup>®</sup> BreathCloud
          </p>
          <nav aria-label="Footer">
            <ul>
              <li>
                <Link href="/">Breathband home</Link>
              </li>
              <li>
                <Link href="/cloud/login/">Sign in</Link>
              </li>
              <li>
                <Link href="/cloud/signup/">Create an account</Link>
              </li>
              <li>
                <Link href="/cloud/reset/">Reset password</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** A console screenshot that follows the visitor's colour scheme. */
function Screenshot({ name, alt, priority = false }: { name: string; alt: string; priority?: boolean }) {
  // <picture> fetches only the source that matches, so eager loading the hero costs one image, not two.
  const common = {
    alt,
    width: 2560,
    height: 1600,
    sizes: "(min-width: 1100px) 820px, 100vw",
    ...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {}),
  };
  const { props: dark } = getImageProps({ ...common, src: `/cloud/${name}-dark.png` });
  const { props: light } = getImageProps({ ...common, src: `/cloud/${name}-light.png` });
  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={dark.srcSet ?? dark.src} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
      <img {...light} />
    </picture>
  );
}

function FeatureList({ items }: { items: [IconName, string, string][] }) {
  return (
    <ul className="bc-feature-list">
      {items.map(([icon, title, text]) => (
        <li key={title}>
          <span className="bc-feature-icon" aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
          <span>
            <strong>{title}.</strong> {text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FlowStep({ n, icon, title, text }: { n: number; icon: IconName; title: string; text: string }) {
  return (
    <li className="bc-step">
      <span className="bc-step-icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <h3>
        <span className="bc-step-n">{n}</span>
        <span className="sr-only">. </span>
        {title}
      </h3>
      <p>{text}</p>
    </li>
  );
}

/**
 * A live illustration of the sharing choice: flip between "Scores only" and
 * "Scores and curves" to see what a coach gets. Values are illustrative.
 */
function SharePreview() {
  const [scope, setScope] = useState<"scores" | "curves">("curves");
  return (
    <div className="bc-share" role="group" aria-labelledby="share-h">
      <div className="bc-share-head">
        <p id="share-h" className="bc-share-title">
          What your coach sees
        </p>
        <div className="seg bc-share-seg">
          <button type="button" aria-pressed={scope === "scores"} onClick={() => setScope("scores")}>
            Scores only
          </button>
          <button type="button" aria-pressed={scope === "curves"} onClick={() => setScope("curves")}>
            Scores and curves
          </button>
        </div>
      </div>
      <div className="bc-share-body" aria-live="polite">
        <div className="bc-share-scores">
          <div className="bc-share-total">
            <span className="bc-share-label">Total Breath Score</span>
            <span className="bc-share-big">8</span>
            <span className="bc-share-word">
              <i className="bc-dot-ok" aria-hidden="true" />
              Good
            </span>
          </div>
          <table className="bc-share-table">
            <caption className="sr-only">Example scores, inhale and exhale</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">
                  <span className="bc-in-ink" aria-hidden="true">
                    ▲
                  </span>{" "}
                  Inhale
                </th>
                <th scope="col">
                  <span className="bc-out-ink" aria-hidden="true">
                    ▼
                  </span>{" "}
                  Exhale
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Timing</th>
                <td>8</td>
                <td>7</td>
              </tr>
              <tr>
                <th scope="row">Depth</th>
                <td>9</td>
                <td>8</td>
              </tr>
            </tbody>
          </table>
        </div>
        {scope === "curves" ? (
          <div className="bc-share-curve">
            <MiniCurve />
            <p className="bc-share-caption">Breathing curve against the pacer</p>
          </div>
        ) : (
          <div className="bc-share-curve bc-share-hidden">
            <Icon name="lock" size={20} />
            <p>Breathing curve not shared</p>
          </div>
        )}
      </div>
      <p className="bc-share-foot">Example values. You can change this, or stop sharing, under Sharing at any time.</p>
    </div>
  );
}

function MiniCurve() {
  // Two breaths: pacer (grey) and breathing (red rising, blue falling).
  const P = 120;
  const pts = (lag: number, amp: number) =>
    Array.from({ length: 121 }, (_, i) => {
      const x = i * 2;
      return [x, 40 + amp * Math.cos((2 * Math.PI * (x - lag)) / P)] as const;
    });
  const line = (p: readonly (readonly [number, number])[]) =>
    p.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y.toFixed(1)}`).join("");
  const breath = pts(6, 30);
  const rising = (x: number) => ((((x - 6) % P) + P) % P) / P < 0.5;
  const runs: { r: boolean; p: (readonly [number, number])[] }[] = [];
  for (const pt of breath) {
    const r = rising(pt[0]);
    const last = runs[runs.length - 1];
    if (last && last.r === r) last.p.push(pt);
    else {
      if (last) last.p.push(pt);
      runs.push({ r, p: [pt] });
    }
  }
  return (
    <svg viewBox="0 0 240 80" className="bc-mini" aria-hidden="true" preserveAspectRatio="none">
      <path d={line(pts(0, 34))} className="bc-mini-pacer" />
      {runs.map((run, i) => (
        <path key={i} d={line(run.p)} className={run.r ? "bc-mini-in" : "bc-mini-out"} />
      ))}
    </svg>
  );
}
