# DESIGN.md

The Breathband design system: one visual world, **Carbon & Breath**, shared by the public site (`/`, `/coaches/`) and BreathCloud (`/cloud/…`). This file describes what is built. When the code and this file disagree, fix one of them in the same change.

The site and BreathCloud now live in two repos (breathband-site and breathband-console), and each keeps a copy of this file and of the tokens in `src/app/globals.css`. Rows that point at `src/app/(site)/…` describe files in breathband-site. When the shared parts change, change both copies.

It replaces the earlier two-identity setup (a "Coach Console" look for the console, "Carbon & Breath" for the site). Decision 7 in `docs/PLAN.md` allowed the overhaul; this is its result.

---

## The idea

**The only colour is the breath.** Everything is warm carbon and bone; red means breathing in, blue means breathing out, and the two always come with a shape or position cue as well (▲ above the midline, ▼ below, rising or falling). Low scores are amber, never red, because red already means "in".

**When you breathe, the room goes dark.** Reading and reviewing happen on a light bone ground (or dark, by preference). Recording always happens on the dark instrument (`.theme-dark`), full screen, with the pacer and your breath as the only bright things. The athlete's home borrows the same dark card for the last session, so the instrument is the product's signature everywhere.

**Operate surfaces stay familiar.** The console uses standard controls (pill buttons, segmented controls, selects, tables) and a standard sidebar. The world shows through type, palette, density and the breath trace, never through costume.

---

## Where things live

| Layer | File | What |
| --- | --- | --- |
| Tokens and base controls | `src/app/globals.css` | Every `--c-*`, `--t-*`, `--s-*`, `--r-*`, `--f-*` token; light, dark and `.theme-dark`; buttons, fields, segmented control, tables, panes |
| Fonts | `src/app/layout.tsx` | Funnel Display, Funnel Sans, Geist Mono via `next/font` (self-hosted at build), and the pre-paint theme script |
| Console frame | `src/app/cloud/shell.css`, `CloudShell.tsx` | Carbon sidebar, mobile top bar and bottom tab bar |
| Console pages | `src/app/cloud/console.css` | Older dense screens (roster, workspace tabs, review, charts) on the tokens |
| Product screens | `product.css`, `home.css`, `record/record.css`, `session/review.css` | Band page, home, recording instrument, method-C review |
| Signed-out console | `src/app/cloud/auth.css` | Landing, sign in, sign up, reset (`bc-` prefix) on the same tokens |
| Public site | `src/app/(site)/site.css` | Marketing surface, scoped under `.site`, with its own names for the same world (`--carbon`, `--bone`, `--in`, `--out`) |

---

## Colour

Light values on `:root`; dark values under `prefers-color-scheme: dark` (unless the account chose light) and under `:root[data-theme="dark"]` / `.theme-dark`.

### Neutrals

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--c-ground` | `#f2f0eb` | `#121110` | Page background (bone / carbon) |
| `--c-pane` | `#fbfaf8` | `#191816` | Panes, cards, inputs |
| `--c-well` | `#ebe8e1` | `#211f1d` | Recessed areas, segmented-control track, hover rows |
| `--c-rule` | `#dcd8cf` | `#2d2a27` | Pane borders, dividers |
| `--c-rule-soft` | `#e8e5de` | `#242220` | Table rows, list dividers |
| `--c-ink` | `#121110` | `#eeebe4` | Text, primary fills, "good" score dots |
| `--c-ink-2` | `#57534c` | `#aaa59c` | Secondary text, labels (≥ 6:1 on the pane) |
| `--c-ink-3` | `#8f897f` | `#77726a` | Non-text marks: hollow dots, guides, placeholders |
| `--c-ink-inverse` | `#f6f4ef` | `#121110` | Text on ink fills |

### Chrome (the carbon sidebar, in both themes)

