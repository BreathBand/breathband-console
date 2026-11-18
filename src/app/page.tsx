import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";

// Placeholder landing page. It exists to prove the plumbing (static
// prerender + waitlist write through the backend layer). The real page is
// Phase 2 of docs/PLAN.md.
export default function LandingPage() {
  return (
    <main className="container stack" style={{ paddingTop: 96 }}>
      <p className="muted">Placeholder — see docs/PLAN.md, Phase 2</p>
      <h1>Breathband</h1>
      <p>Train your breathing with a wearable sensor and a guided pacer.</p>
      <WaitlistForm source="hero" />
      <p>
        Already have an account? <Link href="/cloud/">Open BreathCloud</Link>
      </p>
    </main>
  );
}
