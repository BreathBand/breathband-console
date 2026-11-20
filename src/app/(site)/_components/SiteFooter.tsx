import Link from "next/link";
import { NAV } from "../_lib/meta";
import { Mark, Wordmark } from "./ui";
import { WaitlistForm } from "./WaitlistForm";

/** The closing call to action, on every page. The header's "Join the waitlist" jumps here. */
export function WaitlistBand() {
  return (
    <section className="s-band" id="waitlist" aria-labelledby="waitlist-h" tabIndex={-1}>
      <div className="s-wrap s-band-in">
        <div className="s-band-copy">
          <h2 id="waitlist-h" className="s-h2">
            Be first to train with Breathband.
          </h2>
          <p className="s-band-p">
            Breathband isn&apos;t on sale yet. Leave your email and tell us who you are, and we&apos;ll write when
            there&apos;s news for you.
          </p>
          <p className="s-band-p s-band-investor">
            Investors and partners: there&apos;s no public inbox yet, so this is the way to reach the team. Choose
            Investor or partner and we&apos;ll reply by email.
          </p>
        </div>
        <WaitlistForm spot="band" />
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="s-footer">
      <div className="s-wrap s-footer-in">
        <div className="s-footer-brand">
          <span className="s-brand" aria-hidden="true">
            <Mark size={22} />
            <Wordmark />
          </span>
          <p>The band that scores your breathing.</p>
        </div>
        <nav aria-label="Footer" className="s-footer-nav">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/cloud/">BreathCloud sign in</Link>
            </li>
          </ul>
        </nav>
        <p className="s-footer-note">
          Breathband is a wellness product for breath training. It isn&apos;t a medical device and isn&apos;t intended
          to diagnose, treat or prevent any condition.
        </p>
      </div>
    </footer>
  );
}
