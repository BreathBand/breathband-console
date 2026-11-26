# T-0118 · feat: professional terms and clinician wellness acknowledgement, default targets and scope per kind, templates, private-notes hint

Status: in progress <!-- draft | ready | in progress | blocked | done -->
Branch: card/T-0118 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §4.1 steps 6–8, §4.3, §5.2, §7; 03-launch-checklist.md E5, E6, E7, E14

## Why

Professional onboarding (T-0112) stops after "how you refer to people". Professionals never agree to professional terms, clinicians never acknowledge that Breathband is a wellness tool, and nothing records the defaults (targets, scope requested) or shows the practice templates each kind starts with.

## Acceptance criteria

- [ ] A1: Pro onboarding ends with a terms step; professional terms (draft copy, marked draft for counsel) are required for every kind, the spec's wellness acknowledgement for clinicians and the 16+ acknowledgement for educators · check: `npx vitest run src/lib/domain/pro-terms.test.ts` (clinician can't finish without it) and the e2e below
- [ ] A2: The acceptances are stored as consent records (kind, version, time) like T-0103's, appended once, through `updateProfile`; adapter refuses missing, stale, wrong-kind or non-professional ones · check: `npx vitest run src/lib/backend/local/pro-terms.test.ts src/lib/domain/consent.test.ts`
- [ ] A3: Default targets and scope requested per kind (coach Total 7, rate 12–16, 4 a week, scores and curves; clinician 5 a week, scores and curves; educator 3 a week, scores only) are shown in onboarding and stored in `proProfile` · check: `npx vitest run src/lib/domain/pro-defaults.test.ts`
- [ ] A4: Practice templates per kind (§4.1 step 8) as a data module, shown in onboarding · check: `npx vitest run src/lib/domain/pro-templates.test.ts`
- [ ] A5: The private-notes hint ("For practice notes only. Don't record diagnoses or medical history here.") is a shared constant and shown in pro onboarding · check: unit test + e2e
- [ ] A6: The flow works end to end · check: `PORT=3202 npx playwright test e2e/onboarding-pro-terms.spec.ts e2e/onboarding-pro.spec.ts e2e/onboarding.spec.ts`
- [ ] A7: `npm run check` passes

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

Build: domain modules and tests, then the adapter and rules, then the onboarding steps and e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract changes within `proProfile` and consent kinds; existing tests may change where named with the reason; no dependencies; draft legal copy marked as draft.

## Questions for me

## Parked

## Done

- [ ] Every criterion ticked, with the command run and its result pasted below
- [ ] Tests, lint and typecheck run; output below
- [ ] No edits outside "Files in scope" (`git diff --stat` below)
- [ ] Anything not run is marked UNTESTED, never "verified"
- [ ] Draft PR opened: # (not tonight: the lead merges)

### Evidence

```
<commands and results>
```
