# Investor demo: BreathCloud

A 10-minute walkthrough of Breathband on the web, with no hardware needed. Every number on screen comes from the console's own analysis library (method C for paced sessions, the Appendix metrics for open ones); the simulated band streams exactly the way the real band does.

## Before you start

- Run it: `npm run dev` and open <http://localhost:3000/>, or the container (`docker build -t breathband-console . && docker run -p 8080:8080 breathband-console`, then <http://localhost:8080/>).
- Use Chrome or Edge, full screen, at 1440 px or wider. Turn the sound on: the pacer plays tones.
- Start from clean demo data: sign in, then **Reset** at the bottom of the sidebar.
- With a real band: switch it on, open **Band**, choose **Breathband over Bluetooth** and **Connect your band**. The rest of the script is the same.

## 1. The product in one screen (1 min)

1. Open <http://localhost:3000/>. The site explains the band: wear it on your belly, follow the pacer, get a score from 1 to 10. Scroll to the score card and "Where Breathband is today".
2. Click **try BreathCloud with a demo account**, then **Sign in as Alex Morgan** (athlete).

**Say:** the app and the web share one account; BreathCloud is where you review, train on a computer, and share with a coach.

## 2. Alex's home (1 min)

- The dark card is the last session: the Total Breath Score, the first minute of the actual breath (red in, blue out, over the grey pacer), and timing and depth for the in- and out-breath.
- Below it: this week against the coach's target, the streak, the average, breathing at rest, and the 8-week trend with the target line.
- **From your coach**: practice Lena set (Paced 5-5, 5 minutes, 4 times).

## 3. Record a paced session (3 min)

1. In the sidebar, **Band** → **Simulated band** → **Start the simulated band**. Point out the live signal, the battery, and the strap gauge moving into the green as the strap "tightens".
2. **Start a session**. Tap **Use these settings** on the coach's practice, choose **2 min** to keep it short, and press **Start session**.
3. The room goes dark. The strap check passes by itself, then **Full breaths for 20 seconds** (Harry's rule: once each time the band goes on): the circle fills to the outer ring on each breath in and empties to the inner ring on each breath out, calibrating the band to Alex's range (the Appendix A100 and midline).
4. **Begin**. Follow the circle: the ring is the pacer, the filled disc is Alex. Low note at the bottom of each breath, high at the top. The strip below shows the breath against the pacer, with the next turn coming.
5. At the end: the score (a steady athlete gets about 9), the breakdown, on-target percentages, and which way the breathing leaned. Add a note, **Save session**.

**Show a fault:** before starting, set **Simulated athlete** to **Shallow** or **Rushed** on the New session page. Depth (or timing) drops, and the results say why.

## 4. The review (2 min)

The saved session opens in the review:

- **Total Breath Score** with the change since the last one, timing and depth for in and out, and the share of turns on target.
- **How close you were**: the deviation histogram from −1 to +1 SD, with the on-target band for Alex's level shaded, and what a missed turn costs.
- **Breathing vs pacer** in % of Alex's maximum with the ±3 % band, the per-turn timing and depth strip, zoom from 5 s to the full session, and a scrubber.
- **Each turn of the pacer**: when it came, how far off Alex was, and the points.
- Note, comments with the coach, and **Print or PDF**.

Then open the fault sessions from the last ten days in the list on the left. Each has a note saying what went wrong:

| Days ago | Note | What the review shows |
| --- | --- | --- |
| 3 | "Kept jumping ahead of the pacer…" | Early: timing scores drop and the histogram leans left |
| 5 | "Tired. Only half filled each breath." | Shallow: depth drops, timing holds |
| 6 | "Overdid it with huge breaths…" | Too deep: depth drops the most |
| 8 | "Rushed it…" | Too fast: timing drops and turns are missed |
| 9 | "Band slipped after a minute…" | Lost then recovered: a stretch of missed turns |

And an **Open** session with markers (4 or 10 days ago, "Marked the start and end of the hard set…"): rate, rhythm (in : out), depth, and the before / between / after table, where breathing runs faster between the markers.

## 5. The coach (2 min)

1. Sign out (bottom of the sidebar), then **Sign in as Lena Vos**.
2. **Dashboard**: who needs a look and why, sessions not yet opened, the 14-day grid, practice due.
3. **Athletes** → Alex → **Sessions**: the session recorded in step 3 is there, with exactly the same numbers (open it).
4. **Compare**: five athletes week by week.
5. **Two-person**: **Connect both bands**, **Calibrate both**, **Begin**. One pacer, two people in two lanes; at the end, side-by-side scores (User 1 steady, User 2 rushed).
6. Optional: **Live group** for a squad on one pacer.

## Things to know

- Data lives in the browser (the local adapter). Real accounts, sync with the phone app and storage come with the backend (`docs/PLAN.md`, decisions 1 and 2).
- The Bluetooth protocol follows the Flutter app; the service UUIDs are an assumption, labelled in `src/lib/device/config.ts`.
- Transition timing for open sessions is provisional pending Harm (decision 8 in `docs/PLAN.md`).
