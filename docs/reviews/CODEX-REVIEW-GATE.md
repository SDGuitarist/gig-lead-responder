# Codex Review Gate — Gig Lead Responder

Use this before merge or before asking Claude Code to fix review findings.

## Read First

- `HANDOFF.md`
- `CLAUDE.md`
- the relevant file in `docs/plans/`
- the matching file in `docs/reviews/` or `docs/solutions/` if the same area was touched before

## Compare Against

- Base branch: `main` unless the user or repo docs say otherwise

## Always Check

- Every new or changed route keeps auth and healthcheck behavior correct.
- Missing env vars cannot silently disable protection in production.
- Any path that sends SMS, mutates lead state, or approves work is guarded against double-submit and partial failure.
- Dashboard changes preserve `/health`, `/`, `/leads`, and any external callback paths that existing systems may hit.
- Pricing, scoring, parsing, and draft-editing changes do not create stale or misleading user-visible output.
- Pre-existing failures or flaky tests are called out explicitly instead of being mixed into new findings.

## Required Checks

- Run `npm test`.
- If `src/server.ts`, auth, env handling, or deploy files changed: inspect route protection and deployment assumptions directly.
- If `src/api.ts`, `src/index.ts`, or pipeline code changed: verify lead state transitions, side effects, and rollback safety.
- If `public/` or dashboard files changed: review auth exposure, stale draft behavior, and destructive actions.

## Findings Priorities

1. Wrong messages, dropped leads, or private-data exposure
2. Broken auth, healthcheck, or production deploy behavior
3. Incorrect pricing, scoring, draft, or analytics behavior
4. Missing tests around state transitions or irreversible actions
