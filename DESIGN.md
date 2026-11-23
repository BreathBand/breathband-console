# DESIGN.md

This file describes the design system as it exists in the code today. It describes the current design and proposes no changes. Every value is copied from the file named next to it. When the code and this file disagree, the code is right and this file is out of date.

There are two surfaces, and each has its own visual identity:

| Surface | Routes | Identity | Stylesheets |
| --- | --- | --- | --- |
| **Console** (BreathCloud) | `/cloud/...` | "Coach Console": graphite chrome, a cool light ground, white panes divided by rules, one teal action colour, red/blue for inhale/exhale. Light and dark. | `src/app/globals.css` (tokens and base controls), `src/app/cloud/console.css` (signed-in layout), `src/app/cloud/auth.css` (signed-out landing and sign-in screens, `bc-` prefix), `src/app/cloud/join/join.css`, `src/app/cloud/group/group.css`, `src/app/cloud/report/report.css` |
| **Public site** | `/`, `/coaches/` | "Carbon & Breath": warm carbon and bone, where the only colour is the breath (red in, blue out). Dark only, with light bands. | `src/app/(site)/site.css`, where every rule is scoped under `.site` |

How the layers fit together:

1. `src/app/layout.tsx` loads `globals.css` for every route and sets the console fonts (`--font-plex`, `--font-plex-condensed`) on `<html>`.
2. The console tokens (`--c-*`, `--t-*`, `--s-*`, `--r-*`, `--f-*`, `--shadow-float`, `--dur-fast`, `--ease-out`) live on `:root` in `globals.css`. A `@media (prefers-color-scheme: dark)` block overrides them for dark mode.
3. The console stylesheets read those tokens. `console.css` adds one local property, `--topbar-h`. `auth.css` adds `--overlap`. In print, `report.css` overrides the colour tokens.
4. `src/app/(site)/layout.tsx` wraps the public site in `<div class="site">` and sets the site fonts (`--font-display`, `--font-ui`, `--font-mono`) on it. `site.css` defines its own tokens on `.site` with different names, so the site never reads a `--c-*` token.

---

## Colour tokens

### Console: `src/app/globals.css`

Light values are in `:root`. Dark values are in `@media (prefers-color-scheme: dark) { :root { … } }`. A dash means the token keeps its light value in dark mode.

**Chrome (top bar)**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--c-chrome` | `#1d2228` | `#14181c` | Top bar background; tooltip background (`.viz-tip`); landing hero background (`auth.css`) |
| `--c-chrome-2` | `#272d34` | `#1f252b` | Raised items on the chrome: current nav link, athlete picker, chrome buttons |
| `--c-chrome-rule` | `#353c45` | `#2e353d` | Lines and borders on the chrome |
| `--c-chrome-ink` | `#eef0f2` | – | Primary text on the chrome |
| `--c-chrome-ink-2` | `#a6afb9` | – | Secondary text on the chrome |
| `--c-live` | `#4fc387` | – | "Live/synced" dot in the top bar (`.live`) and the accent on the landing page's `.bc-right-place` |

**Surfaces**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--c-ground` | `#eef0f2` | `#0f1215` | Page background (`body`) |
| `--c-pane` | `#ffffff` | `#181c21` | Panes, cards, inputs, ghost buttons |
| `--c-rule` | `#d9dde2` | `#2e353d` | Pane borders, input borders, dividers |
| `--c-rule-soft` | `#e7eaed` | `#242a31` | Table row lines, list dividers, skeleton bars, progress track |
| `--c-well` | `#f5f6f8` | `#1e2329` | Recessed areas: hover rows, chips, plan cards, comment bubbles |

**Ink**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--c-ink` | `#16191d` | `#e9ecef` | Body text |
| `--c-ink-2` | `#5a626c` | `#9ba4ae` | Secondary text, labels, table headers (`.muted`, `.label`) |
| `--c-ink-inverse` | `#ffffff` | `#0f1215` | Text on `--c-ink` fills (selected `.seg` option, `.scale i.hit`) |

**Action and status**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--c-action` | `#0f6e78` | `#47b3bd` | The one action colour: primary `.button`, links, focus outline, current tab underline, progress fill |
| `--c-action-ink` | `#ffffff` | `#061a1c` | Text on `--c-action` |
| `--c-action-tint` | `#e1eff0` | `#12363a` | Selection background, selected picks, own comment bubble, plan badges |
| `--c-action-pressed` | `#0b5860` | `#3a99a2` | `.button:active` |
| `--c-ok` | `#2e8b57` | `#4fc387` | "Good" score band dot and cell, done progress, target line in charts |
| `--c-ok-strong` | `#1f6b43` | `#72d4a1` | Text for success (`.ok-text`, done chip) |
| `--c-ok-tint` | `#e2f1e8` | `#173326` | Done chip background |
| `--c-mid` | `#8a939d` | `#8a939d` | Middle score band; weekend headers in the 14-day grid |
| `--c-low` | `#b7701a` | `#e0a050` | Low score band, flags, out-of-target diamonds (amber, not red) |
| `--c-danger` | `#b3261e` | `#f2817a` | Errors (`.error`), danger button text, delete actions |
| `--c-notice` | `#fdf3e1` | `#3a2a12` | Notice background (`.notice`), behind/missed chips |
| `--c-notice-ink` | `#6b4510` | `#f3d39c` | Text on `--c-notice` |

**Breath**

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--c-in` | `#d0283e` | `#f06478` | Inhale (red): waveform trace, ▲ arrow, kudos |
| `--c-in-tint` | `#fbe7ea` | `#3a1c22` | Inhale fills: active kudos button, live badge |
| `--c-out` | `#1e63d0` | `#6c9ef2` | Exhale (blue): waveform trace, ▼ arrow, "open session" cell |
| `--c-out-tint` | `#e4ecfa` | `#1a2740` | Exhale fills |
| `--c-pacer` | `#8c96a1` | `#7e8893` | Pacer curve in charts |
| `--c-band` | `#f1f3f5` | `#1e2329` | Shaded target band in charts |
| `--c-bar` | `#b7bec6` | `#4a535d` | Bars in bar charts; cancelled progress fill |

