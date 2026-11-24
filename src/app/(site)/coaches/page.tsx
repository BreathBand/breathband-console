import Link from "next/link";
import { Shot, Window } from "../_components/ui";
import { pageMeta } from "../_lib/meta";

export const metadata = pageMeta({
  title: "BreathCloud for coaches",
  description:
    "BreathCloud is the web console behind Breathband. Coaches, trainers and physios see the athletes who share with them, review sessions breath by breath, set practice and run group sessions on one pacer.",
  path: "/coaches/",
});

const FEEDBACK = [
  {
    t: "Practice plans",
    d: "Set a session, like Paced 5-5 for 5 minutes four times this week. Matching sessions count toward it on their own.",
  },
  { t: "Comments", d: "Write under a session. Your athlete sees it with their results and can reply." },
  { t: "Kudos", d: "One tap to say well done. It shows as a small mark on the athlete's session." },
];

const SHARING = [
  { t: "Scores only", d: "You see scores and trends. Breathing curves stay private." },
  { t: "Scores and curves", d: "You also see every session's breathing curve, breath by breath." },
  { t: "Stop any time", d: "An athlete can stop sharing whenever they like. Their sessions leave your view at once." },
];

export default function CoachesPage() {
  return (
    <>
      {/* The console at a glance. */}
      <section className="c-hero" aria-labelledby="c-hero-h">
        <div className="s-wrap">
          <div className="c-hero-copy">
            <h1 id="c-hero-h" className="c-h1">
              BreathCloud: every breath your athletes take, in one place.
            </h1>
            <p className="c-lede">
              The web console behind Breathband. Coaches, trainers and physios see the athletes who share with them,
              review sessions breath by breath, set practice and run group sessions.
            </p>
            <div className="c-actions">
              <a href="#waitlist" className="s-btn">
                Join as a coach
              </a>
              <Link href="/cloud/" className="s-btn s-btn-line">
                BreathCloud sign in
              </Link>
            </div>
          </div>
          <Window label="BreathCloud · coach dashboard">
            <Shot
              priority
              src="/site/cloud-dashboard.webp"
              width={1800}
              height={663}
              alt="BreathCloud coach dashboard with demo data: sessions in the last 7 days, the team's average Total Breath Score, practice on track and sessions to review; a Needs a look list; and a 14-day grid of each athlete's best score."
            />
          </Window>
        </div>
      </section>

      {/* Who needs you. */}
      <section className="s-sec s-raised" aria-labelledby="roster-h">
        <div className="s-wrap">
          <div className="s-head s-head-split">
            <h2 id="roster-h" className="s-h2">
              Every athlete, with a flag when something changes.
            </h2>
            <p className="s-p">
              Last session, latest score, a small trend and practice progress, with the reason someone needs a look: a
              comment to answer, a score that dropped, a missed week.
            </p>
          </div>
          <Window label="BreathCloud · athletes">
            <Shot
              src="/site/cloud-roster.webp"
              width={1800}
              height={479}
              alt="Athlete roster with demo data: five athletes with their last session, latest score and word, a trend line, sessions in the last 7 days, practice progress, and flags such as Score down 2.9 on their average."
            />
          </Window>
        </div>
      </section>

      {/* Review. */}
      <section className="s-sec" aria-labelledby="review-h">
        <div className="s-wrap">
          <div className="s-head s-head-split">
            <h2 id="review-h" className="s-h2">
              Breath by breath, against the pacer.
            </h2>
            <p className="s-p">
              Open any shared session for its score, timing and depth on the way in and out, and the full breathing
              curve against the pacer. Zoom to the breaths that slipped, with the athlete&apos;s note alongside.
            </p>
          </div>
          <Window label="BreathCloud · session review">
            <Shot
              src="/site/cloud-review.webp"
              width={1800}
              height={636}
              alt="One minute of a Paced 5-5 session with demo data: the athlete's line rising in red while breathing in and falling in blue while breathing out, over the grey pacer, with timing and depth marks for each breath below."
            />
          </Window>
        </div>
      </section>

      {/* Group sessions. */}
      <section className="s-sec s-raised" aria-labelledby="group-h">
        <div className="s-wrap">
          <div className="s-head s-head-split">
            <h2 id="group-h" className="s-h2">
              One pacer for the whole squad.
            </h2>
            <p className="s-p">
              Invite a squad, a class or a team warm-up. Athletes join from the app, you start the pacer for everyone,
              switch between 5-5 and 2-2 as you go, and watch everyone&apos;s breathing lined up in time.
            </p>
          </div>
          <Window label="BreathCloud · group session lobby">
            <Shot
              src="/site/cloud-group-lobby.webp"
              width={1800}
              height={702}
              alt="Group session lobby with demo data: Tuesday squad warm-up, Paced 5-5 for 5 minutes, five athletes joined from the app, one sharing scores only, with a Start the session button and the pacer counting down."
            />
          </Window>
        </div>
      </section>

      {/* Practice and feedback, then sharing rules: text only, no screenshot needed. */}
      <section className="s-sec" aria-labelledby="feedback-h">
        <div className="s-wrap c-two">
          <div>
            <h2 id="feedback-h" className="s-h2 c-h2-sm">
              Set the work. Say something about it.
            </h2>
            <ul className="c-list">
              {FEEDBACK.map((f) => (
                <li key={f.t}>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="s-h2 c-h2-sm" id="share-h">
              The athlete decides what you see.
            </h2>
            <ul className="c-list" aria-labelledby="share-h">
              {SHARING.map((f) => (
                <li key={f.t}>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </li>
              ))}
            </ul>
            <p className="c-note">
              Scores are never ranked between athletes. Each athlete is measured against their own calibration, and a
              coach never calibrates for anyone.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
