import Link from "next/link";
import { HeroInstrument } from "./_components/home/HeroInstrument";
import { ArrowRight, Mark, Phone, Tri, Window } from "./_components/ui";
import { WaitlistForm } from "./_components/WaitlistForm";
import { pageMeta } from "./_lib/meta";
import { SCORE_WORDS, scoreWord } from "./_lib/scores";

export const metadata = pageMeta({
  title: "Breathband: the band that scores your breathing",
  absoluteTitle: true,
  description:
    "Breathband is a sensor band worn around your belly, with an app that paces your breathing and scores each session from 1 to 10 for timing and depth. BreathCloud lets coaches follow along. Join the waitlist.",
  path: "/",
});

/* ------------------------------------------------------------------ content */

// Positioning against wrist and ring wearables. Every competitor statement
// here is general and needs the client's sign-off (see the report).
const COMPARE = [
  { k: "Where it reads", them: "Wrist or finger", us: "Your belly, where the breath moves" },
  { k: "What you learn", them: "An average breathing rate", us: "Timing and depth of every breath, in and out" },
  { k: "When", them: "In the background, often overnight", us: "Live, in a session of a few minutes" },
  { k: "Feedback", them: "A trend to look back on", us: "A pacer to follow, then a score from 1 to 10" },
];

const STEPS = [
  {
    t: "Put it on",
    d: "Wrap the band below your ribs and tighten it until the gauge reads In range. A few deep breaths set your range, once.",
    src: "/site/app-calibrate.webp",
    alt: "Breathband app setup screen: a strap tension gauge reading In range, with steps to wrap, tighten and lock the strap.",
  },
  {
    t: "Follow the pacer",
    d: "Breathe in as the ring grows and out as it shrinks, 5 seconds each way or 2. Turn on the notes and close your eyes.",
    src: "/site/app-live.webp",
    alt: "Live Paced 5-5 session at 2:33 of 5:00: your breath fills the pacer ring, the cue reads Breathe in, and a line view shows the last 20 seconds against the pacer.",
  },
  {
    t: "See your score",
    d: "Stop, and get one number with a word beside it, and your trend over time against your own baseline.",
    src: "/site/app-home.webp",
    alt: "Breathband app home screen: the latest Paced 5-5 session scored 7.5 out of 10, Good, half a point up on the last one, with a rising trend over six sessions.",
  },
];

// An example paced session (the same one the app screenshots show).
const EXAMPLE = { total: 7.5, timing: [8, 7], depth: [7, 8] } as const;

const PRESETS = [
  { k: "Train", who: "Athletes", d: "Breath control for training and recovery.", def: "Paced 5-5 · 10 min" },
  { k: "Focus", who: "Students", d: "A few calm minutes before an exam or a study block.", def: "Paced 5-5 · 3 min" },
  { k: "Calm", who: "Everyone else", d: "A short daily habit: one number and a streak.", def: "Open · 3 min" },
];

const STATUS = [
  {
    k: "The band",
    s: "In development",
    d: "Prototype bands read the belly's rise and fall and stream it to the app over Bluetooth.",
  },
  {
    k: "The app",
    s: "In development",
    d: "For iPhone and Android: pacer, scoring and history, as shown on this page.",
  },
  {
    k: "BreathCloud",
    s: "Built",
    d: "Runs today in the browser on demo data: record with the band over Bluetooth or the simulated band, review every score, and coach a whole squad.",
  },
  { k: "Waitlist", s: "Open", d: "For people who want to train, coaches, and investors or partners." },
];

const FAQ = [
  {
    q: "Is Breathband a medical device?",
    a: "No. It's a wellness product for breath training. It isn't intended to diagnose, treat or prevent any condition.",
  },
  {
    q: "Where do I wear it?",
    a: "Around your belly, between your belly button and the bottom of your rib cage. You set it up once; after that, a quick fit check before a session confirms it's sitting right.",
  },
  {
    q: "Do I have to watch the screen?",
    a: "No. Turn on the notes and the pacer plays a high tone at the top of each breath and a low one at the bottom, so you can close your eyes.",
  },
  {
    q: "Which phones will it work with?",
    a: "The app is being built for iPhone and Android, and the band connects to your phone over Bluetooth. You can also record on a computer in BreathCloud, using Chrome or Edge.",
  },
  {
    q: "Who can see my sessions?",
    a: "Only you, unless you share them. You choose what a coach sees, scores only or scores and breathing curves, and you can stop sharing at any time.",
  },
  {
    q: "When can I get one?",
    a: "Breathband isn't on sale yet. Join the waitlist and we'll email you when it is.",
  },
];