**Comparison series** (athletes in comparison charts, in this order). The comment in `globals.css` says red and blue are left out because they mean inhale and exhale.

| Token | Light | Dark |
| --- | --- | --- |
| `--c-series-1` | `#eb6834` | `#d95926` |
| `--c-series-2` | `#1baf7a` | `#199e70` |
| `--c-series-3` | `#6250d6` | `#9085e9` |
| `--c-series-4` | `#eda100` | `#c98500` |
| `--c-series-5` | `#e87ba4` | `#d55181` |
| `--c-series-6` | `#008300` | `#008300` |

`console.css` maps them to `.viz-line.s1`…`.s6` (stroke) and `.viz-mark.s1`…`.s6` (fill). `:root` also sets `color-scheme: light`, and the dark block sets `color-scheme: dark`.

### Console print overrides: `src/app/cloud/report/report.css`

Inside `@media print`, `:root:has(.rp)` sets `color-scheme: light` and these values, so the printed report is always light:

| Token | Print value | Token | Print value |
| --- | --- | --- | --- |
| `--c-ground` | `#ffffff` | `--c-ok` | `#2e8b57` |
| `--c-pane` | `#ffffff` | `--c-ok-strong` | `#1f6b43` |
| `--c-rule` | `#c9ced4` | `--c-ok-tint` | `#e2f1e8` |
| `--c-rule-soft` | `#e2e5e8` | `--c-mid` | `#8a939d` |
| `--c-well` | `#f5f6f8` | `--c-low` | `#b7701a` |
| `--c-ink` | `#16191d` | `--c-notice` | `#fdf3e1` |
| `--c-ink-2` | `#4f5761` | `--c-notice-ink` | `#6b4510` |
| `--c-ink-inverse` | `#ffffff` | `--c-in` | `#d0283e` |
| `--c-action` | `#0f6e78` | `--c-out` | `#1e63d0` |
| `--c-action-ink` | `#ffffff` | `--c-pacer` | `#8c96a1` |
| `--c-action-tint` | `#e1eff0` | `--c-band` | `#eef0f2` |
| | | `--c-bar` | `#9aa3ad` |

### Public site: `src/app/(site)/site.css`

All of these are defined on `.site`. The site is dark only (`color-scheme: dark`). Light bands (`.s-light`) swap to `--light` / `--ink`.

| Token | Value | Role (from the comments and usage in `site.css`) |
| --- | --- | --- |
| `--carbon` | `#121110` | Ground: page background, button text on bone |
| `--carbon-2` | `#191816` | Raised sections (`.s-raised`), waitlist band, hero instrument |
| `--carbon-3` | `#211f1d` | Window bar, selected audience option, score tip |
| `--line` | `#2d2a27` | Section and header borders |
| `--line-2` | `#45413c` | Control borders, outline-button border, link underline |
| `--bone` | `#eeebe4` | Text on carbon; primary button fill |
| `--bone-2` | `#aaa59c` | Secondary text on carbon |
| `--bone-3` | `#77726a` | Non-text marks only (comment in `site.css`) |
| `--light` | `#ebe8e1` | The light band background (`.s-light`) |
| `--light-2` | `#dfdbd2` | Tint behind the Breathband column in the comparison table |
| `--ink` | `#121110` | Text on the light band |
| `--ink-2` | `#57534c` | Secondary text on the light band |
| `--in` | `#e8644f` | Breath in, on carbon: arcs, traces, mark |
| `--out` | `#6f97e0` | Breath out, on carbon; also `::selection` background |
| `--in-text` | `#f08a78` | Breath-in text on carbon |
| `--out-text` | `#95b3ec` | Breath-out text on carbon |
| `--in-ink` | `#b33f2c` | Breath in, on light |
| `--out-ink` | `#2f5bb0` | Breath out, on light |
| `--amber` | `#d99a3a` | Low scores (the header comment says they are "amber, never red"), invalid input border |
| `--focus` | `#b9cdf3` | Focus outline; `.s-light` sets it to `#2f5bb0` |

`src/app/(site)/layout.tsx` sets `themeColor: "#121110"` and `colorScheme: "dark"` in its `viewport` export.

---

## Typography

### Console

**Families**: font loading is in `src/app/layout.tsx` and the stacks are in `src/app/globals.css`.

| Token (`globals.css`) | Stack | Loaded by `layout.tsx` (next/font) | Use |
| --- | --- | --- | --- |
| `--f-sans` | `var(--font-plex), "IBM Plex Sans", system-ui, sans-serif` | `IBM_Plex_Sans`, variable `--font-plex`, weights `"400", "500", "600", "700"` | Reading text, numbers, buttons |
| `--f-cond` | `var(--font-plex-condensed), "IBM Plex Sans Condensed", var(--f-sans)` | `IBM_Plex_Sans_Condensed`, variable `--font-plex-condensed`, weights `"400", "500", "600"` | Labels, metadata, table headers, chart text (`.cond`, `.label`) |
| `--f-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` | not loaded (system fonts) | `code`, invite codes (`.code-input`, `.invite-code .code`) |

`body` sets `font-variant-numeric: tabular-nums` and `-webkit-font-smoothing: antialiased`.

**Size scale** (`globals.css`):

| Token | Value |
| --- | --- |
| `--t-12` | `12px` |
| `--t-13` | `13px` |
| `--t-15` | `15px` |
| `--t-17` | `17px` |
| `--t-20` | `20px` |
| `--t-24` | `24px` |
| `--t-28` | `28px` |
| `--t-40` | `40px` |

**Base text styles** (`globals.css`, `font` shorthand as written):

