# Investor demo: script v2

About 12 minutes, on the laptop, offline. The story is **one product that fits each person who uses it**: two individuals on
different tracks, a new Calm user set up live, a clinician who onboards, invites, assigns and reviews, and a coach.

This follows `planning/v1/05-demo-plan.md` ("Demo script v2") and uses only what the app does today on the **local**
backend (accounts and data live in the browser; no API, no network). Development now defaults to the `http` backend
(`.env.example`), so the demo build names `local` explicitly: see "Before the demo", step 1. Where the plan asks for something the app doesn't do yet, the step says
**not built** with its id in `planning/v1/03-launch-checklist.md`. Skip those parts; don't talk around them.

`e2e/demo-script.spec.ts` walks this script, one test per part. If you change a step here, change the spec in the same
commit, and run it before every rehearsal.

## The people

All are demo accounts on the login page (**Try a demo account**). Every demo password is `breathband`; the buttons sign
in without typing it.

| On screen | Email | Who they are in the demo |
| --- | --- | --- |
| Maya Brooks | `maya@demo.local` | Calm: ten days in a row, Foundations under way, one milestone waiting |
| Alex Morgan | `athlete@demo.local` | Train, coached by Lena: 8 weeks of sessions, the fault sessions |
| Ana Ruiz | `ana@demo.local` | Clinician (physiotherapist, Harbour Physiotherapy): two clients on a between-visits plan |
| Jordan Lee | `jordan@demo.local` | Ana's client: joined through her invite, 3 weeks of her plan |
| Lena Vos | `coach@demo.local` | Coach with five athletes |
| Sam Okafor, Chris Park | `sam@demo.local`, `chris@demo.local` | Seeded (Focus with an exam; an educator with a class of six) but not in the script |

The people you make live (Sofia, Aoife) use any email, a password of at least 8 characters, and a year of birth that
makes them 16 or over.

## Before the demo

On the demo laptop, in this order, the day before and again on the morning.

1. **Build and serve the demo build, on the local backend.** In the repo: `npm ci`, then
   `NEXT_PUBLIC_BACKEND=local npm run build` (in PowerShell: `$env:NEXT_PUBLIC_BACKEND="local"; npm run build`), then
   `npm run preview` (serves `out/` at <http://localhost:3000/>). Name the backend on the command: a value there wins
   over `.env.local`, which now defaults to `http` and would build a console that needs the API. To check, the login
   page must show **Try a demo account**; without it, the build is on `http`. `preview` fetches `serve@14.2.4` through
   npx the first time, so run it once while online. Leave it running.
   *Not built: one command that does all of this, offline (U3).*
2. **Run the e2e against it.** In a second terminal:
   `npx playwright test e2e/demo-script.spec.ts e2e/demo-path.spec.ts e2e/demo-people.spec.ts e2e/smoke.spec.ts`.
   With the preview on port 3000, Playwright uses it, so this tests the build you'll show. All must pass. They run in
   their own browser and don't touch your demo windows.
3. **Clear site data in every demo window,** after the last rehearsal: DevTools → Application → Storage → **Clear site
   data** (or, signed in, **Reset** at the bottom of the sidebar). The demo data is made the first time a browser opens
   the console, and its dates are fixed from then: Maya's streak, Sam's exam date and Jordan's plan go stale in a
   browser that has had it for days, and Maya's milestone shows only once per browser.
4. **Two windows that don't share data.** Window A: your normal Chrome profile. Window B: a second Chrome profile or a
   Guest window (Edge: InPrivate). Two windows of one profile share one sign-in: while Maya is signed in, the second
   window can't sign in as Alex. Open <http://localhost:3000/cloud/login/> in each, so each makes its demo data now.
5. Chrome or Edge, full screen, at the room's resolution (it must work at 1280 wide). Sound on: the pacer plays tones.
6. **Band.** For the live sign-up (part 3), the real band if it's charged and rehearsed on this laptop; otherwise the
   simulated band, which streams exactly the way the band does. *Not verified: the band's Bluetooth profile (the UUIDs
   are assumed, F1) and a rehearsal with it on the demo laptop (U4).*

## 1. The product (1 min)

1. Window A: open <http://localhost:3000/>. "The band that scores your breathing.": a band worn on the belly, follow the
   pacer, a score from 1 to 10.
