# T-0118 · feat: professional terms and clinician wellness acknowledgement, default targets and scope per kind, templates, private-notes hint

Status: done <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0118 · Held by: nobody
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §4.1 steps 6–8, §4.3, §5.2, §7; 03-launch-checklist.md E5, E6, E7, E14

## Why

Professional onboarding (T-0112) stops after "how you refer to people". Professionals never agree to professional terms, clinicians never acknowledge that Breathband is a wellness tool, and nothing records the defaults (targets, scope requested) or shows the practice templates each kind starts with.

## Acceptance criteria

- [x] A1: Pro onboarding ends with a terms step; professional terms (draft copy, marked draft for counsel) are required for every kind, the spec's wellness acknowledgement for clinicians and the 16+ acknowledgement for educators · check: `npx vitest run src/lib/domain/pro-terms.test.ts` (clinician can't finish without it) and the e2e below
- [x] A2: The acceptances are stored as consent records (kind, version, time) like T-0103's, appended once, through `updateProfile`; adapter refuses missing, stale, wrong-kind or non-professional ones · check: `npx vitest run src/lib/backend/local/pro-terms.test.ts src/lib/domain/consent.test.ts`
- [x] A3: Default targets and scope requested per kind (coach Total 7, rate 12–16, 4 a week, scores and curves; clinician 5 a week, scores and curves; educator 3 a week, scores only) are shown in onboarding and stored in `proProfile` · check: `npx vitest run src/lib/domain/pro-defaults.test.ts`
- [x] A4: Practice templates per kind (§4.1 step 8) as a data module, shown in onboarding · check: `npx vitest run src/lib/domain/pro-templates.test.ts`
- [x] A5: The private-notes hint ("For practice notes only. Don't record diagnoses or medical history here.") is a shared constant and shown in pro onboarding · check: unit test + e2e
- [x] A6: The flow works end to end · check: `PORT=3202 npx playwright test e2e/onboarding-pro-terms.spec.ts e2e/onboarding-pro.spec.ts e2e/onboarding.spec.ts`
- [x] A7: `npm run check` passes

## Files in scope

- `src/app/cloud/welcome/**` (not the "Some pages still say 'athletes'" line in ProSteps.tsx, owned by T-0116)
- `src/lib/domain/consent.ts`, `src/lib/domain/consent.test.ts` (additive kinds and versions)
- `src/lib/domain/pro-profile.ts`, `src/lib/domain/pro-profile.test.ts`
- new `src/lib/domain/pro-terms.ts`, `pro-defaults.ts`, `pro-templates.ts` (+ tests)
- `src/lib/domain/types.ts` (additive, within `proProfile` and consent kinds only)
- `src/lib/backend/types.ts`, `src/lib/backend/local/**` (+ tests), `firebase/firestore.rules`
- new `e2e/onboarding-pro-terms.spec.ts`; `e2e/onboarding-pro.spec.ts` only where the flow changes
- `CARD.md`

## Out of scope

- Default "Needs a look" flags per kind and coach-UI terminology (T-0116)
- Wiring the defaults, scope and templates into the invite and assign-practice screens (coach UI)
- Reviewed legal copy (counsel)

## Constraints

- No new dependencies. Static export. Screens use `useBackend()` / `useAuth()` only.
- `types.ts`, the local adapter, its tests and `firestore.rules` change together.

## Skills

None.

## Stop and ask

- Anything that would touch coach UI pages, `src/app/cloud/home/**`, `src/app/cloud/record/**`, `AthleteHome.tsx`, `package.json`, `server/**`.

## Next step