| Selector | Font | Notes |
| --- | --- | --- |
| `body` | `400 var(--t-15) / 1.45 var(--f-sans)` | |
| `h1` | `600 var(--t-24) / 1.15 var(--f-sans)` | `letter-spacing: -0.01em` |
| `h2` | `600 var(--t-15) / 1.3 var(--f-sans)` | |
| `.label` | `400 var(--t-12) / 1.3 var(--f-cond)` | colour `--c-ink-2` |
| `.pane-h .meta` | `400 var(--t-13) / 1.3 var(--f-cond)` | |
| `.button` | `600 var(--t-15) / 1.15 var(--f-sans)` | `--t-13` when `data-size="small"` |
| `.link` | `500 var(--t-15) / 1.2 var(--f-sans)` | |
| `.field` (label) | `500 var(--t-13) / 1.2 var(--f-cond)` | |
| `.field input/select/textarea` | `400 var(--t-15) / 1.3 var(--f-sans)` | |
| `.seg > *` | `500 var(--t-13) / 1 var(--f-cond)` | |
| `.notice` | `400 var(--t-13) / 1.4 var(--f-cond)` | |
| `.table th` | `400 var(--t-12) / 1.2 var(--f-cond)` | |
| `.table td` | `400 var(--t-15) / 1.2 var(--f-sans)` | `td.sub`: `400 var(--t-13) / 1.2 var(--f-cond)` |

Console-specific sizes outside the scale (`src/app/cloud/console.css`): headline numbers `.hero .n, .stat .n` use `600 36px / 1 var(--f-sans)` with `letter-spacing: -0.02em`. The brand in the top bar is `600 var(--t-17) / 1 var(--f-sans)`. The landing hero `h1` in `src/app/cloud/auth.css` is `600 34px / 1.1 var(--f-sans)`, `var(--t-40)` from 720px and `44px` from 1100px.

### Public site

**Families**: font loading is in `src/app/(site)/layout.tsx` and the stacks are in `src/app/(site)/site.css`. All three are loaded with `display: "swap"`.

| Token (`site.css`) | Stack | Loaded by `(site)/layout.tsx` | Use (layout comment) |
| --- | --- | --- | --- |
| `--display` | `var(--font-display), "Funnel Display", system-ui, sans-serif` | `Funnel_Display`, variable `--font-display`, weights `"300", "400", "500"` | Headlines |
| `--ui` | `var(--font-ui), "Funnel Sans", system-ui, sans-serif` | `Funnel_Sans`, variable `--font-ui`, weights `"400", "500", "600"` | Text |
| `--mono` | `var(--font-mono), "Geist Mono", ui-monospace, monospace` | `Geist_Mono`, variable `--font-mono`, weights `"400", "500"` | Readings only: timers, scores, axes, status |

**Sizes**: the site has no type-scale tokens. Sizes are written per rule, with `clamp()` for display type. The main ones in `site.css`:

| Selector | Font / size | Letter-spacing |
| --- | --- | --- |
| `.site` (base) | `400 17px/1.55 var(--ui)` | |
| `.h-h1` (home hero) | `300 clamp(48px, 7vw, 104px) / 0.96 var(--display)` | `-0.04em` |
| `.c-h1` (coaches hero) | `300 clamp(44px, 6vw, 88px) / 0.98 var(--display)` | `-0.04em` |
| `.s-h2` (section headings) | `300 clamp(36px, 4.4vw, 62px) / 1.02 var(--display)` | `-0.03em` |
| `.c-h2-sm` | `font-size: clamp(32px, 3.4vw, 46px)` | |
| `.s-p` (body paragraphs) | `font-size: clamp(17px, 1.3vw, 19px)`, `line-height: 1.55` | |
| `.h-lede`, `.c-lede` | `font-size: clamp(18px, 1.45vw, 20px)` | |
| `.s-wordmark` | `400 21px/1 var(--display)` (`19px` below 360px) | `-0.02em` |
| `.s-btn` | `600 16px/1.1 var(--ui)` (`.s-btn-sm`: `15px`) | |
| `.s-nav-link` | `500 15px/1 var(--ui)` | |
| `.s-link` | `500 16px/1.2 var(--ui)` | |
| `.h-card-num` (score figure) | `300 clamp(96px, 10vw, 136px) / 0.85 var(--display)` | `-0.05em` |
| `.h-inst-clock b` (timer) | `400 26px/1 var(--mono)` | `-0.02em` |
| `.s-window-bar`, `.h-inst-sub` | `400 12px/1.2 var(--mono)` | |

---

## Spacing and radius

