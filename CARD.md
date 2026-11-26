# T-0103 · feat: account step consents and the 16+ age gate

Status: in progress
Branch: card/T-0103 · Held by: AB_Rouge
Created: 2026-11-26 · Source: planning/v1/02-onboarding-and-tailoring.md §3.1 steps 1–2 and §7 (`consents[]`, `birthYear`); 03-launch-checklist.md D1, D2 (and C8, C9)

## Why

Sign-up today creates an account with no record of what the person agreed to and no age check.
v1 needs versioned consent records (terms, privacy, breathing-data processing) and a 16+ gate
before an account exists, so we never hold an under-16's data.

## Acceptance criteria

- [ ] A1: sign-up stores one consent record per kind (`terms`, `privacy`, `breathing-data`) with version and time on the profile, plus `birthYear` · check: `npx vitest run src/lib/backend/local/consents.test.ts` ("stores the consents and birth year on the profile")
- [ ] A2: an under-16 birth year is refused with a clear message ("Breathband is for people 16 and over for now.") and no account is created · check: same file, "refuses an under-16 birth year"
- [ ] A3: a 16+ birth year is accepted · check: same file, "accepts someone who turns 16 this year"
- [ ] A4: missing or stale consents are refused · check: same file, "refuses sign-up without every consent"
- [ ] A5: in the browser, sign-up needs both checkboxes and a birth year; under-16 sees the message and stays on sign-up; 16+ with consents reaches /cloud/welcome/ · check: `PORT=3202 npx playwright test e2e/signup-consents.spec.ts`
- [ ] A6: everything else still passes · check: `npm run check`

## Files in scope

- `src/app/cloud/signup/page.tsx`
- `src/app/cloud/auth.css` (only if the checkboxes need styles)
- `src/lib/domain/types.ts` (additive `consents`, `birthYear` on `UserProfile`, and the `ConsentRecord` type they use)
- `src/lib/domain/consent.ts` (new: consent kinds, draft versions, age gate rule)
- `src/lib/backend/types.ts`
- `src/lib/backend/local/index.ts`
- `src/lib/backend/local/consents.test.ts` (new)
- `src/lib/backend/local/local.test.ts`, `src/lib/backend/local/preferences.test.ts` (signUp calls only: add the now-required consents and birth year)
- `src/lib/domain/consent.test.ts` (new)
- `firebase/firestore.rules` (users/{uid} create and update)
- `e2e/signup-consents.spec.ts` (new)
- `e2e/onboarding.spec.ts` (sign-up form fill only: tick consents, enter birth year)
- `CARD.md`

## Out of scope

- A separate Age step in /cloud/welcome/ and the "I work with people" / proKind role change (D1's role half).
- Re-consent when a version changes, consent history in Settings, professional terms (E5).
- Real legal copy: the versions and wording here are drafts for counsel.

## Constraints

- No new dependencies. Local adapter only; no server work. Static export stays.
- `lib/domain/types.ts`: additive only.

## Skills

- `quality/deslop` — `/done` runs it on the diff.

## Stop and ask

- If enforcing the gate in the adapter would need a change outside the files above.

## Next step

Build: domain consent module and types, then adapter + tests, then the sign-up form and e2e.

## Decisions

- 2026-11-26: Owner approved 2026-11-26 (overnight note): additive contract fields in `src/lib/domain/types.ts` (`consents`, `birthYear`); existing tests may change where named; draft legal copy allowed if marked draft and logged.

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
