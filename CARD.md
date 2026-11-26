# T-0105 · feat: athlete home tailored per goal

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0105 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §5.1 (Home row) and §3.5; 03-launch-checklist.md I2; 01-product-spec.md (Home)

## Why

The athlete's Home looks the same whatever their goal. v1 tailors it: Train is dense (week card
with average rate, depth trend, sessions vs plan), Focus leads with the score, Calm is minimal with
one encouraging line, and someone who came through a professional sees that person's card first.

## Acceptance criteria

- [ ] A1: a pure layout choice per goal: which sections, density and emphasis for Train / Focus / Calm; the professional's card only when linked to one (clinician: always first, no streak; coach: until the first assignment is done) · check: `npx vitest run src/app/cloud/home/`
- [ ] A2: Train's week card numbers (sessions vs plan, average rate, depth trend) and Calm's line are computed and tested · check: same command
- [ ] A3: in the browser, Home differs between Train, Focus and Calm for the demo athlete (goal switched in Settings) · check: `PORT=3203 npx playwright test e2e/home-per-goal.spec.ts`
- [ ] A4: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/AthleteHome.tsx`
- `src/app/cloud/AthleteHome.test.ts`
- `src/app/cloud/home.css`
- `src/app/cloud/home/**` (new)
- `e2e/home-per-goal.spec.ts` (new)
- `CARD.md`

## Out of scope

- Focus's mood change and exam countdown / study-day strip (need J6 and D4–D6 data): seams only.
- Calm's daily ring (J1): seam only.
- Recording the professional's kind (`proKind`) or how a link was made (invite vs athlete's code): lane 2 owns `types.ts`; the card reads whatever link exists.
- Results emphasis per goal (the other half of I2), session defaults, reminders.

## Constraints

- No new dependencies. No edits to `src/lib/domain/types.ts`, `src/lib/backend/**`, signup, welcome, record.
- Data only through `useBackend()` / `useAuth()` (via the workspace).

## Skills

None needed.

## Stop and ask

- Anything that needs a new field on the profile or link.

## Next step

Build the layout module and tests, then wire AthleteHome and the e2e spec.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): no dependencies; existing tests may change only where named here; files limited to the list above.

## Questions for me

One question per line, in this shape; options are separated by `;`.

## Parked

Anything noticed that isn't this card. One line each, no fixing. The merger appends these to `BACKLOG.md` on the integration branch.
Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (the lead opens it)

### Evidence

```
<commands and results>
```