### Console: `src/app/globals.css`

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--s-1` | `4px` | `--s-6` | `20px` |
| `--s-2` | `6px` | `--s-7` | `24px` |
| `--s-3` | `8px` | `--s-8` | `32px` |
| `--s-4` | `12px` | `--s-9` | `48px` |
| `--s-5` | `16px` | | |

| Layout token | Value | Where | Use |
| --- | --- | --- | --- |
| `--page-max` | `1240px` | `globals.css` | `.container` max width; `.bc-wrap` and `.bc-bar-row` in `auth.css` |
| `--rail` | `300px` | `globals.css` | Width of the session rail (`.console` grid in `console.css`) |
| `--topbar-h` | `57px` (`0px` at `max-width: 960px`) | `src/app/cloud/console.css`, on `.app` | Offsets the sticky rail below the sticky top bar |
| `--overlap` | `72px` (`96px` from 1100px) | `src/app/cloud/auth.css`, on `.bc-hero` | How far the hero screenshot overlaps the ground |

Common patterns: `.container` pads `var(--s-7) var(--s-5)`, `.pane-pad` / `.card` pad `var(--s-4) var(--s-5)`, `.stack` and `.row` gap `var(--s-4)`, and `.console-body` pads `var(--s-5) var(--s-7) var(--s-8)`. Controls are `min-height: 44px` (`.button`, `.field input`) or `36px` (`.button[data-size="small"]`, `.seg > *`, `.search`, `.sort select`).

| Radius token (`globals.css`) | Value | Use |
| --- | --- | --- |
| `--r-1` | `4px` | Chips and flags (`.chip`, `.flag`), scrubber |
| `--r-2` | `6px` | Panes, cards, buttons, fields, segmented controls, nav links, bubbles |
| `--r-sheet` | `12px` | Screenshot frames on the landing page (`.bc-shot img` in `auth.css`) |

### Public site: `src/app/(site)/site.css`

| Token | Value | Use |
| --- | --- | --- |
| `--wrap` | `1240px` | Content width (`.s-wrap`: `max-width: calc(var(--wrap) + var(--gutter) * 2)`) |
| `--gutter` | `16px`, `32px` at `min-width: 720px` | Side padding of `.s-wrap` |
| `--radius` | `8px` | Skip link |
| `--radius-lg` | `16px` | Window frame (`.s-window`), waitlist confirmation (`.s-wl-done`) |

There is no spacing scale on the site. Section rhythm is `.s-sec { padding: clamp(80px, 10vw, 144px) 0; }`, and other gaps are pixel values per rule.

---

## Elevation

### Console

From the comment in `globals.css`: "elevation: only what floats". Panes are separated by 1px `--c-rule` borders, not shadows.

| Token (`globals.css`) | Light | Dark |
| --- | --- | --- |
| `--shadow-float` | `0 10px 30px rgba(22, 25, 29, 0.22), 0 1px 3px rgba(22, 25, 29, 0.14)` | `0 10px 30px rgba(0, 0, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4)` |

Used by `.viz-tip` (chart tooltip, `src/app/cloud/console.css`) and `.bc-hero-shot img` (`src/app/cloud/auth.css`).

Inset 1px rings mark a current or selected item instead of a shadow: `.topnav a[aria-current]` uses `inset 0 0 0 1px var(--c-chrome-rule)`, `.rail-list a[aria-current]` uses `inset 0 0 0 1px var(--c-rule)` (both in `console.css`), and `auth.css` and `join.css` use `inset 0 0 0 1px var(--c-action)`.

Stacking in `console.css`: `.topbar` `z-index: 20`, `.viz-tip` `z-index: 3`. The skip link `.bc-skip` in `auth.css` is `z-index: 50`.

### Public site: `src/app/(site)/site.css`

There are no shadow tokens. Shadows are written in place:

| Selector | `box-shadow` |
| --- | --- |
| `.s-phone` (phone frame) | `inset 0 0 0 1px #3a3632, 0 40px 70px -40px rgb(0 0 0 / 0.8)` |
| `.s-window` (console capture frame) | `0 50px 90px -50px rgb(0 0 0 / 0.85)` |
| `.h-inst` (hero instrument) | `0 40px 90px -40px rgb(0 0 0 / 0.8)` |

The sticky header `.s-header` (`z-index: 30`) uses `background: rgb(18 17 16 / 0.86)` with `backdrop-filter: saturate(1.2) blur(14px)`. Under `prefers-reduced-transparency: reduce` it becomes a solid `var(--carbon)`. The skip link `.s-skip` is `z-index: 50`.

### Motion

`globals.css` sets `--dur-fast: 120ms` and `--ease-out: cubic-bezier(0.2, 0, 0, 1)` (used by `.button`), and `@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }`. `site.css` redefines `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` on `.site`, and runs its entrance animations (`h-rise`, `h-fade`, `h-settle`) only under `prefers-reduced-motion: no-preference`. `auth.css` and `group.css` each turn off their animations under `prefers-reduced-motion: reduce`.

---

## Breakpoints

No file defines breakpoint tokens. Each stylesheet writes its own media queries.

| File | Queries |
| --- | --- |
| `src/app/globals.css` | `(prefers-color-scheme: dark)`, `(prefers-reduced-motion: reduce)` |
| `src/app/cloud/console.css` | `max-width: 1280px` (scores and stats reflow), `max-width: 1100px` (dashboard, overview, notes, trends go to one column), `max-width: 960px` (top bar stops sticking, the rail moves below the content), `max-width: 640px` (phone: roster and sessions tables become cards), `print` |
| `src/app/cloud/auth.css` | `min-width: 720px`, `min-width: 900px`, `min-width: 1024px`, `min-width: 1100px`; `max-width: 719px`, `max-width: 479px`, `max-width: 439px`, `max-width: 379px`; `prefers-reduced-motion: reduce` |
| `src/app/cloud/join/join.css` | `max-width: 760px`, `max-width: 960px`, `max-width: 640px` |
| `src/app/cloud/group/group.css` | `max-width: 1100px`, `max-width: 640px`, `prefers-reduced-motion: reduce` |
| `src/app/cloud/report/report.css` | `max-width: 960px`, `max-width: 640px`, `print` (plus `@page report { size: A4 portrait; margin: 14mm 14mm 15mm; }`) |
| `src/app/(site)/site.css` | `min-width: 720px`, `min-width: 760px`, `min-width: 960px`, `min-width: 1024px`; `max-width: 359px`, `max-width: 440px`, `max-width: 600px`, `max-width: 640px`, `max-width: 959px`, `max-width: 1023px`; `(min-width: 1024px) and (max-height: 900px)` (short laptop screens); `(hover: hover) and (pointer: fine)`; `prefers-reduced-transparency: reduce`; `prefers-reduced-motion: no-preference` |

---

## Shared components

### React components: `src/components/`

