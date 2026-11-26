# T-0112 · feat: professional onboarding: kind, practice, use cases and terminology

Status: done
Branch: card/T-0112 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §4.1 steps 2–5, §5.2 ("People are called"), §7 (`proKind`, `proProfile`); 03-launch-checklist.md E1, E2, E3, E4

## Why

A professional who signs up sees one name field and lands on the Athletes page: nothing asks what kind of
work they do, where, for what, or what they call the people they work with. The dashboard, invites,
defaults and the coach UI's wording (K5) all need those answers.

## Acceptance criteria

- [x] A1: `proKind` and `proProfile` are built from the steps' answers per kind and validated (kind, practice fields per kind, use cases per kind, terminology); malformed ones are refused · check: `npx vitest run src/lib/domain/pro-profile.test.ts`
- [x] A2: the local adapter stores `proKind` / `proProfile` for a professional, reads them back, refuses them for an athlete and refuses malformed ones, keeping what was there · check: `npx vitest run src/lib/backend/local/pro-profile.test.ts`
- [x] A3: the terminology helper gives the nouns per kind (default) and per override, and falls back to "athletes" for older coach accounts · check: `npx vitest run src/lib/domain/terminology.test.ts`
- [x] A4: in the browser, a coach and a clinician sign up and complete kind → practice → use cases → terminology, and the answers are stored; individual tracks unchanged · check: `PORT=3202 npx playwright test e2e/onboarding-pro.spec.ts e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts e2e/onboarding-band.spec.ts`
- [x] A5: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/welcome/**` (professional steps; in the end `page.tsx`, `welcome.css` and the new `ProSteps.tsx`)
- `src/app/cloud/signup/page.tsx` (only if the role choice must route into the pro track; it didn't, untouched)
- `src/lib/domain/types.ts` (additive `proKind`, `proProfile` and the types they use)
- `src/lib/domain/terminology.ts`, `src/lib/domain/terminology.test.ts` (new)
- `src/lib/domain/pro-profile.ts`, `src/lib/domain/pro-profile.test.ts` (new: options, defaults, checks)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` + tests (in the end `local/index.ts` and the new `local/pro-profile.test.ts`)
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

Lead reviews and opens the draft PR; K5 (lane 3) can now read `peopleNouns()` from `src/lib/domain/terminology.ts`.

## Decisions

Appended by the session, one line each, newest last.

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract fields `proKind`, `proProfile` in src/lib/domain/types.ts (no renames/removals); existing tests may change where named; no dependencies. A "how the link was made" field on CoachLink is not approved (parked).
- 2026-11-26: Backend capability changed: `updateProfile` now also takes `proKind` and `proProfile`. Updated together: `lib/backend/types.ts` (signature + doc), the local adapter (`proProblem` check; athletes get `permission-denied`), its new test `local/pro-profile.test.ts`, and `firebase/firestore.rules` (new `proFieldsOk`: role "coach" only, kind in the list, `proProfile.kind == proKind`, terminology in the list; the rest is checked by client and adapter, like consents' versions).
- 2026-11-26: New modules this card creates: `src/lib/domain/pro-profile.ts` (+ test: options, defaults, `cleanProProfile`, `proProblem`, `proSummary`) and `src/app/cloud/welcome/ProSteps.tsx`. No existing test changed; existing onboarding e2e specs untouched (the athlete flow didn't change).
- 2026-11-26: decided for the owner: sign-up untouched: role "Coach" already lands on the welcome flow, which now asks the kind (alternative: relabel sign-up to "For myself / I work with people" now; that's D1's role half, parked by T-0103).
- 2026-11-26: decided for the owner: `proProfile` mirrors `pro_profiles` (`kind`, `organisation`, `profession`, `sports`, `useCases`, `terminology`) plus `sportOther`, `level` (coach) and `country` (clinician), which the spec asks for but the server table lacks (parked). `defaultTargets` / `defaultFlags` / `scopeRequested` (step 7) are left out until that step exists (alternative: store the kind's defaults now).
- 2026-11-26: decided for the owner: an educator's role (teacher, counsellor, coach) is stored in `profession`, the same field as a clinician's profession, as the server has one column (alternative: a separate `role` field).
- 2026-11-26: decided for the owner: required per kind: coach at least one sport and a level; clinician a profession and a country; educator a role; at least one use case; names (team, clinic, school) optional. Country is free text up to 60 characters (alternative: an ISO country list).
- 2026-11-26: decided for the owner: the educator's "student age range" isn't asked (16+ is the only v1 answer); the practice step says "For now, Breathband is for students aged 16 and over." (alternative: store a fixed `16+`).
- 2026-11-26: decided for the owner: terminology defaults by kind (athletes / clients / students, no "patients") and can be any of the three; `peopleNouns()` uses the choice, then the kind's default, then "athletes" (older coach accounts and the demo coach have neither). Copy says "Some pages still say 'athletes' for now" until K5 applies it; the welcome done step already uses it ("Add clients").
- 2026-11-26: decided for the owner: answers are kept per kind while onboarding (going back to change kind loses nothing) and saved once at Finish with the rest, like the individual track (alternative: save after every step, spec principle 7; parked).
- 2026-11-26: Fixed in scope: in `welcome.css`, a pressed chip under the pointer turned black on black (the hover rule outranked the pressed rule); seen on the practice step, affects the goal questions too.

## Questions for me

- [ ] Should the server's `pro_profiles` get `level`, `country` and `sport_other` columns (or a JSON practice column) so it can hold what the web stores? — Recommended: add the three columns with the HTTP backend card. Options: a JSON column; drop level and country from v1.

## Parked

- 2026-11-26 [product] A "how the link was made" field on `CoachLink` (`via: invite | code`), wanted by T-0105's "invited by a professional" card, is not approved · seen on T-0112 · src/lib/domain/types.ts
- 2026-11-26 [product] Server `pro_profiles` has no `level`, `country` or `sport_other`; the HTTP backend must validate `proKind` / `proProfile` with `proProblem` and refuse them for athletes · seen on T-0112 · server/db/schema/people.ts
- 2026-11-26 [product] Coach UI pages and emails still say "athletes"; K5 should use `peopleNouns()` / `countPeople()` from src/lib/domain/terminology.ts · seen on T-0112 · src/app/cloud/athletes
- 2026-11-26 [product] Sign-up still offers Athlete / Coach, not "For myself / I work with people", and the site's "For coaches / clinicians / educators" pages can't preselect the kind (spec §2) · seen on T-0112 · src/app/cloud/signup/page.tsx
- 2026-11-26 [product] Professional answers are saved only at Finish, not after each step (spec §1.7 resumable), and Settings can't edit them · seen on T-0112 · src/app/cloud/welcome/page.tsx
- 2026-11-26 [product] The demo coach (Lena Vos) has no `proKind` / `proProfile` in the seed · seen on T-0112 · src/lib/backend/local/seed.ts
- 2026-11-26 [product] T-0105's `professionalOf()` reads any linked coach as kind "coach"; it could read the professional's `proKind` now, if an athlete may read it · seen on T-0112 · src/app/cloud/home/tailor.ts
- 2026-11-26 [product] The Flutter app must keep `proKind` / `proProfile` when it writes the user document · seen on T-0112 · ../breathband

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead opens PRs)

### Evidence

```
$ npx vitest run src/lib/domain/pro-profile.test.ts src/lib/domain/terminology.test.ts src/lib/backend/local/pro-profile.test.ts
 Test Files  3 passed (3)   Tests  39 passed (39)
 (pro-profile: defaults per kind, complete coach/clinician/educator valid, empty not ready, override allowed,
  proSummary, cleanProProfile, 16 malformed cases refused; terminology: 3 kinds' defaults, fallback to athletes,
  override wins, unknown stored term ignored, nounsFor/countPeople; local adapter: stores and reads back,
  override + change of kind, older coach accounts unchanged, malformed refused and old kept, profile needs kind,
  athlete refused (permission-denied), someone else's profile refused)

$ PORT=3202 npx playwright test e2e/onboarding-pro.spec.ts e2e/onboarding.spec.ts e2e/onboarding-tracks.spec.ts e2e/onboarding-band.spec.ts
  ✓ onboarding-pro.spec.ts › a coach: sports, level and team, use cases, and athletes by default
  ✓ onboarding-pro.spec.ts › a clinician: profession and country, their own use cases, and clients by default
  ✓ onboarding-pro.spec.ts › an educator who calls people athletes: the override is stored and used
  ✓ onboarding.spec.ts › a new athlete is set up by onboarding and their goal sets their sessions
  ✓ onboarding-tracks.spec.ts › Train / Focus / Calm (3 tests)
  ✓ onboarding-band.spec.ts › no Web Bluetooth / simulated band / no band yet (3 tests)
  10 passed (23.3s)   (Playwright's own dev server on 3202, stopped after; port free)
  An earlier run that also included signup-consents.spec.ts and smoke.spec.ts: 14 passed.

$ npm run check   (lint, typecheck, vitest, next build)
 EXIT=0 · Test Files 62 passed (62) · Tests 666 passed (666) · Compiled successfully · /cloud/welcome static

Phone width and dark theme: throwaway script against a dev server on 3202 (stopped after), clinician walk-through
at 375px and 1280px, light and dark: kind, practice, uses, people and done steps all scrollWidth == clientWidth
(no horizontal scroll); screenshots looked at, not committed (found and fixed the black-on-black pressed chip).

$ git diff --stat (vs card start)
 firebase/firestore.rules, src/app/cloud/welcome/{page.tsx,welcome.css}, src/lib/backend/local/index.ts,
 src/lib/backend/types.ts, src/lib/domain/types.ts: 6 files, +143 -11
 new: src/lib/domain/{pro-profile,terminology}.ts (+ tests), src/lib/backend/local/pro-profile.test.ts,
      src/app/cloud/welcome/ProSteps.tsx, e2e/onboarding-pro.spec.ts

UNTESTED: firebase rules (no emulator run); axe not run; other e2e specs (demo-path, home-per-goal) not run.
```
