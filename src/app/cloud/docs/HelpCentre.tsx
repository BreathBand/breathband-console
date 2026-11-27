import Link from "next/link";
import { DocArticle, DocNote, type DocSection } from "./DocArticle";
import { CONTACT, PRIVACY_HREF, TERMS_HREF } from "./doc-links";

// Help (planning/v1/03 M1, M2). It says what to do, never how anything is
// computed: calibration and scoring internals stay off public pages
// (product spec principle 7). Keep the wording in step with the screens it
// describes (device/page.tsx, record/live/, settings/SharingPanel.tsx,
// InviteAthlete.tsx).

const SECTIONS: DocSection[] = [
  {
    id: "wearing",
    title: "Wearing the band",
    body: (
      <>
        <ol>
          <li>Wrap the band around your belly, between your belly button and the bottom of your ribs.</li>
          <li>Thread the strap through the clip and pull your stomach in.</li>
          <li>
            Tighten the strap until the gauge on the Band page (or at the start of a session) sits in the green and says{" "}
            <strong>Good fit</strong>.
          </li>
          <li>If it says <strong>A little tight</strong>, loosen it a notch so you can breathe in fully.</li>
        </ol>
        <p>
          The band reads the rise and fall of your belly, so it needs to stay put. If you take it off, or it slips, check
          the fit and calibrate again before your next session.
        </p>
      </>
    ),
  },
  {
    id: "browsers",
    title: "Which browsers work",
    body: (
      <>
        <p>
          Recording in BreathCloud connects to the band with Web Bluetooth. It works in <strong>Chrome or Edge</strong>{" "}
          on a computer (Windows, macOS, ChromeOS or Linux) or on an <strong>Android</strong> phone or tablet.
        </p>
        <p>
          It doesn&apos;t work in Safari or Firefox, or in any browser on an iPhone or iPad (they don&apos;t let websites
          use Bluetooth). Everything else, such as reviewing sessions and sharing, works in any up-to-date browser.
        </p>
        <DocNote>
          No band, or on a phone that can&apos;t connect? After you sign in, the simulated band lets you try every part of
          BreathCloud.
        </DocNote>
      </>
    ),
  },
  {
    id: "pairing",
    title: "Pairing your band",
    body: (
      <ol>
        <li>Charge the band and turn on Bluetooth on your computer or phone.</li>
        <li>
          In BreathCloud, open <strong>Band</strong> and choose <strong>Connect your band</strong>.
        </li>
        <li>Your browser shows a list of nearby devices. Choose your Breathband and select Pair.</li>
        <li>When the band page says Connected, tighten the strap until the gauge is in the green.</li>
      </ol>
    ),
  },
  {
    id: "pairing-trouble",
    title: "If pairing fails",
    body: (
      <>
        <p>Try these in order, and try connecting again after each one:</p>
        <ol>
          <li>
            <strong>Charge it.</strong> A flat band doesn&apos;t show up in the list.
          </li>
          <li>
            <strong>Bring it closer.</strong> Keep the band within a metre or two of your computer or phone.
          </li>
          <li>
            <strong>Turn Bluetooth off and on</strong> on your computer or phone.
          </li>
          <li>
            <strong>Close the phone app</strong> or any other page that might be connected to the band: it can only talk
            to one at a time.
          </li>
          <li>
            <strong>Retry.</strong> Reload the page and choose Connect your band again.
          </li>
        </ol>
        <p>
          If BreathCloud says Bluetooth is turned off for websites, check your browser&apos;s site settings allow
          Bluetooth. If it says the page isn&apos;t on a secure connection, open BreathCloud from its https:// address.
        </p>
      </>
    ),
  },
  {
    id: "calibration",
    title: "Calibrating",
    body: (
      <>
        <p>
          Each time you put the band on, a session starts with a quick strap check and 20 seconds of calibration. It
          tells Breathband how far you can breathe, so every score is measured against you.
        </p>
        <ol>
          <li>Sit or stand comfortably and relax your shoulders.</li>
          <li>
            Imagine your belly as a balloon. Breathe in slowly until the circle reaches the outer ring, then breathe all
            the way out until it shrinks to the inner one.
          </li>
          <li>Keep going with full, slow breaths until the time is up.</li>
        </ol>
        <p>
          If it can&apos;t see enough full breaths, it asks you to check the strap and try again. Breathe more slowly, all
          the way in and all the way out. If the band has stayed on since your last session, you can keep that
          calibration.
        </p>
      </>
    ),
  },
  {
    id: "scores",
    title: "Your scores, in plain words",
    body: (
      <>
        <p>
          <strong>Paced sessions</strong> (you follow the pacer) get a <strong>Total Breath Score</strong> from 1 to 10. It
          brings together four parts, each also scored from 1 to 10:
        </p>
        <ul>
          <li>
            <strong>Timing</strong>, for breathing in and breathing out: how closely each breath turned with the pacer.
          </li>
          <li>
            <strong>Depth</strong>, for breathing in and breathing out: how fully you breathed compared with your own
            range from calibration.
          </li>
        </ul>
        <p>
          Every score comes with a word (Excellent, Good, Fair, Building or Starting out) and a mark, so it never relies on
          colour alone. Red and blue in the breathing curve mean breathing in and out, with ▲ and ▼; they never mean good
          or bad.
        </p>
        <p>
          <strong>Open sessions</strong> (you breathe your own way) show your breathing rate in breaths a minute, and how
          steady it was.
        </p>
        <p>
          Your experience level, in Settings, changes how close counts as on target: beginners get more room while they
          learn the pacer. Scores are for practice and wellbeing, not a medical measurement.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing with a coach, clinician or educator",
    body: (
      <>
        <p>There are two ways to start sharing:</p>
        <ul>
          <li>
            <strong>They send you an invite link.</strong> Open it to see who&apos;s asking and exactly what they&apos;d
            see, choose scores only or scores and curves, and accept or decline. Links last 14 days.
          </li>
          <li>
            <strong>You give them a code.</strong> Under <strong>Settings → Coaches and sharing</strong>, create an invite
            code and give it to them. A code works once and expires after 7 days.
          </li>
        </ul>
        <p>
          With <strong>scores only</strong> they see your sessions, scores, notes and progress on practice they set. With{" "}
          <strong>scores and curves</strong> they also see your breathing curve against the pacer. They never see your
          calibration readings or your account, and they can&apos;t change your data.
        </p>
        <p>
          You can change what someone sees, or stop sharing, at any time under <strong>Settings → Coaches and sharing</strong>
          . It takes effect straight away.
        </p>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy and your data",
    body: (
      <ul>
        <li>Your sessions are private to you until you share them.</li>
        <li>You can download a copy of your data, or delete your account; deleting removes everything within 24 hours.</li>
        <li>
          The <Link href={PRIVACY_HREF}>privacy policy</Link> says what we keep, why and for how long, and the{" "}
          <Link href={TERMS_HREF}>terms of use</Link> cover how Breathband may be used.
        </li>
      </ul>
    ),
  },
  {
    id: "professionals",
    title: "Guide for professionals",
    body: (
      <>
        <p>
          For coaches, clinicians and educators using BreathCloud with the people they work with. Your roster page is
          named the way you chose in setup: Athletes, Clients or Students.
        </p>

        <h3 id="pro-inviting">Inviting people</h3>
        <ol>
          <li>Open your roster page and find <strong>Invite by text or email</strong>.</li>
          <li>Enter the person&apos;s name and their phone number or email, and create the invite link.</li>
          <li>Send the link, or let them scan the QR code. It lasts 14 days.</li>
        </ol>
        <p>
          Nothing is shared until they open the link, see exactly what you&apos;d see, and accept. If they&apos;ve given
          you an invite code instead, enter it on your roster page. Only invite people aged 16 or over.
        </p>

        <h3 id="pro-scopes">What you can see</h3>
        <p>
          Each person chooses <strong>scores only</strong> or <strong>scores and curves</strong>. Your invite asks for
          the one you set in setup, and they can lower it before accepting or change it later. You never see their
          calibration readings, and when they stop sharing your access ends at once.
        </p>

        <h3 id="pro-practice">Setting practice</h3>
        <p>
          From a person&apos;s page, choose <strong>Assign practice</strong> to set a paced or open session, how long and
          how often, and by when. The templates from your setup are a starting point. You can also set targets for their
          score, breathing rate and sessions a week, and follow their progress.
        </p>

        <h3 id="pro-reviewing">Reviewing sessions</h3>
        <p>
          Your dashboard shows who practised, who needs a look and new sessions to review. A session opens in the same
          review the person sees, read-only. You can comment, give kudos and keep private notes only you can see. Each
          time you open someone&apos;s session it appears in their access log, so they can see who looked. You can print
          a progress report for your own records.
        </p>

        <h3 id="pro-wording">Wording for clinicians</h3>
        <p>
          Breathband is a wellness tool. Keep what you write in BreathCloud, and what you say about it, about breath
          practice:
        </p>
        <table className="table bc-doc-table">
          <caption className="sr-only">Wording to use and to avoid</caption>
          <thead>
            <tr>
              <th scope="col">Say</th>
              <th scope="col">Instead of</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Clients</td>
              <td>Patients</td>
            </tr>
            <tr>
              <td>Breathing practice, a between-visits plan</td>
              <td>Treatment, therapy, prescription</td>
            </tr>
            <tr>
              <td>Worth a look</td>
              <td>Abnormal, alert, risk</td>
            </tr>
            <tr>
              <td>Your breathing pattern in this session</td>
              <td>A diagnosis, symptom or condition</td>
            </tr>
          </tbody>
        </table>
        <p>
          Don&apos;t record diagnoses, medical history or treatment in notes or comments. If someone&apos;s breathing worries
          you, talk to them, not to BreathCloud.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Still stuck?",
    body: (
      <p>
        Write to {CONTACT.support} ({CONTACT.confirm}) and tell us what you tried, which browser and device you&apos;re on,
        and what the screen said.
      </p>
    ),
  },
];

export function HelpCentre() {
  return (
    <DocArticle
      eyebrow="Help"
      title="Help centre"
      lede="Wearing and pairing the band, calibrating, what your scores mean, sharing, and a guide for professionals."
      updated="27 November 2026"
      legal={false}
      sections={SECTIONS}
    />
  );
}
