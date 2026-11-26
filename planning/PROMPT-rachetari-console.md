# Prompts: BreathBand console on Rachetari

Two prompts for a Claude Code session opened in `~/Documents/Projects/breathband-console`, plus the feedback block both include.

- **Prompt 1 (day):** lands the v1 pack, drafts the infrastructure cards and seeds "Next up". Stops for your approval.
- **Prompt 2 (night):** works the approved cards unattended, the way `Rachetari/SCOPE.md` "Night mode" describes, with the session acting as the night runner (the runner script isn't built yet).

Before pasting either:

1. Merge `feat/product-redesign` into `main` and cut `develop` from `main` (D-B). The prompts check this and stop if it isn't done.
2. Edit the **Owner approvals** block in Prompt 2. Every infrastructure card trips a stop-and-ask rule (dependencies, schema, auth, CI); a card without a written approval holds at night instead of running.
3. Docker Desktop running.

---

## Shared block: Rachetari feedback

Both prompts include this verbatim.

```text
RACHETARI FEEDBACK (a side job; it must never slow a card down)

This repo is run through Rachetari, the kit in ~/Documents/Projects/Rachetari (SCOPE.md is
its spec). Rachetari is being tested on this repo. Alongside the work, keep a light log of
how Rachetari behaves, so it can be improved in its own sessions. Never edit the Rachetari
repo, never fix the kit here, and never investigate a tool problem beyond what the card needs.

1. Jot as it happens. When something below happens, append ONE line to
   ~/rachetari-scratch/feedback/breathband-console/<YYYY-MM-DD>-raw.md and carry on:
     HH:MM [CATEGORY] <what happened> · where: <command, kit file, rule or template> · cost: <minutes or retries lost> · <card id>
   Categories:
     BLOCK      a rule, command or template stopped work that should have gone through
     BUG        the kit, a command, a template or the shell did something wrong
     UNCLEAR    a rule or template was ambiguous, or two rules contradict each other
     FRICTION   it worked, but cost extra steps, reads or retries
     MISSING    something the work needed that the kit doesn't have
     TOKENS     a step that burned noticeably more context than its value (large reads, repeated reads, re-running checks)
     WIN        something in the kit that clearly saved time or caught a defect (so it's kept)
   When you park a [tool] line in a card (the kit's rule), add the same line here too.
   Don't jot routine work. A line takes seconds; if it would take longer, it isn't a jot.

2. Report on the hour. At the first natural break (a card starting or finishing, a check
   finishing) when 60 minutes or more have passed since the last report, append a report to
   ~/rachetari-scratch/feedback/breathband-console/<YYYY-MM-DD>.md:
     ## HH:MM
     - Tokens since last report: run
         node ~/rachetari-scratch/tools/usage-since.mjs --match breathband-console --minutes <minutes since last report>
       and paste the TOTAL line, plus the biggest session line if one dominates.
     - Cards: <id · status · minutes spent> for each card touched this hour.
     - Counts from the raw log this hour: BLOCK n · BUG n · UNCLEAR n · FRICTION n · MISSING n · TOKENS n · WIN n
     - Top three, each as: <what happened> → <suggested change to Rachetari> (<the Rachetari file it would change: SCOPE.md, kit/setup/SKILL.md, kit/setup/templates/<file>, skills/<area>/..., or "new">)
     - Anything I must decide (one line each), or "none".
   Fifteen lines at most. Five minutes at most. Use only the raw log and what you already
   know; read no Rachetari source to write it. If nothing happened: "## HH:MM · nothing new".

3. At the end of the session or the night, put a five-line summary at the top of that day's
   report: what Rachetari helped with most, what cost the most, total tokens for the
   session (the same script with --since <session start>), and the one change you'd make first.
```

---

## Prompt 1: day, land the pack and draft the infrastructure cards

```text
You're working in breathband-console through Rachetari. Read CLAUDE.md first; its "How work
is done here" rules bind this session.

<paste the RACHETARI FEEDBACK block here>

CONTEXT
- The product brief for v1 is in ~/rachetari-scratch/breathband/v1/: README.md (decisions),
  01-product-spec.md, 02-onboarding-and-tailoring.md, 03-launch-checklist.md,
  04-infrastructure.md, 05-demo-plan.md. It was compiled from breathband-docs and this repo
  on 2026-11-26. Treat it as the spec. It's confidential (patent pending); it stays in this
  private repo.
- breathband-docs and breathband-app are read-only sister repos. Never commit to them.
- Demo: Thursday 10 December (unless README.md says otherwise). Freeze Tuesday 8 December.

PRECONDITIONS (stop and tell me if any fails; don't work around them)
1. `git fetch` then confirm `develop` exists on origin and contains 8f88778 (the product
   redesign). 2. `npm ci && npm run check` passes on develop. 3. `docker info` succeeds.

TASKS, in order
1. Land the pack. Draft a docs card (T-next) whose only files in scope are docs/v1/** and a
   one-line link in docs/PLAN.md. Copy the five v1 files into docs/v1/ unchanged. Ask me to
   approve it, then build it by day as a normal card (draft PR against develop).
2. Draft the infrastructure cards I-01 to I-16 from docs/v1/04-infrastructure.md "Cards, in
   order", one /card each, status draft. For each card:
   - Acceptance criteria are the table's "Done when" made runnable (exact commands).
   - Files in scope as in the table, made exact; tests named for every criterion.
   - "Depends on" names the card ids.
   - "Questions for me" lists every stop-and-ask trigger the card will hit (dependency names,
     schema, auth, CI, agent config), so I can approve them in one pass.
   - No card over about 400 changed lines; split it if needed and say so.
3. Seed "Next up" in BACKLOG.md on develop: the infrastructure cards in dependency order
   first, then the Demo-tier items from docs/v1/03-launch-checklist.md sections D, E, I, J,
   K and U, then the Launch tier. One line per item with its checklist ID. Keep the 32
   existing lines; merge duplicates into the checklist ID that covers them and say which.
4. Draft the first three product cards from 02-onboarding-and-tailoring.md for day work on
   the local adapter (they don't wait for the backend): individual goal questions (D4-D6),
   professional kind and practice steps (E1-E3, which changes lib/domain/types.ts additively:
   flag the contract change), and the band step's browser check and sample mode (D9, D11).
5. Stop. Report: cards drafted (id, title, triggers to approve), anything in the pack that
   contradicts the repo, and the questions only I can answer.

Don't build anything except the docs card in task 1.
```

---

## Prompt 2: night, run the approved cards

```text
Tonight you are the night runner for breathband-console, as Rachetari's SCOPE.md "Night mode"
describes. The runner script doesn't exist yet, so you play its part: you pick cards, start a
fresh builder and a fresh reviewer for each, run the checks and merge. You build nothing
yourself. Read CLAUDE.md and ~/Documents/Projects/Rachetari/SCOPE.md "Night mode" first.

<paste the RACHETARI FEEDBACK block here>

OWNER APPROVALS FOR TONIGHT (edit before pasting; anything not listed still holds)
- Cards tonight, in order: <e.g. T-00xx (I-02), T-00xx (I-03), T-00xx (I-05)>
- Dependencies approved: drizzle-orm, drizzle-kit, pg, @types/pg, hono, @hono/node-server,
  better-auth, zod, tsx, nodemailer, @types/nodemailer, concurrently   <- edit
- Schema: new tables and migrations inside server/db/** for the cards above are approved.
- Auth: Better Auth as configured in docs/v1/04-infrastructure.md is approved (I-06 only).
- package.json: new scripts approved; no changes to existing scripts except "check".
- Not approved tonight: CI config, lint config, agent config (CLAUDE.md, AGENTS.md,
  .claude/**), deleting or changing an existing test, anything in lib/domain/types.ts.
Write each approval that applies into the card's Decisions as "Owner approved 2026-MM-DD: ..."
before its build starts.

SETUP
1. `git fetch`; cut night/<YYYY-MM-DD> from origin/develop. `npm ci`. `docker info`.
2. The queue: the cards listed above whose status is ready and Held by: nobody, in that
   order. Cap: 3 cards (first nights), 90 minutes per card, 6 hours for the night. Stop at
   the usage limit: hold the running card as "usage limit" and write the report.

PER CARD (one at a time)
1. Make a worktree by hand: check out the card's branch, merge night/<date> into it (never
   rebase). Set Held by: to this machine and push the card branch.
2. Builder: start a fresh subagent in that worktree with the card and CLAUDE.md's rules,
   nothing else. It builds, runs the card's checks, commits and pushes the card branch only.
3. Checks, run by you, not the builder: every criterion's check from the card;
   `npm run check`; for infrastructure cards also `npm run infra:up` and the card's database
   checks; then `git diff --stat night/<date>...card/<id>` against Files in scope (CARD.md
   and BACKLOG.md aside). Anything outside scope fails the card.
4. One fix round: if a check fails, send the builder the failure output once. A second
   failure, or a round that changes nothing, holds the card.
5. Reviewer: a second fresh subagent that never saw the build reviews the diff against the
   card and docs/v1/. A blocking finding holds the card; it doesn't loop.
6. Green and unblocked: merge the card branch into night/<date> with --no-ff, re-run
   `npm run check` there, push night/<date>. Held or blocked: leave the branch, write the
   reason under the card's "Questions for me", set Held by: nobody, push, and skip any card
   that depends on it.
7. Small questions: decide them only if reversible, inside Files in scope and not on the
   stop-and-ask list; write them as "decided for the owner" with the alternative.

LIMITS
- Never push to or merge into develop or main. Never force-push.
- Tool problems get a workaround, a [tool] park line and a FEEDBACK jot; never a fix.
- Don't start docker containers other than the repo's compose services; leave none running
  at the end except those (stop dev servers you started).

MORNING REPORT: nights/<YYYY-MM-DD>.md on night/<date>
One row per card: merged, held (the finding) or blocked (the question); each check and its
result; the reviewer's notes; minutes and tokens (from usage-since.mjs). Then every
"decided for the owner" decision. Then `git log --oneline origin/develop..night/<date>` card
by card for me to review and merge. Finish with the FEEDBACK end-of-night summary.
```

---

## Where things land

| What | Where |
| --- | --- |
| Raw feedback jots | `~/rachetari-scratch/feedback/breathband-console/<date>-raw.md` |
| Hourly feedback reports | `~/rachetari-scratch/feedback/breathband-console/<date>.md` |
| Token counts | `node ~/rachetari-scratch/tools/usage-since.mjs --match breathband-console --minutes 60` |
| Night report | `nights/<date>.md` on the `night/<date>` branch |
| Open questions | Each card's "Questions for me" |

The feedback files sit outside the repo on purpose: the night checks compare each diff against the card's files in scope, and feedback edits would fail that.