| Component (file) | What it's for | Props and variants | Styling |
| --- | --- | --- | --- |
| `TrendChart` (`charts.tsx`) | Score per session on the 1–10 scale. The newest point is filled. | `points: TrendPoint[]`, `width`, `height = 128` | `.chart`, `.grid-dash`, `.trend-line`, `.trend-dot`, `.is-last` (`console.css`) |
| `RateBars` (`charts.tsx`) | Breathing rate per open session against the 12–16 br/min band | `points`, `width`, `height = 128` | `.band`, `.band-edge`, `.baseline`, `.bar`, `.bar.is-last` |
| `Sparkline` (`charts.tsx`) | Tiny 1–10 trend for table rows | `values`, `width = 112`, `height = 28`, `label` | `.trend-line thin`, `.trend-dot is-last` |
| `useSvgId` (`charts.tsx`) | Stable id for `url(#…)` references | `prefix` | – |
| `TimeTrend` (`trendCharts.tsx`) | One series at the times it happened, with a target `band` or dashed `line`. Out-of-target points become amber diamonds. Hover crosshair and tooltip. | `points: TimePoint[]`, `t0`, `t1`, `yMin`, `yMax`, `yTicks`, `band?`, `line?`, `width`, `height = 180`, `format`, `ariaLabel` | `.viz`, `.viz-tip`, `.viz-target`, `.viz-band-label`, `.viz-cross`, `.viz-out`, `.viz-empty` |
| `PeriodBars` (`trendCharts.tsx`) | Sessions or minutes per day or week, with an optional target line | `bars: BarDatum[]`, `target?`, `width`, `height = 150`, `unit`, `ariaLabel` | `.bar`, `.viz-hover-col`, `.viz-target` |
| `CompareChart` (`trendCharts.tsx`) | Up to six athletes on one chart, one line each, labelled at the end | `series: CompareSeries[]` (each with `slot` 1–6), `starts`, `yMin`, `yMax`, `yTicks`, `width`, `height = 260`, `format`, `band?`, `periodWord = "Week of"`, `connectGaps = false`, `ariaLabel` | `.viz-line.s1`…`.s6`, `.viz-mark.s1`…`.s6`, `.viz-end`, `.viz-tip-row` |
| `SeriesKey` (`trendCharts.tsx`) | Legend for `CompareChart` | `series` | `.viz-key`. Each slot also gets a marker shape (`circle`, `square`, `triangle`, `diamond`, `down`, `cross`), so identity is not carried by colour alone. |
| `Icon` (`Icon.tsx`) | Decorative line icons on a 24px grid | `name: IconName` (39 names, e.g. `athletes`, `history`, `share`, `chevronLeft`, `check`, `lock`, `plan`, `kudos`, `group`, `compare`, `alert`), `size = 20` | `stroke="currentColor"`, `strokeWidth={1.6}`, `strokeLinecap="square"`, `strokeLinejoin="miter"` |
| `Mark` (`Icon.tsx`) | Placeholder "BB" monogram for the console | `size = 26`, `label = "BreathBand"` | `fill="currentColor"`, second letter at `opacity=".55"` |
| `Measured` (`Measured.tsx`) | Renders `children(width)` once its box is measured, holding `height` until then. Wraps the charts. | `height`, `children: (width) => ReactNode` | – |
| `Progress` (`Progress.tsx`) | Sessions done out of a target, as a bar and a count | `done`, `target`, `status` | `.progress[data-status]` with `done` / `behind` / `missed` / `cancelled` fills |
| `StatusChip` (`Progress.tsx`) | Assignment status as a chip | `status` | `.chip[data-status]` |
| `Score` (`Score.tsx`) | "7 ● Good": number, colour dot and word, so colour is never the only cue | `value`, `compact = false` (word becomes screen-reader only) | `.score`, `.score-n`, `.score-w` |
| `HeadlineScore` (`Score.tsx`) | A session's headline: 1–10 score, legacy %, or breathing rate | `headline` (`kind`: `transition` / `legacy` / rate), `compact` | same |
| `Dot` (`Score.tsx`) | Score band dot | `band` | `.dot[data-band]` (`ok`, `low`, default `--c-mid`) |
| `Arrow`, `DirHead` (`Score.tsx`) | ▲ inhale / ▼ exhale glyph and "Inhale"/"Exhale" header | `dir: "in" \| "out"`, `size = 10`, `suffix?` | inline ``fill={`var(--c-${dir})`}``; `.dir` |
| `TransitionTable` (`Score.tsx`) | Timing, depth (and smoothness) for inhale and exhale | `scores: TransitionScores` | `.table.sc`, `tr.secondary` |
| `ScaleStrip` (`Score.tsx`) | The 10…1 scale with the session's sub-scores highlighted | `hits` | `.scale`, `.scale i.hit`, `.scale-ends` |
| `Skeleton` (`States.tsx`) | Grey placeholder bars while loading | `lines = 3`, `label = "Loading…"` | `.skeleton`; bar widths set inline |
| `EmptyState` (`States.tsx`) | Empty pane with a title | `title`, `children` | `.empty` (dashed `--c-rule` border) |
| `ErrorState` (`States.tsx`) | Load failure, worded for permission errors, with a retry | `error`, `what`, `onRetry?` | `.empty`, ghost small `.button` |

### CSS building blocks: `src/app/globals.css`

| Class | What it's for | Variants |
| --- | --- | --- |
| `.container`, `.stack`, `.row` | Page width and padding, vertical stack, wrapping row | – |
| `.pane`, `.card`, `.pane-pad`, `.pane-h` | White pane with a 1px `--c-rule` border and `--r-2` corners; pane header row | – |
| `.button` | Primary action (teal fill) | `data-variant="ghost"` (pane fill, rule border), `data-variant="danger"` (pane fill, `--c-danger` text), `data-size="small"` (36px), `:disabled` (opacity 0.6) |
| `.link` | Text-style button or link in `--c-action` | `.link.small` in `console.css` |
| `.field` | Label wrapping an input, select or textarea | `.field.grow` in `console.css` |
| `.seg` | Segmented control; `aria-pressed` or `aria-current` marks the selected option (filled `--c-ink`) | – |
| `.table`, `.table-scroll` | Dense data table with 40px rows | `.num` (right-aligned), `td.sub` |
| `.notice`, `.error`, `.muted`, `.label`, `.cond`, `.sr-only`, `.list` | Feedback and text helpers | – |

