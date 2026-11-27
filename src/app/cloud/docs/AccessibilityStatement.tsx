import Link from "next/link";
import { DocArticle, Tbc, type DocSection } from "./DocArticle";
import { CONTACT, HELP_HREF } from "./doc-links";

// DRAFT (planning/v1/03 N9, O1). The "built in" list is what DESIGN.md's
// accessibility section requires of every screen; the gaps are the checklist's
// open O-items. Update both as the audit goes.

const SECTIONS: DocSection[] = [
  {
    id: "aim",
    title: "Our aim",
    body: (
      <p>
        We want everyone to be able to use BreathCloud, including people who use a keyboard, a screen reader,
        magnification or voice control. We are building it to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at
        level AA, and we&apos;re checking it against them before launch.
      </p>
    ),
  },
  {
    id: "built-in",
    title: "What we've built in",
    body: (
      <ul>
        <li>Every page works with a keyboard, and the focus is always visible.</li>
        <li>Form fields have labels, and errors say what went wrong and how to fix it.</li>
        <li>
          Colour is never the only cue: scores come with a word and a mark, and breathing in and out are shown with ▲ and
          ▼ as well as red and blue.
        </li>
        <li>Text and controls meet AA contrast in both the light and dark themes.</li>
        <li>Charts have text descriptions, and trend charts can be shown as a table.</li>
        <li>Controls are large enough to tap easily, and every page fits a phone screen without sideways scrolling.</li>
        <li>If you ask your device to reduce motion, BreathCloud turns its transitions off.</li>
        <li>Paced sessions can use tones, so you can follow the pacer without watching it.</li>
      </ul>
    ),
  },
  {
    id: "gaps",
    title: "Known gaps",
    body: (
      <>
        <p>These parts are being checked, and may not yet work as well as they should:</p>
        <ul>
          <li>
            <strong>Live recording with a screen reader:</strong> whether every change of step (strap check, calibration,
            countdown, the session itself) is announced. Being checked.
          </li>
          <li>
            <strong>The calibration circle and the visual pacer</strong> for people who can&apos;t see them, beyond the
            tones. Being checked.
          </li>
          <li>
            <strong>Live group and two-person sessions:</strong> several moving traces on one screen. Being checked.
          </li>
          <li>
            <strong>Printed progress reports</strong> and their reading order. Being checked.
          </li>
          <li>
            <strong>Pairing the band</strong> uses your browser&apos;s own Bluetooth dialog, which we can&apos;t change.
          </li>
          <li>
            <strong>The band itself</strong> reads breathing from the belly; we&apos;re still learning how it suits
            people with different bodies and abilities, and we&apos;d like to hear from you.
          </li>
        </ul>
        <p>
          We test with automated tools on every page, in both themes, at desktop and phone sizes, and by hand with a
          keyboard. Testing with screen readers is <Tbc>to be completed before launch</Tbc>.
        </p>
      </>
    ),
  },
  {
    id: "compatibility",
    title: "Browsers and devices",
    body: (
      <p>
        BreathCloud works in up-to-date browsers. Recording with the band needs Chrome or Edge on a computer or an Android
        phone, because only those let websites use Bluetooth (see <Link href={`${HELP_HREF}#browsers`}>Help</Link>).
      </p>
    ),
  },
  {
    id: "contact",
    title: "Tell us about a problem",
    body: (
      <p>
        If something in BreathCloud is hard to use, or you need information in another format, write to{" "}
        {CONTACT.accessibility} (<Tbc>{CONTACT.confirm}</Tbc>). Tell us the page and what happened. We aim to reply within{" "}
        <Tbc>five working days</Tbc>.
      </p>
    ),
  },
  {
    id: "about",
    title: "About this statement",
    body: (
      <p>
        This statement was written on 27 November 2026, before launch, from our own assessment. It will be reviewed when
        the checks above are finished, and at least once a year after that.
      </p>
    ),
  },
];

export function AccessibilityStatement() {
  return (
    <DocArticle
      eyebrow="Legal"
      title="Accessibility statement"
      lede="How accessible BreathCloud is, what we know isn't right yet, and how to tell us about a problem."
      updated="27 November 2026"
      legal
      sections={SECTIONS}
    />
  );
}
