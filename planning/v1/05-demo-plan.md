# Two weeks to the demo

Assumed: an investor demo on **Thursday 10 December 2026** (D-A). Move every date by the same amount if it's different. The docs' own target was "a basic app plus a simple Breathcloud dashboard by the end of November"; the console is already past "simple", so the two weeks go to the story the demo tells: **one product that fits each person who uses it.**

## What the demo has to prove

1. A person with a band gets from sign-up to a scored session in a few minutes, guided the whole way.
2. The product adapts: a Calm user and a Train user see different products from the same band and the same scores.
3. Professionals have a real workspace: a clinician and a coach each onboard, invite, assign and review.
4. It's real software: accounts and data in a real backend (if the backend is green by the freeze; otherwise the local adapter, unchanged on screen).

## The plan

| Day | Date | Product (day cards, local adapter) | Infrastructure (night cards) | You |
| --- | --- | --- | --- | --- |
| Thu | 26 Nov | | | Review this pack; decide D-A to D-G; merge `feat/product-redesign`; cut `develop` |
| Fri | 27 Nov | Draft the onboarding cards from `02` | Night 1: I-02, I-03, I-05 | **Harry 3 pm:** D-H to D-O, logo files, program content, real-band recordings (Christian) |
| Sat–Sun | 28–29 Nov | Individual onboarding: age, goal questions (Train, Focus, Calm), plan, band routes, sample mode | Nights 2–3: I-04, I-06, I-07, I-01 | Morning reviews, merges |
| Mon | 30 Nov | Professional onboarding: kind, practice, use, terminology, terms, defaults, templates | Night 4: I-08, I-12 | |
| Tue | 1 Dec | Tailoring on Home and Results per goal; coaching line per tone | Night 5: I-09 | Usability check: 2 friends through onboarding, no help |
| Wed | 2 Dec | Invite path end to end; first-share sheet; clinician notes hint, progress report | Night 6: I-10 | |
| Thu | 3 Dec | Dashboard checklist per kind; sample person; one program (Foundations) | Night 7: I-13, I-14 | |
| Fri | 4 Dec | Demo seed for the script's people; demo script v2 in `docs/DEMO.md` | Night 8: I-11, I-15 | **Harry 3 pm:** show onboarding and the clinician flow |
| Sat–Mon | 5–7 Dec | Fixes from Harry; e2e for every track; axe on the new screens | Spare night for held cards | **Decide Mon 7 Dec:** demo on `http` or `local` |
| Tue | 8 Dec | **Freeze.** Fixes only | No night run | Full run-through on the demo laptop, real band |
| Wed | 9 Dec | | | Dress rehearsal, timed; reset data; charge two bands |
| Thu | 10 Dec | | | Demo |

Rule for the freeze: after Tue 8 Dec, a change goes in only if it fixes something the script shows, and the demo e2e passes on it.

## The people in the demo

Fictional, seeded, password `breathband`. Reuse the existing demo accounts where they fit.

| Person | Track | Seeded with |
| --- | --- | --- |
| Alex Morgan (`athlete@demo.local`) | Train, coached by Lena | 8 weeks of sessions, the five fault sessions (existing) |
| Sam (`sam@demo.local`) | Focus, exam on 15 Dec | 2 weeks, mood check-ins |
| Maya (new) | Calm | 10 days, a streak, one milestone |
| Lena Vos (`coach@demo.local`) | Coach, squad "Rowing 1st VIII" | Existing roster |
| Ana Ruiz (new) | Clinician, physiotherapist | Two clients on a between-visits plan |
| Jordan Lee (new) | Ana's client, Calm, invited | 3 weeks of plan sessions |
| Chris Park (new) | Educator, school counsellor | A class of 6 (16+) |

## Demo script v2 (about 12 minutes)

1. **The product (1 min).** The site: wear it on your belly, follow the pacer, get a score. "Who it's for": individuals and professionals.
2. **Same band, different product (1 min).** Two windows side by side: Maya (Calm) and Alex (Train). Point at Home, the default session and the coaching line. Same scoring underneath.
3. **A new person, live (4 min).** Sign up as a Calm user: age, goal, two questions, plan, band (real, or simulated if it misbehaves), the three fit cards, the balloon, "Good job", a 2-minute first session, the result with its word and one tip, the streak starting.
4. **A clinician (3 min).** Sign up as a physiotherapist: kind, practice, use ("Breathing practice between visits"), the wellness acknowledgement, defaults, invite by QR. Switch to Jordan (already accepted): the "From Ana" card, the assigned session. Back to Ana: Jordan's adherence, the session with exactly Jordan's numbers, a comment, the progress report.
5. **A coach (2 min).** Lena: who needs a look, squad compare, then the two-person session (User 1 steady, User 2 rushed).
6. **What's next (1 min).** The phone app on the same account; Cloud Run; the beta.

Keep to the script. Don't open Settings, Group live, or anything marked Later.

## What can go wrong, and the fallback

| Risk | Fallback |
| --- | --- |
| Web Bluetooth won't connect on the day | Simulated band, same screens; say so plainly |
| The band disconnects mid-session | It's a feature: show "Reconnecting…" |
| The backend misbehaves | The local adapter build, kept ready as a second container (`NEXT_PUBLIC_BACKEND=local`) |
| No network in the room | Everything runs on the laptop; nothing needs the internet |
| Sound doesn't play through the room | Circle pacer carries it; tones are a bonus |
| Projector resolution | Rehearse at the room's resolution; the console must work at 1280 wide |
| Someone asks about medical use | "It's a wellness product. Clinicians use it for breathing practice between visits; it doesn't diagnose or treat anything." |
| Someone asks how scoring works | Timing and depth against the pacer, against your own calibrated range. Never the percentages (patent) |

## Don't show

- Anything with a clinical label, a condition or the word "patient".
- The calibration percentage, the SD bands, or any scoring internals.
- Screens that are half built, or data that looks fake ("Lorem", round numbers).