### Console layout and parts: `src/app/cloud/console.css` and `src/app/cloud/`

| Part | Where | What it's for |
| --- | --- | --- |
| `CloudShell` (`CloudShell.tsx`) | `.app`, `.topbar`, `.topbar-row`, `.brand`, `.topnav`, `.topbar-end`, `.sync`, `.live`, `.who`, `.who-name`, `.chrome-button` | Auth gate plus the graphite top bar. Coaches get Dashboard / Athletes / Compare / Group sessions; athletes get Sessions / Sharing. |
| `AthletePicker` (`AthletePicker.tsx`) | `.picker`, `.avatar` | Athlete switcher in the top bar on athlete pages |
| `SquadFilter` (`SquadFilter.tsx`) | `.squad-filter`, `.label` | Squad select for roster, dashboard and group filters |
| Console grid | `.console`, `.rail`, `.rail-h`, `.rail-list`, `.console-body` | Session rail (`--rail` wide) beside the content |
| Tabs | `.tabs`, `.tab-count` | Athlete workspace tabs; current tab has a 2px `--c-action` underline |
| Status atoms | `.chip` (`data-status`: `done`, `behind`, `missed`, `cancelled`), `.flag`, `.count`, `.new-dot`, `.dot`, `.avatar` (`.lg`, `.sm`) | Small status and identity marks |
| Toolbars | `.toolbar`, `.search`, `.sort`, `.chip-pick` (`[data-on]`) | Filtering and sorting above lists |
| Charts | `.chart` and its classes (`.trace-in`, `.trace-out`, `.pacer`, `.marker`, `.band`, `.bar`, …), `.viz-*` | SVG styling for `src/components/` charts and the session waveform |
| Threads | `.thread`, `.bubble` (`[data-mine]` uses `--c-action-tint`) | Comment threads on a session |
| States | `.skeleton`, `.empty`, `.empty.locked` | Loading, empty and locked panes |

### Signed-out console screens: `src/app/cloud/auth/` and `src/app/cloud/auth.css`

| Component | Classes | What it's for |
| --- | --- | --- |
| `AuthFrame` (`auth/AuthFrame.tsx`) | `.bc-page.bc-auth`, `.bc-skip`, `.bc-bar`, `.bc-auth-body`, `.bc-auth-main`, `.bc-auth-aside` | Frame for sign in, sign up and reset |
| `Brand` (`auth/Brand.tsx`) | `.bc-brand`, `.bc-brand-mark`, `.bc-brand-maker`, `.bc-brand-product` | Signed-out brand lock-up |
| `TextField`, `PasswordField` (`auth/fields.tsx`) | `.field.bc-field`, `.bc-field-head`, `.bc-hint`, `.bc-field-error`, `.bc-password`, `.bc-reveal` | Labelled inputs with hint and error; password show/hide |
| `SubmitButton`, `FormError` (`auth/fields.tsx`) | `.button.bc-submit`, `.bc-spinner`, `.bc-form-error` | Submit with busy state; form-level error |
| `BreathTrace` (`auth/BreathTrace.tsx`) | `.bc-trace-*`, `.bc-key[data-k]`, `.bc-phase[data-phase]` | Animated paced-breathing trace on the auth aside |

### Public site: `src/app/(site)/_components/` and `src/app/(site)/site.css`

| Component | Classes | What it's for |
| --- | --- | --- |
| `Mark` (`ui.tsx`) | `.s-mark` | Placeholder pacer-ring mark: right half `stroke="var(--in)"`, left half `stroke="var(--out)"`, centre `currentColor`; `size = 24` |
| `Wordmark` (`ui.tsx`) | `.s-wordmark` | "Breathband®" in Funnel Display |
| `ArrowRight`, `Check`, `Tri` (`ui.tsx`) | `.s-arrow`, `.s-tri` | Inline glyphs. `Tri` is ▲ for in and ▼ for out (`up`, `size = 10`), the shape cue that goes with the breath colour. |
| `Phone` (`ui.tsx`) | `.s-phone` | App screenshot (780 × 1688) in a phone frame |
| `Window` (`ui.tsx`) | `.s-window`, `.s-window-bar`, `.s-window-dots`, `.s-window-label`, `.s-window-demo` | BreathCloud capture in a window frame labelled "Demo data" |
| `Shot` (`ui.tsx`) | – | Plain `<img>` for pre-sized WebP captures; `priority` loads it eagerly |
| `SiteHeader` (`SiteHeader.tsx`) | `.s-header`, `.s-header-in`, `.s-brand`, `.s-nav`, `.s-nav-link`, `.s-nav-signin`, `.s-header-actions`, `.s-signin`, `.s-btn.s-btn-sm` | Sticky header. Below 1024px the nav becomes a scrolling second row. |
| `WaitlistBand`, `SiteFooter` (`SiteFooter.tsx`) | `.s-band`, `.s-band-in`, `.s-band-p`, `.s-footer`, `.s-footer-in`, `.s-footer-nav`, `.s-footer-note` | Closing waitlist call to action on every page; footer |
| `WaitlistForm` (`WaitlistForm.tsx`) | `.s-wl` (`.s-wl-compact` when `compact`), `.s-aud`, `.s-aud-opt`, `.s-wl-row`, `.s-input`, `.s-btn`, `.s-wl-done`, `.s-wl-error`, `.s-hp` | Waitlist form with the audience picker (athlete, coach, investor or partner) |
| `HeroInstrument` (`home/HeroInstrument.tsx`) | `.h-inst`, `.h-ring*`, `.h-cue*`, `.h-line*`, `.h-legend`, `.h-ctl`, `.h-pace`, `[data-phase]`, `[data-user]` | Live breathing instrument in the home hero; the dot position is set inline (`left`, `top`) |
| `useTones` (`useTones.ts`) | – | Pacer audio: sine tone, `660` Hz high / `440` Hz low, started only after a click |