/* ------------------------------------------------------------------ bits */

function Score({ value }: { value: number }) {
  const w = scoreWord(value);
  return (
    <span className="h-sc">
      <b>{value}</b>
      <span className="h-sc-w">
        <i className={`h-sq h-sq-${w.band}`} aria-hidden="true" />
        {w.word}
      </span>
    </span>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="s-link">
      {children}
      <ArrowRight />
    </Link>
  );
}

/* ------------------------------------------------------------------ page */

export default function HomePage() {
  const total = scoreWord(EXAMPLE.total);
  return (
    <>
      {/* 1. Hero: the claim, the waitlist, and a live session to watch, hear and pace. */}
      <section className="h-hero" aria-labelledby="hero-h">
        <div className="s-wrap h-hero-in">
          <div className="h-hero-copy">
            <h1 id="hero-h" className="h-h1">
              <span className="h-rise">The band that</span>{" "}
              <span className="h-rise">
                <b>scores</b> your
              </span>{" "}
              <span className="h-rise">breathing.</span>
            </h1>
            <p className="h-lede h-fade">
              Breathband<sup>®</sup> is a sensor band worn around your belly, with an app that paces your breath. Follow
              the pacer, then see from 1 to 10 how closely you kept time and depth.
            </p>
            <div className="h-fade h-fade-2">
              <WaitlistForm spot="hero" compact />
              <p className="h-hero-alt">
                See it working now:{" "}
                <Link href="/cloud/login/" className="s-link s-link-inline">
                  try BreathCloud with a demo account
                  <ArrowRight size={14} />
                </Link>
              </p>
            </div>
          </div>
          <div className="h-hero-visual h-settle">
            <HeroInstrument />
          </div>
        </div>
      </section>

      {/* 2. Why it's different: training breath live, not tracking it in the background. */}
      <section className="s-sec s-light h-diff" aria-labelledby="diff-h">
        <div className="s-wrap">
          <div className="s-head s-head-split">
            <h2 id="diff-h" className="s-h2">
              Wearables track your breathing. Breathband trains it.
            </h2>
            <p className="s-p">
              Watches and rings estimate how fast you breathe, in the background. Breathband is for the minutes you
              practise: it reads every breath, leads you with a pacer, and shows how closely you followed.
            </p>
          </div>
          <table className="h-compare">
            <caption className="s-sr">How Breathband compares with wrist and ring wearables</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">Wrist and ring wearables</th>
                <th scope="col" className="h-compare-us">
                  <span className="h-compare-brand">
                    <Mark size={16} />
                    Breathband
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.k}>
                  <th scope="row">{r.k}</th>
                  <td>{r.them}</td>
                  <td className="h-compare-us">{r.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="h-compare-note">
            Apple Watch, Oura, Whoop and Garmin each report a breathing rate among their health measures.
          </p>
        </div>
      </section>

      {/* 3. How a session works, in three app screens. */}
      <section className="s-sec h-how" id="how" aria-labelledby="how-h">
        <div className="s-wrap">
          <div className="s-head">
            <h2 id="how-h" className="s-h2">
              A session in three steps.
            </h2>
          </div>
          <ol className="h-steps">
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <Phone src={s.src} alt={s.alt} />
                <h3 className="h-step-t">
                  <span className="h-step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  {s.t}
                </h3>
                <p className="h-step-d">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4. The score: one number, four behind it, a word with each. */}
      <section className="s-sec s-raised h-score" id="score" aria-labelledby="score-h">
        <div className="s-wrap h-score-in">
          <div className="h-score-copy">
            <h2 id="score-h" className="s-h2">
              One number, and exactly what&apos;s behind it.
            </h2>
            <p className="s-p">
              Every paced session gets a Total Breath Score from 1 to 10. Behind it are four more: your timing and your
              depth, on the way in and on the way out, each measured against the pacer.
            </p>
            <p className="s-p">
              Breathing freely instead? An open session shows your breathing rate, where 12 to 16 breaths a minute is
              typical at rest, and how deep you breathe.
            </p>
          </div>

          <figure className="h-card">
            <figcaption className="h-card-head">
              <span>Example session</span>
              <span>Paced 5-5 · 5:00</span>
            </figcaption>
            <p className="h-card-total">
              <span className="h-card-num">{EXAMPLE.total}</span>
              <span className="h-card-of">/ 10</span>
              <span className="h-card-word">
                <i className={`h-sq h-sq-${total.band}`} aria-hidden="true" />
                {total.word}
              </span>
            </p>
            <table className="h-card-table">
              <caption className="s-sr">Sub-scores for the example session</caption>
              <thead>
                <tr>
                  <td />
                  <th scope="col" className="h-col-in">
                    <Tri up /> In
                  </th>
                  <th scope="col" className="h-col-out">
                    <Tri up={false} /> Out
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Timing</th>
                  <td>
                    <Score value={EXAMPLE.timing[0]} />
                  </td>
                  <td>
                    <Score value={EXAMPLE.timing[1]} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Depth</th>
                  <td>
                    <Score value={EXAMPLE.depth[0]} />
                  </td>
                  <td>
                    <Score value={EXAMPLE.depth[1]} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="h-card-tip">Your out-breaths turned a little early. Let each one finish with the ring.</p>
            <ol className="h-scale" aria-label="Score words">
              {[...SCORE_WORDS].reverse().map((w) => (
                <li key={w.word} className={`h-scale-${w.band}`}>
                  <span className="h-scale-bar" aria-hidden="true" />
                  <b>{w.range.replace(/\.9$/, "")}</b> {w.word}
                </li>
              ))}
            </ol>
            <p className="h-card-note">Low scores are amber, never red: red means breathing in.</p>
          </figure>
        </div>
      </section>

      {/* 5. Who it's for: one band, three starting points. */}
      <section className="s-sec h-for" aria-labelledby="for-h">
        <div className="s-wrap">
          <div className="s-head s-head-split">
            <h2 id="for-h" className="s-h2">
              One band, set up for why you breathe.
            </h2>
            <p className="s-p">
              Pick Train, Focus or Calm when you start. It sets your defaults and the app&apos;s tone, never how
              you&apos;re scored.
            </p>
          </div>
          <ul className="h-for-list">
            {PRESETS.map((p) => (
              <li key={p.k}>
                <p className="h-for-who">{p.who}</p>
                <h3 className="h-for-k">{p.k}</h3>
                <p className="h-for-d">{p.d}</p>
                <p className="h-for-def">Starts with {p.def}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. BreathCloud: coaches and teams, in one section; the depth lives on /coaches/. */}
      <section className="s-sec s-raised h-cloud" aria-labelledby="cloud-h">
        <div className="s-wrap">
          <div className="s-head s-head-split">
            <h2 id="cloud-h" className="s-h2">
              BreathCloud: your breathing on a bigger screen.
            </h2>
            <div>
              <p className="s-p">
                Record a session on your computer with the band, review every breath against the pacer, and follow your
                trend week by week. Share with a coach and they see exactly the numbers you do.
              </p>
              <TextLink href="/coaches/">See BreathCloud for coaches</TextLink>
            </div>
          </div>
          <Window label="BreathCloud · live group session">
            <picture>
              {/* On a phone, only the lined-up panel, large enough to read. */}
              <source media="(max-width: 700px)" srcSet="/site/cloud-group-aligned-sm.webp" width={1000} height={492} />
              <img
                src="/site/cloud-group-aligned.webp"
                width={1800}
                height={872}
                loading="lazy"
                decoding="async"
                alt="BreathCloud live group session with demo data: five athletes' breathing lined up on one 30-second clock against the same 5-5 pacer; one athlete shares scores only, so her curve stays private."
              />
            </picture>
          </Window>
        </div>
      </section>

      {/* 7. Where Breathband is today: honest and dateless. */}
      <section className="s-sec s-light h-status" aria-labelledby="status-h">
        <div className="s-wrap h-status-in">
          <div>
            <h2 id="status-h" className="s-h2">
              Where Breathband is today.
            </h2>
            <p className="s-p">The software is ahead of the hardware. Here is each part as it stands.</p>
          </div>
          <ul className="h-status-list">
            {STATUS.map((s) => (
              <li key={s.k}>
                <h3 className="h-status-k">{s.k}</h3>
                <p className={`h-pill${s.s === "In development" ? "" : " h-pill-on"}`}>{s.s}</p>
                <p className="h-status-d">{s.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. Questions people ask first. */}
      <section className="s-sec h-faq" id="faq" aria-labelledby="faq-h">
        <div className="s-wrap h-faq-in">
          <h2 id="faq-h" className="s-h2">
            Questions, answered.
          </h2>
          <div className="h-faq-list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path d="M8 2v12M2 8h12" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
