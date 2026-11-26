# T-0112 · feat: professional onboarding: kind, practice, use cases and terminology

Status: in progress
Branch: card/T-0112 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §4.1 steps 2–5, §5.2 ("People are called"), §7 (`proKind`, `proProfile`); 03-launch-checklist.md E1, E2, E3, E4

## Why

A professional who signs up sees one name field and lands on the Athletes page: nothing asks what kind of
work they do, where, for what, or what they call the people they work with. The dashboard, invites,
defaults and the coach UI's wording (K5) all need those answers.

## Acceptance criteria

- [ ] A1: `proKind` and `proProfile` are built from the steps' answers per kind and validated (kind, practice fields per kind, use cases per kind, terminology); malformed ones are refused · check: `npx vitest run src/lib/domain/pro-profile.test.ts`
- [ ] A2: the local adapter stores `proKind` / `proProfile` for a professional, reads them back, refuses them for an athlete and refuses malformed ones, keeping what was there · check: `npx vitest run src/lib/backend/local/pro-profile.test.ts`
- [ ] A3: the terminology helper gives the nouns per kind (default) and per override, and falls back to "athletes" for older coach accounts · check: `npx vitest run src/lib/domain/terminology.test.ts`
- [ ] A4: in the browser, a coach and a clinician sign up and complete kind → practice → use cases → terminology, and the answers are stored; individual tracks unchanged · check: `PORT=3202 npx playwright test e2e/onboarding-pro.spec.ts e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts e2e/onboarding-band.spec.ts`
- [ ] A5: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/welcome/**` (professional steps)
- `src/app/cloud/signup/page.tsx` (only if the role choice must route into the pro track)
- `src/lib/domain/types.ts` (additive `proKind`, `proProfile` and the types they use)
- `src/lib/domain/terminology.ts`, `src/lib/domain/terminology.test.ts` (new)
- `src/lib/domain/pro-profile.ts`, `src/lib/domain/pro-profile.test.ts` (new: options, defaults, checks)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` + tests
- `firebase/firestore.rules` (if access changes)
- `e2e/onboarding-pro.spec.ts` (new); existing onboarding e2e only where the flow changes
- `CARD.md`

## Out of scope

- Applying the terminology across the coach UI and emails (K5, lane 3).
- Professional terms and acknowledgements (E5), invite defaults (step 7), templates, first invite (steps 8–10).
- A "how the link was made" field on `CoachLink` (not approved: parked).

## Constraints

- No new dependencies. Static export stays. Screens use `useBackend()` / `useAuth()` only.
- `lib/domain/types.ts`: additive `proKind`, `proProfile` only. Server (`server/**`) is read-only.

## Skills

- none

## Stop and ask

- If storing the answers needs more than `updateProfile` taking two more fields.

## Next step

Build the domain module and terminology helper, then the adapter, then the welcome steps and the e2e.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract fields `proKind`, `proProfile` in src/lib/domain/types.ts (no renames/removals); existing tests may change where named; no dependencies. A "how the link was made" field on CoachLink is not approved (parked).

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead opens PRs)

### Evidence

```
```