Site CSS building blocks in `site.css`: buttons `.s-btn` (bone pill, `min-height: 48px`, `border-radius: 999px`), `.s-btn-line` (outline), `.s-btn-sm` (`min-height: 44px`); text links `.s-link` and `.s-link-inline`; sections `.s-sec`, `.s-raised` (`--carbon-2`), `.s-light` (`--light` band); headings `.s-h2` and `.s-p`; status pills `.h-pill` and `.h-pill-on`; score swatches `.h-sq-high` / `-good` / `-mid` / `-low`.

---

## Observations

These are facts about the current code. Nothing here is a request to change it.

### Where the site and the console differ

- **Token sets.** The console uses `--c-*`, `--t-*`, `--s-*`, `--r-*` and `--f-*` from `src/app/globals.css`. The site uses its own unprefixed names on `.site` in `src/app/(site)/site.css` (`--carbon`, `--bone`, `--in`, `--radius`, …). The two sets share no tokens.
- **Fonts.** Console: IBM Plex Sans and IBM Plex Sans Condensed (`src/app/layout.tsx`), with a system monospace stack for `--f-mono`. Site: Funnel Display, Funnel Sans and Geist Mono (`src/app/(site)/layout.tsx`).
- **Base text.** Console `body` is `400 var(--t-15) / 1.45 var(--f-sans)` (15px). Site `.site` is `400 17px/1.55 var(--ui)` (17px).
- **Colour scheme.** The console has light and dark values via `prefers-color-scheme`. The site is dark only (`color-scheme: dark` in `site.css`, `colorScheme: "dark"` in `(site)/layout.tsx`), with light `.s-light` bands. It has no `prefers-color-scheme` query.
- **Breath colours.** Console inhale/exhale are `--c-in` `#d0283e` / `--c-out` `#1e63d0` (light) and `#f06478` / `#6c9ef2` (dark). Site inhale/exhale are `--in` `#e8644f` / `--out` `#6f97e0` on carbon and `--in-ink` `#b33f2c` / `--out-ink` `#2f5bb0` on light.
- **Low-score amber.** Console `--c-low` is `#b7701a` (light) / `#e0a050` (dark). Site `--amber` is `#d99a3a`.
- **Action colour.** The console has one teal action colour (`--c-action`). The site has none: primary buttons are bone (`--bone`) pills with carbon text.
- **Shape.** Console radii are `--r-1` `4px`, `--r-2` `6px`, `--r-sheet` `12px`, and buttons are `--r-2` rectangles with `min-height: 44px`. Site radii are `--radius` `8px` and `--radius-lg` `16px`, plus `999px` pills for buttons, inputs and nav links, and `22px` for `.h-inst` and `.h-card`. The site's primary button is `min-height: 48px`.
- **Focus.** Console: `outline: 2px solid var(--c-action)` (`globals.css`). Site: `outline: 2px solid var(--focus)`, where `--focus` is `#b9cdf3`, or `#2f5bb0` inside `.s-light`.
- **Same name, different value.** `--ease-out` is `cubic-bezier(0.2, 0, 0, 1)` in `globals.css` and `cubic-bezier(0.23, 1, 0.32, 1)` on `.site` in `site.css`. Inside `.site` the site value applies.
- **Same value, separate tokens.** The content width is `1240px` on both surfaces, as `--page-max` (`globals.css`) and `--wrap` (`site.css`). The site gutter (`--gutter`) is `16px`, widening to `32px` at 720px; the console uses `--s-5` (`16px`) for side padding.
- **Shared base stylesheet.** `src/app/layout.tsx` imports `globals.css` for every route, so its element rules (`body`, `h1`, `h2`, `a`, `:focus-visible`, form controls) and its `prefers-reduced-motion: reduce` transition reset also apply inside `.site`. `site.css` restyles those elements with `.site`-scoped rules and classes.
- **Breakpoint style.** For widths, `console.css`, `group.css`, `join.css` and `report.css` use only `max-width` queries (desktop first). `site.css` and `auth.css` mix `min-width` and `max-width` queries.

### Breakpoints that don't line up

- Console layouts collapse at `max-width: 1280px`, `1100px`, `960px` and `640px` (`console.css`). `group.css` uses `1100px` / `640px`, `report.css` uses `960px` / `640px`, and `join.css` adds `760px`.
- `auth.css` uses `min-width` `720px`, `900px`, `1024px`, `1100px` and `max-width` `719px`, `479px`, `439px`, `379px`. Apart from `1100px`, none of these match `console.css`.
- `site.css` uses `min-width` `720px`, `760px`, `960px`, `1024px` and `max-width` `359px`, `440px`, `600px`, `640px`, `959px`, `1023px`.
- The same width means opposite things in different files. `join.css` has `max-width: 760px` and `site.css` has `min-width: 760px`. `console.css` has `max-width: 960px` (960px counts as narrow) and `site.css` has `min-width: 960px` (960px counts as wide).

### Hard-coded values in the console (instead of a token)

