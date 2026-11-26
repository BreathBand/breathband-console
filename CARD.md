# T-0109 · feat: onboarding band step: browser check, four routes and sample-data mode

Status: in progress
Branch: card/T-0109 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §3.1 step 9, §2 "No band yet", §6 edge cases; 03-launch-checklist.md D9, D11

## Why

The welcome flow's band step offers only "My Breathband" and the simulator, says little when the browser has no Web Bluetooth, and has nothing for someone without a band. The spec asks for a browser check first, four routes (Bluetooth, phone app, no band yet, simulated) and a clearly labelled sample-data mode.

## Acceptance criteria

- [ ] A1: support detection tells Bluetooth available / not available / insecure context apart, and names the browser problem · check: `npx vitest run src/lib/device/support.test.ts`
- [ ] A2: the route choice (which routes are open, what is recorded, where finishing goes) is unit tested · check: `npx vitest run src/app/cloud/welcome`
- [ ] A3: the chosen route and sample mode are recorded (additive `preferences.onboarding`) and validated by the local adapter · check: `npx vitest run src/lib/backend/local/onboarding-band.test.ts`
- [ ] A4: without Web Bluetooth the band step shows the guidance and the person can still finish; the simulated route and the sample-data route complete onboarding · check: `PORT=3202 npx playwright test e2e/onboarding-band.spec.ts e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts`
- [ ] A5: `npm run check` is green

## Files in scope

- `src/app/cloud/welcome/**` (band step, done step, new `sample/` page, route and sample modules, their tests)
- `src/lib/device/support.ts`, `src/lib/device/support.test.ts` (new)
- `src/lib/domain/types.ts` (additive `UserPreferences.onboarding` only)
- `src/lib/domain/onboarding.ts` (new: band routes and their validation)
- `src/lib/backend/local/index.ts` (validate the new field), `src/lib/backend/local/onboarding-band.test.ts` (new)
- `e2e/onboarding-band.spec.ts` (new); `e2e/onboarding*.spec.ts` only if the band step's buttons change
- `CARD.md`

## Out of scope

- Showing the sample person on Home and a "Set up your band" card there (`src/app/cloud/AthleteHome.tsx`, `home/**`)
- Strap fit → calibrate → first session ritual (D10) and the record page
- Onboarding progress state in the backend (D14) and funnel events (D15)

## Constraints

- No new dependencies. Static export. Screens use only `useBackend()` / `useAuth()` / `useDevice()`.
- `lib/domain/types.ts`: additive only.

## Skills

- none

## Stop and ask

- Anything that needs Home, record or session pages to change.

## Next step

Build the support helper, the route module and the band step; then the sample page and e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract field `onboarding` (chosen band route / sample mode) in src/lib/domain/types.ts; existing tests may change where said which and why; no dependencies.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges cards)

### Evidence

```
```
