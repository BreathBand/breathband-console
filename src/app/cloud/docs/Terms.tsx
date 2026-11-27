import Link from "next/link";
import {
  PRIVATE_NOTES_HINT,
  PROFESSIONAL_TERMS_POINTS,
  STUDENT_AGE_ACKNOWLEDGEMENT,
  WELLNESS_ACKNOWLEDGEMENT,
} from "@/lib/domain/pro-terms";
import { DocArticle, DocNote, Tbc, type DocSection } from "./DocArticle";
import { CONTACT, HELP_HREF, PRIVACY_HREF } from "./doc-links";

// DRAFT for counsel (planning/v1/03 N2). The professional section quotes the
// wording professional onboarding already asks people to agree to
// (lib/domain/pro-terms.ts, T-0118), so the two can't drift apart.

const SECTIONS: DocSection[] = [
  {
    id: "about",
    title: "About these terms",
    body: (
      <>
        <p>
          These terms are the agreement between you and Breathband for using the Breathband app, BreathCloud (this
          website) and the Breathband band with them. You agree to them when you create an account. The company&apos;s legal
          name and address are <Tbc>to be confirmed before launch</Tbc>.
        </p>
        <p>
          How we handle your data is in the <Link href={PRIVACY_HREF}>privacy policy</Link>. If you work with people as a
          coach, clinician or educator, the <a href="#professionals">terms for professionals</a> apply to you as well.
        </p>
      </>
    ),
  },
  {
    id: "wellness",
    title: "A wellness tool, not a medical one",
    body: (
      <>
        <p>
          Breathband helps you practise breathing and see how you breathe. It doesn&apos;t diagnose, treat or monitor any
          condition, and it isn&apos;t a medical device. Its scores are for practice and wellbeing, not for medical
          decisions.
        </p>
        <ul>
          <li>If you feel dizzy, light-headed or unwell during a session, stop and breathe normally.</li>
          <li>If you have a health condition or concern, talk to a doctor before you change how you breathe.</li>
          <li>Don&apos;t use Breathband in place of advice or care from a health professional.</li>
        </ul>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You need to be 16 or over to have an account.</li>
        <li>Give your real name and an email address you can reach, and keep your password to yourself.</li>
        <li>One account signs you in to both the app and BreathCloud. You&apos;re responsible for what happens under it.</li>
        <li>Tell us straight away if you think someone else has used your account.</li>
      </ul>
    ),
  },
  {
    id: "using",
    title: "Using the band and BreathCloud",
    body: (
      <>
        <p>
          Recording in BreathCloud needs a browser that supports Bluetooth for websites (Chrome or Edge on a computer or
          an Android phone). The simulated band and sample data are there to look around; they&apos;re labelled as such and
          aren&apos;t your breathing. See <Link href={HELP_HREF}>Help</Link> for wearing, pairing and calibrating the band.
        </p>
        <p>
          We work to keep Breathband available and accurate, but we can&apos;t promise it will always be available, error
          free or suited to a particular purpose. We may change or improve features; if we take away something important,
          we&apos;ll tell you first.
        </p>
      </>
    ),
  },
  {
    id: "your-data",
    title: "Your data and what you add",
    body: (
      <>
        <p>
          Your sessions, notes and answers are yours. You allow us to store and process them only to run Breathband for
          you, as the <Link href={PRIVACY_HREF}>privacy policy</Link> describes. Processing your breathing data to score
          your sessions is a separate agreement you give when you sign up.
        </p>
        <p>
          You can download your data or delete your account at any time. Deleting removes everything within 24 hours.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing",
    body: (
      <p>
        Sharing is always your choice. You decide who sees your sessions and whether they see scores only or scores and
        breathing curves, and you can change it or stop sharing at any time under{" "}
        <strong>Settings → Coaches and sharing</strong>. Someone you share with can comment, set practice and targets, but
        can&apos;t change or delete your data.
      </p>
    ),
  },
  {
    id: "fair-use",
    title: "Fair use",
    body: (
      <>
        <p>Please don&apos;t:</p>
        <ul>
          <li>sign in to someone else&apos;s account, or record or share someone&apos;s breathing without their agreement;</li>
          <li>use invite links or codes that weren&apos;t meant for you;</li>
          <li>try to get around the access rules, overload the service, or copy, take apart or resell any part of it;</li>
          <li>try to work out how the scores are calculated, or use Breathband to build a competing product;</li>
          <li>post anything unlawful, abusive or misleading in notes or comments.</li>
        </ul>
        <p>Breathband&apos;s scoring method, software, name and designs belong to Breathband.</p>
      </>
    ),
  },
  {
    id: "professionals",
    title: "Terms for professionals",
    body: (
      <>
        <p>
          This part applies if you use BreathCloud with the people you work with: as a coach or trainer, a clinician or
          therapist, or a teacher or counsellor. You agree to it at the end of professional setup, as the professional
          terms.
        </p>

        <h3>What you agree to</h3>
        <ul>
          {PROFESSIONAL_TERMS_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <h3>Wellness use only</h3>
        <p>
          You use Breathband for breath practice and wellbeing. You don&apos;t use it to diagnose, treat or monitor a
          condition, and you don&apos;t present its scores as a medical measurement. Clinicians also acknowledge, during
          setup:
        </p>
        <blockquote className="bc-doc-quote">{WELLNESS_ACKNOWLEDGEMENT}</blockquote>
        <p>
          The private notes you keep about someone are for practice notes only: <q>{PRIVATE_NOTES_HINT}</q>
        </p>

        <h3>The people you invite are 16 or over</h3>
        <p>
          Breathband is for people aged 16 and over, so only invite people who are. Educators also acknowledge, during
          setup:
        </p>
        <blockquote className="bc-doc-quote">{STUDENT_AGE_ACKNOWLEDGEMENT}</blockquote>

        <h3>Your own duties</h3>
        <ul>
          <li>
            You remain responsible for your own professional practice, and for any rules of your profession, employer or
            country that apply to you.
          </li>
          <li>
            In live group and multi-person sessions, make sure everyone taking part has agreed to be recorded.
          </li>
          <li>When someone stops sharing with you, your access to their sessions ends at once.</li>
        </ul>
        <DocNote>
          Clinicians: whether Breathband can be used with clients under health-data rules where you work (for example
          HIPAA or GDPR) is <Tbc>being reviewed with counsel</Tbc>. Until then, use it as a wellness tool only, with no
          health information in it.
        </DocNote>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending",
    body: (
      <p>
        You can stop using Breathband and delete your account at any time. We may suspend or close an account that breaks
        these terms or puts other people or the service at risk; unless the law or safety stops us, we&apos;ll tell you why
        first and give you the chance to download your data.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability and the law",
    body: (
      <p>
        What we are responsible for if something goes wrong, the limits of that responsibility, and which country&apos;s
        law applies to these terms are <Tbc>to be written with counsel before launch</Tbc>. Nothing in these terms takes
        away rights you have by law as a consumer.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        Every version of these terms has a date. When they change in a way that matters, we&apos;ll tell you and ask you to
        agree again before you carry on.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms: write to {CONTACT.support} (<Tbc>{CONTACT.confirm}</Tbc>).
      </p>
    ),
  },
];

export function Terms() {
  return (
    <DocArticle
      eyebrow="Legal"
      title="Terms of use"
      lede="The agreement for using Breathband and BreathCloud, with a section for coaches, clinicians and educators."
      updated="27 November 2026"
      legal
      sections={SECTIONS}
    />
  );
}