| File | Selector | Value |
| --- | --- | --- |
| `src/app/cloud/console.css` | `.picker .avatar` | `background: #3a434d` |
| `src/app/cloud/console.css` | `.viz-tip-out` | `color: #f3c27a` |
| `src/app/cloud/console.css` | `@media print` `body, .console-body` | `background: #fff` |
| `src/app/cloud/console.css` | `.hero .n, .stat .n` | `font: 600 36px / 1 var(--f-sans)` (36px is not on the `--t-*` scale) |
| `src/app/cloud/console.css` | `.chart text` | `font-size: 12px` (same value as `--t-12`) |
| `src/app/cloud/console.css` | `.avatar.sm`; `.cell b` | `font-size: 10px`; `font: 600 10px / 1 var(--f-cond)` |
| `src/app/cloud/console.css` | `.scale i`, `.sw-pacer`, `.skeleton span` | `border-radius: 2px` |
| `src/app/cloud/console.css` | `.progress-bar`, `.cell` | `border-radius: 3px` |
| `src/app/cloud/console.css` | `.count`, `.tab-count` | `border-radius: 10px` |
| `src/app/cloud/console.css` | `.chip-pick` | `border-radius: 18px` |
| `src/app/cloud/console.css` | `.brand`, `.picker`; `.picker`; `.rail-list a` | `gap: 10px`; `padding: 0 12px`; `padding: 9px 10px` (pixel spacing beside the `--s-*` scale) |
| `src/app/cloud/auth.css` | `.bc-hero h1` | `font: 600 34px / 1.1 var(--f-sans)`, `font-size: 44px` from 1100px |
| `src/app/cloud/auth.css` | `.bc-trace-axis` | `font: 600 10px var(--f-cond)` |
| `src/app/cloud/auth.css` | `.bc-tag` | `border-radius: 999px` |
| `src/app/cloud/auth.css` | `.bc-section` | `padding: 72px 0`, `56px 0` below 720px |
| `src/app/cloud/auth.css` | `.bc-form-error` | `background: color-mix(in srgb, var(--c-danger) 7%, var(--c-pane))` (mixed from tokens, not a token itself) |
| `src/app/cloud/group/group.css` | `.live-badge` | `border-radius: 12px` (same value as `--r-sheet`); `color` and `font` set with `!important` |
| `src/app/cloud/group/group.css` | `.timeline`, `.timeline-fill` | `border-radius: 4px` (same value as `--r-1`) |
| `src/app/cloud/report/report.css` | `@media print` `:root:has(.rp) body, .app, .app-main` | `background: #ffffff` |
| `src/app/cloud/report/report.css` | `@media print` text | literal sizes such as `9.5px`, `10.5px`, `11px`, `12.5px`, `22px` |

Control heights (`44px`, `40px`, `36px`) are written as pixel values in `globals.css` and `console.css`; no height tokens exist.

### Print values that differ from the screen tokens

In `src/app/cloud/report/report.css` the print overrides use different values from the light tokens in `globals.css` for five tokens: `--c-rule` `#c9ced4` (screen `#d9dde2`), `--c-rule-soft` `#e2e5e8` (screen `#e7eaed`), `--c-ink-2` `#4f5761` (screen `#5a626c`), `--c-band` `#eef0f2` (screen `#f1f3f5`) and `--c-bar` `#9aa3ad` (screen `#b7bec6`). The print block does not override `--c-chrome*`, `--c-live`, `--c-action-pressed`, `--c-danger`, `--c-in-tint`, `--c-out-tint`, `--c-series-*` or `--shadow-float`.

### Hard-coded values on the site (instead of a token)

`site.css` has no type scale, spacing scale or shadow tokens, so all sizes, gaps and shadows are literal. The colour literals:

| Selector (`src/app/(site)/site.css`) | Value | Note |
| --- | --- | --- |
| `.s-btn:hover` | `background: #fff; border-color: #fff` | |
| `.s-header` | `rgb(18 17 16 / 0.86)` | `--carbon` (`#121110`) at 86% |
| `.h-hero::before` | `rgb(238 235 228 / 0.035)` | `--bone` (`#eeebe4`) at 3.5% |
| `.h-breath`; `.h-inst[data-user="out"] .h-breath` | `rgb(232 100 79 / 0.16)`; `rgb(111 151 224 / 0.16)` | `--in` and `--out` at 16% |
| `.s-light` | `--focus: #2f5bb0` | same value as `--out-ink` |
| `.s-phone`; `.s-phone img` | `#050505`, `#3a3632`; `#f7f8f6` | |
| `.s-window` | `background: #eef0ef` | |
| `.s-input::placeholder` | `#8b867e` | |
| `.s-wl-error` | `color: #f2c27a` | close to the console's `.viz-tip-out` `#f3c27a` |
| `.h-tick`; `.h-tick-maj`; `.h-guide` | `#3a3632`; `#7d776e`; `#4a4540` | |
| `.h-gf`; `.h-gm`; `.h-mid`, `.h-nowline` | `#24221f`; `#302d29`; `#5b564f` | |
| `.h-pc`, `.h-k-pc` | `#948e85` | |
| `.h-pace`, `.h-ctl` | `border: 1px solid #4f4a44` | |
| `.h-compare th, td`, `.h-status-list li` | `#c9c4b9` | |
| `.h-pill` | `border: 1px solid #a9a397` | |

Radii outside `--radius` / `--radius-lg` in `site.css`: `999px` (`.s-btn`, `.s-nav-link`, `.s-input`, `.s-aud-opt span`, `.s-window-demo`, `.h-pace`, `.h-ctl`, `.h-pill`), `44px` / `36px` (`.s-phone` / its image), `22px` (`.h-inst`, `.h-card`), `14px` (`.h-compare-us`), `12px` (`.h-card-tip`), `10px` (`.h-compare td.h-compare-us` below 640px), `3px` (`.h-scale-bar`).

`src/app/(site)/layout.tsx` repeats `--carbon` as `themeColor: "#121110"`.

### Other

- `src/app/cloud/console.css` still has a "sign in" section (`.auth`, `.auth-form`, `.auth-demo`, `.role-pick`), but no `.tsx` file uses those class names. The signed-out screens use the `bc-` classes in `src/app/cloud/auth.css`.
- Two components set colours inline from tokens instead of through a class: `Arrow` in `src/components/Score.tsx` (``fill={`var(--c-${dir})`}``) and `Mark` in `src/app/(site)/_components/ui.tsx` (`stroke="var(--in)"`, `stroke="var(--out)"`).
