import Link from "next/link";
import { DocArticle, DocNote, Tbc, type DocSection } from "./DocArticle";
import { CONTACT, HELP_HREF, TERMS_HREF } from "./doc-links";

// DRAFT for counsel (planning/v1/03 N1). It describes what the API really
// keeps (server/db/schema/*), what "download my data" holds and how deletion
// works (T-0126). Change it with them: a new table, processor or retention
// rule means a new paragraph here.

const SECTIONS: DocSection[] = [
  {
    id: "summary",
    title: "In short",
    body: (
      <>
        <ul>
          <li>Breathband is a wellness product for breath training. It isn&apos;t a medical device, and nothing here is health care.</li>
          <li>We keep what you give us and what your band records, to run your account, score your sessions and keep your history.</li>
          <li>Nobody else sees your sessions unless you choose to share them, and you can stop sharing at any time.</li>
          <li>We don&apos;t sell your data, show you adverts or use advertising or analytics trackers.</li>
          <li>You can download your data, and deleting your account removes everything within 24 hours.</li>
        </ul>
      </>
    ),
  },
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          This policy covers BreathCloud (this website) and the Breathband app, which share one account. Breathband is
          responsible for your data (the &ldquo;controller&rdquo;). The company&apos;s legal name and address are{" "}
          <Tbc>to be confirmed before launch</Tbc>.
        </p>
        <p>
          Breathband is for people aged 16 and over. If you&apos;re younger, we don&apos;t create an account for you.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect and why",
    body: (
      <>
        <dl className="bc-doc-defs">
          <dt>Your account</dt>
          <dd>
            Your name, email address and password (kept only as a one-way hash, never readable), whether you use Breathband
            for yourself or with the people you work with, and your year of birth. We use these to sign you in, to show
            your name to anyone you share with, to keep Breathband to people 16 and over, and because normal breathing
            changes with age.
          </dd>

          <dt>Your profile and setup answers</dt>
          <dd>
            Your goal (Train, Focus or Calm), the answers you give when you set up (for example your sport, when you
            study, exam dates, the time of day that suits you), your experience level, your plan (sessions a week,
            minutes a day, reminders) and choices such as streaks and mood check-ins. We also save how far you got
            through setup, so you can carry on from another computer. Each answer changes a default, a reminder or what
            Home shows you; we don&apos;t ask for anything that nothing uses.
          </dd>

          <dt>If you work with people</dt>
          <dd>
            The kind of work you do (coach, clinician or educator), your organisation and profession if you give them,
            your sports or areas of work, how you refer to the people you work with, and the targets and sharing you ask
            for by default.
          </dd>

          <dt>Your agreements</dt>
          <dd>
            Which terms and notices you agreed to, which version, and when: the terms of use, this policy, processing
            your breathing data, and for professionals the professional terms and acknowledgements. We keep these as a
            record of your agreement.
          </dd>

          <dt>Your band and calibration</dt>
          <dd>
            The band&apos;s Bluetooth identifier, name, firmware version, battery level and when it was last seen, and
            the calibration taken each time you put it on, so your scores are measured against your own breathing.
          </dd>

          <dt>Your sessions and breathing signal</dt>
          <dd>
            For each session: when it was, paced or open, the pacer, its length, your scores and breathing rate, and any
            note or tags you add. We also keep the breathing signal the band recorded (the waveform), so you can review
            every breath later. With your agreement, we process this signal to score your sessions.
          </dd>

          <dt>Mood check-ins</dt>
          <dd>If you turn them on, the face you choose before and after a session, so Results can show how your mood changed.</dd>

          <dt>Habit and practice</dt>
          <dd>Milestones you reach, programs you join, and practice a professional sets for you, with your progress on it.</dd>

          <dt>Sharing</dt>
          <dd>
            Who you share with and what they can see, the invites between you (invite codes are kept only as hashes),
            comments, kudos, targets and practice, and the live group sessions you join. If you work with people, your
            own working data is kept too: private notes, squads and the flags you set.
          </dd>

          <dt>Access log</dt>
          <dd>
            Each time a professional opens one of your sessions, we record who and when. It&apos;s there so you can see
            who looked at your sessions.
          </dd>

          <dt>Sign-ins and service logs</dt>
          <dd>
            While you&apos;re signed in we keep a sign-in record with your IP address and browser, to keep your account
            secure and let you sign out everywhere. Our servers keep short technical logs of requests (time, page,
            result) to keep the service running; invite codes and password-reset links are removed from those logs.
          </dd>
        </dl>
        <DocNote>
          We never ask for health conditions, diagnoses, medication, weight, height or medical history, and we ask
          professionals not to record them in BreathCloud.
        </DocNote>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <>
        <p>We use your data to:</p>
        <ul>
          <li>run your account and keep it secure;</li>
          <li>record, score and show your sessions, trends and progress;</li>
          <li>set your defaults, reminders and practice from your answers;</li>
          <li>send the emails you need, such as verifying your address and resetting your password;</li>
          <li>share what you choose, with the people you choose.</li>
        </ul>
        <p>
          Scores describe how you breathed against the pacer and your own range. They&apos;re for practice and
          wellbeing, not for medical decisions. We don&apos;t sell your data or use it for advertising. The legal basis
          for each use (your agreement, our contract with you, or a legitimate interest such as security) is{" "}
          <Tbc>to be confirmed with counsel before launch</Tbc>.
        </p>
      </>
    ),
  },
  {
    id: "where",
    title: "Where it's stored",
    body: (
      <>
        <p>
          Your account, profile and sessions are kept in our database, and breathing signals in a separate file store,
          both on our hosting provider&apos;s servers. The region they run in is <Tbc>to be confirmed before launch</Tbc>.
          Everything travels over an encrypted connection.
        </p>
        <p>
          BreathCloud sets one sign-in cookie, which keeps you signed in and can&apos;t be read by scripts on the page. Your
          browser also remembers your light or dark choice. There are no advertising or analytics cookies.
        </p>
        <p>
          The demo version of BreathCloud keeps its sample data only in your browser; nothing in it reaches our servers.
        </p>
      </>
    ),
  },
  {
    id: "processors",
    title: "Who processes it for us",
    body: (
      <>
        <p>We use a small number of providers who process data only on our instructions:</p>
        <ul>
          <li>
            <strong>Hosting</strong> (servers, database and file storage): <Tbc>provider to be confirmed</Tbc>.
          </li>
          <li>
            <strong>Email</strong> (verification, password reset and reminders): <Tbc>provider to be confirmed</Tbc>.
          </li>
        </ul>
        <p>We don&apos;t use an analytics provider. This list will be complete before launch, and we&apos;ll update it when it changes.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing with a professional",
    body: (
      <>
        <p>
          A coach, clinician or educator sees your sessions only if you accept their invite or give them an invite code.
          Before you accept, you choose what they see:
        </p>
        <ul>
          <li>
            <strong>Scores only:</strong> your sessions&apos; dates, types and lengths, scores, breathing rate, notes, and
            your progress on practice they set.
          </li>
          <li>
            <strong>Scores and curves:</strong> all of that, plus your breathing signal against the pacer.
          </li>
        </ul>
        <p>
          They never see your calibration readings, your password or your account settings, and they can&apos;t change or
          delete your sessions. They can comment, give kudos, set practice and targets, include you in live group
          sessions and print a progress report of what you share.
        </p>
        <p>
          You can change what someone sees, or stop sharing, at any time under <strong>Settings → Coaches and sharing</strong>.
          Stopping takes effect straight away. Notes a professional keeps about you are their working notes: you
          don&apos;t see them, and they aren&apos;t in your download.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <ul>
          <li>Your data is kept while you have an account. A session you delete is removed with its breathing signal.</li>
          <li>Invite links from a professional expire after 14 days, and invite codes you create after 7 days.</li>
          <li>Sign-in records end when you sign out or the sign-in expires; email verification and reset links expire within a day.</li>
          <li>When you delete your account, everything goes within 24 hours (below).</li>
          <li>
            How long backups keep deleted data before they&apos;re overwritten is <Tbc>to be confirmed before launch</Tbc>.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "delete",
    title: "Deleting your account and downloading your data",
    body: (
      <>
        <p>
          <strong>Download my data</strong> gives you a copy of what&apos;s yours, in a standard format (JSON): your
          account and profile, setup answers, agreements, bands, sessions with their breathing signals, mood check-ins,
          sharing, comments and practice, and the access log. It leaves out other people&apos;s private notes about you,
          secrets such as password hashes, and the internal values the band uses to calibrate.
        </p>
        <p>
          <strong>Deleting your account</strong> asks for your password. Your account is hidden from everyone at once
          and you&apos;re signed out everywhere. Within 24 hours everything is deleted: your account, profile, sessions,
          breathing signals, sharing, comments, agreements and any waitlist sign-up with your email. Changed your mind?
          Sign in within those 24 hours and cancel.
        </p>
        <p>
          You can do both from your account, or by writing to us (below).
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you can ask us to:</p>
        <ul>
          <li>tell you what we hold about you and give you a copy;</li>
          <li>correct something that&apos;s wrong (you can change most of it yourself in Settings);</li>
          <li>delete your data;</li>
          <li>give you your data to take elsewhere;</li>
          <li>stop or limit a use you object to.</li>
        </ul>
        <p>
          You can withdraw your agreement to processing your breathing data at any time. Without it we can&apos;t score
          your sessions, so withdrawing means deleting your account. You can also complain to your data protection
          authority; which one depends on where you live, and we&apos;ll name ours here once the launch region is{" "}
          <Tbc>confirmed</Tbc>.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        Every version of this policy has a date. When it changes in a way that matters, we&apos;ll tell you and ask you to
        agree again; your earlier agreement stays on record with its version. See also the{" "}
        <Link href={TERMS_HREF}>terms of use</Link>.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about your data, or a request under this policy: write to {CONTACT.privacy} (<Tbc>{CONTACT.confirm}</Tbc>
        ). For help with the band or your account, see <Link href={HELP_HREF}>Help</Link>.
      </p>
    ),
  },
];

export function PrivacyPolicy() {
  return (
    <DocArticle
      eyebrow="Legal"
      title="Privacy policy"
      lede="What Breathband keeps about you, why, where, for how long, and how to see it, take it with you or delete it."
      updated="27 November 2026"
      legal
      sections={SECTIONS}
    />
  );
}