2. Scroll to "One number, and exactly what's behind it." (the score), then "One band, set up for why you breathe."
   (Train, Focus, Calm: who it's for).
3. Click **try BreathCloud with a demo account** (in the hero). The login page lists the demo people and says every demo
   account's password is `breathband`.

**Say:** one band, one score, and the product sets itself up around why you breathe.

## 2. Same band, different product (1 min)

1. Window A: **Sign in as Maya Brooks**. Window B: **Sign in as Alex Morgan**. Put them side by side.
2. Point at the differences:
   - **Maya (Calm)**: one warm line ("Ten days in a row. Three minutes today keeps it going."), the band card offers
     **Start Open · 3 min**, a **New milestone** ("Seven days in a row"), **Foundations** at 10 of 14 days done, and her
     last session as a breathing rate. No score charts.
   - **Alex (Train)**: dense. The band card offers **Start Paced 5-5 · 5 min**, Lena's practice; the last session's Total Breath Score
     with timing and depth for each breath; the week against his plan; **Total Breath Score, last 8 weeks** with the
     target line; the breathing-rate chart; **From your coach** (Lena's practice and her comment).

**Say:** same band, same scoring underneath; the goal changes what you see, the default session and the tone.

Close window B.

## 3. A new person, live (4 min)

Window A: **Sign out** (bottom of the sidebar), then **Create account** (top right).

1. **Sign-up.** Leave **Athlete** selected. Name "Sofia Reyes", an email, a password, **Year of birth** (the age step:
   16 and over), tick both agreements, **Create account**.
2. **Welcome to Breathband.** → **Continue**.
3. **What brings you to Breathband, Sofia?** → **Calm** → **Continue**.
4. **What would help?** The two Calm questions: **Less stress**, and **Evening** for "When suits you best?" →
   **Continue**.
5. **How much breath training have you done?** → **New to it** → **Continue**.
6. **Your sessions**: set up for Calm (Open, 3 min, silent) → **Continue**.
7. **Your plan**: 7 a week, 3 min a day, a reminder at 18:30 every day → **Continue**.
8. **Your band**: **Simulated band** → **Start the simulated band** (or **Connect my Breathband** → **Connect** with the
   real band). "Simulated band connected. That's your breathing." → **Continue**.
9. **You're ready, Sofia.** The summary ends with "First session: Just breathe · Open · 3 min, after a strap check and
   calibration". → **Start my first session**.
10. **Check the strap**: the gauge reads "Good fit" and the step moves on by itself (with a real band: tighten until the
    marker is in the green, then **It's snug, calibrate**). *Not built: the three strap-fit cards with the gauge (D10).*
11. **Full breaths for 20 seconds**: "Imagine your belly as a balloon." The circle fills to the outer ring on each breath
    in and empties on each breath out. Then **Calibrated**. *Not built: "Good job." after calibration; the screen says
    "Calibrated" (D10).*
12. **Begin**. Calm's first session, Just breathe, is open and 3 minutes (the plan's 2 minutes isn't offered); after
    about 40 seconds press **Stop early**.
13. **The result**: the breathing rate (about 14 br/min), its word ("In the normal range"), one line ("Done for today.
    Nice.") and one tip ("Same again next time."). → **Save session** opens the review.
14. **Home** (sidebar): **Streak 1 day**, Today **0 of 3 min** with the line "Good start. Three more minutes finishes
    today.", the session under **Last session**, and a "First calibration" milestone.

**Say:** a couple of minutes from sign-up to a scored session, guided the whole way.

## 4. A clinician (3 min)

**Sign out**, then **Create account**.

1. **Sign-up.** Select **Coach** ("I coach people who do"), name "Aoife Byrne", an email, a password, a year of birth,
   both agreements → **Create account**.
2. **Welcome to BreathCloud.** → **Continue**.
3. **What kind of work do you do, Aoife?** → **Clinician or therapist** → **Continue**.
4. **Your practice**: **Physiotherapist**, Country "Ireland" → **Continue**.
5. **What will you use it for?** → **Breathing pattern practice between visits** → **Continue**.
6. **How do you refer to the people you work with?** **Clients** is already chosen → **Continue**.
7. **Defaults for the clients you invite** (targets, and what invites ask them to share) → **Continue**.
8. **Practice templates** (Between visits and the clinician's others) → **Continue**.
9. **Professional terms**: tick **I agree to the professional terms.** and the wellness acknowledgement ("Breathband is
   a wellness tool. It doesn't diagnose, treat or monitor any condition. …") → **Continue**.
10. **Try it yourself** → **Skip for now**.
11. **Invite your first client**: Client's name "Sean Murphy", an email, **First practice**: "Between visits · Paced 5-5
    · 5 min · daily for 14 days" → **Create invite link**. The link and its **QR code** appear (a client scans it in
    the room). Say so, but **don't scan it live**: the link points at `localhost` on this laptop, so a phone can't open
    it. Press **Copy link** (step 13 uses it) → **Continue**.
12. **You're set, Aoife.** → **Go to the dashboard**: a **Getting started** checklist for a clinician, and **Sample
    client: Riley**, clearly marked, until a real client joins.
13. **What Sean sees.** **Sign out**, then paste the copied link into the address bar of the **same window** and open
    it. Signed out, the invite says who's asking first: "Aoife Byrne (physiotherapist) would like to see your …" (the
    scope she asked for), her first practice, and **Sign up to accept**. Stop there; don't sign Sean up. It must be
    the same window: on the local backend the invite exists only in this browser's data, so window B or a phone shows
    "This invite isn't available".

Now a clinician three weeks in. Open <http://localhost:3000/cloud/login/> (not **I already have an account** on the
invite, which would accept it) → **Sign in as Jordan Lee** (Ana's client, already joined through her invite):

14. Home leads with **From Ana**: "Ana Ruiz, your clinician", "Ana has set your practice: Paced 5-5 · 5:00 · 14 times",
    10 of 14 done, and her comment. Note the score under **Last session** (6.5 in a fresh seed). The start button reads
    **Start Paced 5-5 · 5 min**: Ana's practice, not Jordan's own Open · 3 min.
15. **Record** (sidebar) → **Use these settings** under "From your clinician": Paced, 5 min (Home's **Start Paced 5-5 ·
    5 min** opens New session already set to it). Don't start it: that's the assigned session.

**Sign out** → **Sign in** → **Sign in as Ana Ruiz**:

16. **Dashboard**: "2 clients"; **Needs a look** (Jordan's comment to answer, and Tom: "N days since the last session",
    about four in a fresh seed). A clinician starts with the missed-days flag only (`src/lib/domain/default-flags.ts`),
    so the screen doesn't say "behind on his plan"; don't promise that flag. Then sessions **To review**; the 14-day
    grid; **Practice due**.
17. **Clients** → **Jordan Lee** → **Plan**: the practice and its adherence: 10 of 14 sessions done, On track, and the
    days that counted.
18. **Sessions** → the newest session: exactly Jordan's numbers (the score on his Home), timing and depth, the curve.
    Under **Comments**, write "Steady again, Jordan. Keep the evenings." → **Comment**.
19. **Clients** → **Jordan Lee** → **Report**: the **Breathing progress report**, prepared by "Ana Ruiz, clinician",
    with **Print or save as PDF**.

**Say:** it's a wellness product; clinicians use it for breathing practice between visits.

*Not built here:* the private-notes hint on a client's **Notes** tab (E14; only the terms step mentions it). Step 13
stops at **Sign up to accept**; Jordan, already joined, stands in for the rest of the invited path (sign-up, accept,
first practice), which `e2e/invited-path.spec.ts` walks.

## 5. A coach (2 min)

**Sign out** → **Sign in** → **Sign in as Lena Vos**.

1. **Dashboard** → **Needs a look**: who needs a look and why (Sam's scores falling and his missed practice, rates out of
   range).
2. **Compare**: five athletes week by week on one chart, and the side-by-side table. **Pick a squad** narrows it
   (Juniors, Sprint squad). *Not built: the plan's squad "Rowing 1st VIII" (U2); the seed has Juniors and Sprint squad.*
3. **Two-person**: **Connect both bands** → **Calibrate both** → **Both calibrated** → **Begin**. One pacer, two people
   in two lanes. After about 40 seconds, **Stop**: **Side by side**, User 1 (steady) scores higher than User 2
   (rushed). **Done**.

## 6. What's next (1 min)

Talk only; nothing on screen. The phone app on the same account (*not built: the app syncing with this console's
backend, T4, V5*); the real backend on Cloud Run (*not in this demo, which runs on the local adapter; the same demo people can be seeded
into the API with `npm run db:seed`, and `npm run e2e:http` runs the demo e2e there; Q5*); the beta.

## Don't open

Settings, **Live group**, Sam and Chris, or anything marked Later. Don't linger where a clinician's client still sees a
coach's words: "· coach" after Ana's name on her comments, and the **From your coach** tab under Sessions (E4). Nothing clinical, no condition, never "patient"; never the calibration percentage or scoring internals.

## If something goes wrong

| What | Do |
| --- | --- |
| The real band won't connect | **Band** → **Simulated band**; same screens. Say so plainly |
| The band drops mid-session | It shows "Reconnecting…"; let it |
| A page shows old dates, or Maya has no milestone | That browser's demo data is old: clear site data (or **Reset**) and sign in again |
| One window can't sign in while the other is | They share a profile: use a Guest window for window B |
| Someone asks about medical use | "It's a wellness product. Clinicians use it for breathing practice between visits; it doesn't diagnose or treat anything." |
| Someone asks how scoring works | Timing and depth against the pacer, against your own calibrated range. Never the percentages |