`--c-chrome` `#121110` (dark: `#0c0b0a`), `--c-chrome-2` `#1d1b19`, `--c-chrome-3` `#2a2724`, `--c-chrome-rule` `#2d2a27`, `--c-chrome-ink` `#eeebe4`, `--c-chrome-ink-2` `#aaa59c`, `--c-chrome-ink-3` `#77726a`. Breath on carbon uses `--c-chrome-in` `#e8644f` and `--c-chrome-out` `#6f97e0` (the site's `--in` / `--out`). `--c-live` `#6cc596` is the connected dot.

### Action, focus, links

The action colour is ink: `--c-action` is `#121110` on bone (bone `#eeebe4` on carbon), the way the site's primary button is bone on carbon. Links are ink with a 35 % underline that fills on hover. Focus is a 2 px `--c-focus` ring: the exhale blue (`#2f5bb0` light, `#95b3ec` dark). Text selection is the exhale blue.

### Breath

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--c-in` | `#c4442f` | `#e8644f` | Inhale: rising trace, ▲, calibration circle filling, pacer ring breathing in |
| `--c-out` | `#2f5bb0` | `#6f97e0` | Exhale: falling trace, ▼, focus, selection |
| `--c-in-tint`, `--c-out-tint` | `#f6e2dd`, `#e1e8f5` | `#3a201a`, `#1b2539` | Fills behind breath marks; the coach-practice hint |
| `--c-pacer` | `#8f897f` | `#77726a` | The pacer curve (wide, translucent) |
| `--c-band` | `#ebe8e1` | `#211f1d` | The ±3 % target band behind a signal in % of max |

### Status

`--c-ok` (`#2f7a52` / `#6cc596`) is for states only: connected, done, good strap fit. `--c-low` (`#9a5d0c`, text) and `--c-low-mark` (`#d99a3a`, marks) are amber for low scores and warnings. `--c-danger` (`#b3261e` / `#f2817a`) is for errors and destructive actions only. `--c-notice` / `--c-notice-ink` for notices.

### Scores

A score band is graded ink, as on the site, and its word always travels with it (`Score`, `Dot`):

| Band | Scores | Mark |
| --- | --- | --- |
| `ok` | 7–10 (Good, Excellent) | Solid ink dot |
| `mid` | 5–6.9 (Fair) | Hollow ring (`--c-ink-3`) |
| `low` | under 5 (Building, Starting out) | Amber dot (`--c-low-mark`) |

The coach dashboard's 14-day grid uses the same three fills.

### Comparison series

`--c-series-1…6` (unchanged, validated for CVD) are for athletes in comparison charts. Red and blue are left out on purpose. Every series also has a marker shape.

---

## Type

| Token | Family | Use |
| --- | --- | --- |
| `--f-display` | Funnel Display 300–600 | Page titles, headline numbers (scores, rates, stats), instrument words |
| `--f-sans` | Funnel Sans 400–700 | Everything you read: body, labels, buttons, tables |
| `--f-mono` | Geist Mono 400–500 | Live readings only: the session clock, raw sensor values, battery |
| `--f-cond` | = `--f-sans` | Kept for older rules that ask for it |

Scale (`--t-*`): 10, 12, 13, 15 (body), 17, 20, 24, 28, 36, 40, 56, 72 px, plus `clamp()` sizes for the instrument and home titles. Display tracking is −0.02 to −0.05 em, never past −0.05. Labels are 12–13 px Funnel Sans 600 in `--c-ink-2`, sentence case, never tracked capitals. Body is 15 px / 1.5; reading paragraphs (`.page-lede`) are 17 px with a 62 ch measure. Tabular numerals everywhere.

---

## Space, shape, elevation, motion

- **Spacing** `--s-1…9`: 4, 6, 8, 12, 16, 20, 24, 32, 48 px. Pages pad 32 px top, 48 px bottom; panes pad 20 × 24.
- **Radius**: `--r-1` 6 (chips), `--r-2` 10 (fields, nav items, rows), `--r-sheet` 14 (panes, cards), `--r-pill` 999 (buttons, segmented controls). The dark home card and instrument cards are 18.
- **Elevation**: panes are separated by a 1 px rule, not a shadow. Only floating things get `--shadow-float` (tooltips, the sticky start bar on New session).
- **Motion**: `--dur-fast` 140 ms and `--dur-mid` 260 ms on `--ease-out` `cubic-bezier(0.23, 1, 0.32, 1)`. Buttons press to 0.98. The one authored motion is the breath itself: the pacer ring, the calibration circle, the live traces, all driven by the signal, not by CSS timelines. `prefers-reduced-motion` turns transitions off.
- **Controls** are at least 44 px tall (36 px for small buttons; segmented options 32 px inside a 38 px track).

---

## Components

### Shared (`src/components/`)

| Component | What |
| --- | --- |
| `Mark` (`Icon.tsx`) | The pacer-ring mark: right half `--c-in`, left half `--c-out`, breath inside. Shared with the site until the client's logo arrives. |
| `Icon` | 24 px line icons, 1.6 stroke, round caps and joins. Includes `record`, `band`, `bluetooth`, `signal`, `battery`, `volume`, `volumeOff`, `timer`, `sun`, `moon`, `users`. |
| `LiveTrace` | A canvas trace of a live signal, red while rising and blue while falling (direction from a smoothed slope with hysteresis, so noise doesn't flicker). Used in the sidebar, the Band page and the setup panel. |
| `Score`, `Dot`, `Arrow`, `HeadlineScore` | Score number + graded dot + word; ▲/▼ glyphs. |
| `TimeTrend`, `PeriodBars`, `CompareChart`, `TrendChart`, `RateBars` | Charts; targets are dashed `--c-ink-2` lines; out-of-target points are amber diamonds. |
| `Skeleton`, `EmptyState`, `ErrorState` | Loading, empty and error states with retry. |

### Base controls (`globals.css`)

`.button` (ink pill; `data-variant="ghost" | "danger" | "breath"`, `data-size="small" | "large"`), `.link`, `.field` (label above control), `.seg` (pill segmented control; `aria-pressed` or `aria-current` marks the choice, which lifts to a pane-coloured pill), `.pane`, `.card`, `.table`, `.notice`.

### BreathCloud frame (`shell.css`)

- **Sidebar** (≥ 1024 px, 248 px wide, carbon, full height): mark and wordmark; **Start a session** (bone pill with a red record dot, athletes only); navigation (Home, Record, Sessions, Band, Sharing for athletes; Dashboard, Athletes, Compare, Live group, Two-person for coaches); the coach's athlete picker on athlete pages; the band's live status card (name, battery, a live trace, a state dot); the demo-data line with Reset; the account and sign out.
- **Below 1024 px** the sidebar becomes a top bar (mark, avatar) and its navigation docks at the bottom as a tab bar.
- **Full-screen pages** (`/cloud/record/live/`, `/cloud/record/duo/`) render without the frame.

### Product screens

| Screen | Signature |
| --- | --- |
| Home (`AthleteHome.tsx`) | Greeting and Start a session; the last session as a dark card (score at 72–104 px, the first minute of breath over the pacer, timing and depth); four stats; the 8-week score trend; recent sessions; coach practice and comments. First run: three steps and the simulator as a way in. |
| Band (`device/page.tsx`) | Source choice (Bluetooth or simulated) as two cards; the live signal on a dark panel; facts (reading, sampling, battery, calibration); the strap gauge (slack / good / tight, in words and colour); simulated personas. |
| New session (`record/page.tsx`) | Paced or Open as two large cards with glyphs; pacer, length, view, sound and level as segmented controls; the band panel beside; a sticky carbon start bar. |
| Instrument (`record/live/`) | Dark, full screen. Strap check → the calibration circle (a disc that fills to an outer "full" ring and empties to an inner "empty" ring, red in, blue out, five dots) → countdown → circle pacer (ring = pacer, disc = you) with a line strip, or the line view (pacer running ahead of "now"), or open breathing with markers and a live rate → results at 168 px with the breakdown, which way you leaned, and a note. |
| Two-person (`record/duo/`) | Two people's setup cards, joint calibration, two lanes on one timeline, side-by-side results. Identity is by name tag and lane, never colour. |
| Review (`session/`) | Method C: total, inhale/exhale timing and depth with on-target bars, direction in words, the ±1 SD histogram with the on-target band shaded, the ±3 % band on the graph, and every pacer turn. Open: rate, nine Appendix metrics, and the before/between/after table. |

---

## Breakpoints

Use these and no others in new CSS: **1280** (dense grids drop a column), **1100** (two-column pages go to one), **1024** (sidebar ↔ top bar and tab bar), **760 / 640** (phone layouts), **480** (single-column stats). Every route must have no page-level horizontal scroll at 1440, 1024 and 375.

---

## Accessibility

- Contrast: body and labels ≥ 4.5:1 on their ground in both themes; the breath colours carry a shape or position cue, never colour alone.
- Every chart has an `aria-label` and the trend charts a "Show values as a table" toggle; live canvases are labelled images, and the numbers they show are also stated in text.
- Focus is always visible (2 px exhale-blue ring). Touch targets ≥ 44 px.
- axe: 0 serious or critical violations on every route at 1440 and 375.

---

## Known gaps

- The logo is a placeholder (the pacer-ring mark).
- Public-site screenshots (`public/site/`, in breathband-site) and BreathCloud ones (`public/cloud/`) are captured from the demo data and must be retaken when screens change.
- Group-session results are still scored with the earlier per-transition formula (`transition-v1`): method C scores against one pacer, and a group session can switch pacers mid-way.