Lead: review and merge; then answer the NotesTab question below (E14 on the notes editor itself) once T-0116 has merged.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract changes within `proProfile` and consent kinds; existing tests may change where named with the reason; no dependencies; draft legal copy marked as draft.
- 2026-11-26: Contract (additive): `ConsentKind` = `SignUpConsentKind` (the same three) | `ProConsentKind` (`professional-terms`, `wellness-acknowledgement`, `student-age-acknowledgement`); `ProProfile.defaultTargets?: Partial<AthleteTargets>` and `scopeRequested?: ShareScope`, named and shaped like the server's planned `pro_profiles` columns. Both optional, so profiles saved before T-0118 stay valid.
- 2026-11-26: `CONSENT_KINDS` is now an explicit list of sign-up's three kinds. It was `Object.keys(CONSENT_VERSIONS)`, which would have made sign-up require the professional kinds. Sign-up behaves the same.
- 2026-11-26: decided for the owner: the professional terms are recorded through `updateProfile({ proConsents })` in the same write as `proKind`/`proProfile`, appended after sign-up's records, once per kind and version (alternative: a separate `acceptConsents` method, which would also need an `http/routes.ts` entry and wouldn't be atomic). In Firestore it's the same document, so the rule is one `consentsOk` check: sign-up's records unchanged, 1–2 professional records appended, each acknowledgement only for its kind. Rules are UNTESTED (no emulator here).
- 2026-11-26: decided for the owner: the terms step comes last, before Done (kind, practice, uses, people, defaults, templates, terms, done), as the prompt asks (alternative: the spec's order, with terms at step 6 right after people).
- 2026-11-26: decided for the owner: E5 also covers the educator's 16+ acknowledgement ("Only invite students aged 16 or over."), as the checklist row names it (alternative: clinician only).
- 2026-11-26: decided for the owner: on the defaults step, sessions a week (2–7) and the scope requested can be changed; score and rate targets are shown but not edited (alternative: edit every target). The spec doesn't give these template plan details, so I set them: Breath Control Block 5-5, 10 min, 4 a week for 28 days; Between visits 5-5, 5 min, daily for 14 days; Daily slow breathing daily for 7 days; Exam Week 5-5, 3 min, daily for 7 days.
- 2026-11-26: decided for the owner: the private-notes hint shows for every professional kind on the terms step, because the wording suits all three (alternative: clinicians only). It's a shared constant (`PRIVATE_NOTES_HINT` in `src/lib/domain/pro-terms.ts`). It is NOT yet on the notes editor itself; see Questions.
- 2026-11-26: New files: `src/app/cloud/welcome/ProFinishSteps.tsx` (the new steps live outside ProSteps.tsx so they don't touch T-0116's line), `src/lib/domain/pro-terms.ts`, `pro-defaults.ts`, `pro-templates.ts` and their tests, `src/lib/backend/local/pro-terms.test.ts`, `e2e/onboarding-pro-terms.spec.ts`.
- 2026-11-26: Existing test changed: `e2e/onboarding-pro.spec.ts`, because the flow now has three more steps before Done. Each of its three tests goes through them with a new helper `acceptDefaultsAndTerms` (Continue, Continue, tick every box, Continue); its assertions are unchanged. `consent.test.ts` and `pro-profile.test.ts` are unchanged; the new cases live in the new test files.

## Questions for me

- [ ] E14 wants the hint on the private notes themselves (`src/app/cloud/NotesTab.tsx`, a coach-UI file outside this card and next to T-0116's lane). Should `PRIVATE_NOTES_HINT` go under "Only you can see these" there, and should the placeholder "Goals, injuries, what works for them…" change (mentioning injuries invites health detail)? — Recommended: yes, as a one-line follow-up after T-0116 merges. Options: do it in T-0116; leave it in onboarding only.

## Parked

Format: `- YYYY-MM-DD [product|tool|checklist] <what> · seen on T-NNNN · <file or command>`

- 2026-11-26 [product] Invites and "set practice" don't read `proProfile.scopeRequested`, `defaultTargets` or the templates yet (coach UI) · seen on T-0118 · src/lib/domain/pro-defaults.ts, pro-templates.ts
- 2026-11-26 [product] The consent and proProfile checks in `firebase/firestore.rules` have never run against the emulator · seen on T-0118 · firebase/firestore.rules

## Done

- [x] Every criterion ticked, with the command run and its result pasted below
- [x] Tests, lint and typecheck run; output below
- [x] No edits outside "Files in scope" (`git diff --stat` below)
- [x] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
$ npx vitest run src/lib/domain/pro-terms.test.ts src/lib/domain/pro-defaults.test.ts src/lib/domain/pro-templates.test.ts src/lib/domain/consent.test.ts src/lib/domain/pro-profile.test.ts src/lib/backend
 Test Files  19 passed (19)
      Tests  243 passed (243)
  (A1: pro-terms.test.ts "a clinician can't finish without the wellness acknowledgement";
   A2: local/pro-terms.test.ts "appends a clinician's terms and wellness acknowledgement after sign-up's, with versions and the time",
       "refuses a clinician who hasn't given the wellness acknowledgement, and stores nothing", "records each kind once ...";
   A3: pro-defaults.test.ts, per kind; A4: pro-templates.test.ts, per kind; A5: PRIVATE_NOTES_HINT wording)

$ PORT=3202 npx playwright test e2e/onboarding-pro-terms.spec.ts e2e/onboarding-pro.spec.ts e2e/onboarding.spec.ts
  ✓ onboarding.spec.ts › a new athlete is set up by onboarding and their goal sets their sessions
  ✓ onboarding-pro-terms.spec.ts › a clinician: defaults and templates, and no finishing without the wellness acknowledgement
  ✓ onboarding-pro.spec.ts › a coach: sports, level and team, use cases, and athletes by default
  ✓ onboarding-pro-terms.spec.ts › an educator: scores only, 16+ acknowledgement, and changed sessions a week are stored
  ✓ onboarding-pro.spec.ts › a clinician: profession and country, their own use cases, and clients by default
  ✓ onboarding-pro-terms.spec.ts › a coach: the terms alone, and the coach's targets
  ✓ onboarding-pro.spec.ts › an educator who calls people athletes: the override is stored and used
  7 passed (21.6s)

$ npm run check   (lint, typecheck, tests, build) → exit 0
 Test Files  77 passed | 1 skipped (78)
      Tests  920 passed | 1 skipped (921)
 ✓ Compiled successfully; static export built

$ git diff --cached --stat (code commit): 18 files, +1088 −26, all in scope (see Decisions for the new files)

UNTESTED: firebase/firestore.rules (no emulator); before/after screenshots with axe (not taken).
```
