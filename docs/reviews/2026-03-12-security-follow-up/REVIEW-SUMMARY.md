# Review Summary — Security Follow-up Working-Tree Review

## Review Metadata

- Branch: `main` (local working tree, uncommitted)
- Base: `main`
- Date: 2026-03-12
- Scope: `src/auth.ts`, `src/app.ts`, `src/claude.ts`, `src/api.ts`, `src/index.ts`, `src/auth.test.ts`, `src/claude.test.ts`, `src/error-middleware.test.ts`, `HANDOFF.md`
- Checks run: `npm test` (outside sandbox) — 75 tests passed, 0 failed

### Prior Phase Risk

> "Any external script or `curl` flow that posts with Basic Auth but without `X-Requested-With: dashboard` will now get a 403 and needs that header added explicitly."

This review accepts that as a rollout risk, not a new code bug. The dashboard
client already sends the header on its POST requests, and the stricter CSRF rule
is internally consistent.

## Findings

### [P2] CLI `--verbose` failure path lost actionable diagnostics

**File:** `src/index.ts`

The original security follow-up made CLI failures generic in all cases. That
also removed the only local operator escape hatch: when running the pipeline
with `--verbose`, fatal failures no longer showed the error message or stack.
For a local CLI, that is a real debugging regression because the output can no
longer distinguish provider/auth failures from parse failures or coding bugs.

**Resolution in this session:** Fixed in-session by adding
`src/utils/cli-error.ts`, wiring `src/index.ts` to keep default output generic
while restoring detailed output when `--verbose` is explicitly set, and adding
`src/cli-error.test.ts`.

## What Was Not Reviewed Or Verified

- Real external Basic Auth POST clients
- Why: None were available locally, so I could not prove whether any deployed
  script or manual `curl` workflow still omits `X-Requested-With: dashboard`.

- Live browser CSRF behavior
- Why: This review used code inspection plus server tests, not a browser-based
  CSRF exercise.

- Production usefulness of the new generic API logs
- Why: The tests confirm behavior and safety, but not whether production support
  detail is still sufficient during real incidents.

## Suggested Fix Order

1. Fixed in-session: restore the CLI `--verbose` diagnostics without changing
   the default generic CLI output.
2. Before deployment, verify whether any external Basic Auth POST clients need
   the `X-Requested-With: dashboard` header added.
3. If rollout docs are being refreshed, update any old POST examples that still
   imply Basic Auth alone is enough.

## Claude Code Fix Prompt

```text
Read HANDOFF.md and docs/reviews/2026-03-12-security-follow-up/REVIEW-SUMMARY.md.
The only review finding from the security follow-up was already fixed locally:
the CLI now keeps default errors generic but restores actionable diagnostics when
run with --verbose. No additional code fixes are required from this review. If
you do follow-up work, keep scope limited to rollout validation: verify whether
any external Basic Auth POST clients still omit X-Requested-With, and update any
stale POST examples if needed. Run the required checks, run a second review of
your own changes after any follow-up edits, and report any remaining risks
before the task is considered complete.
```

## Three Questions

1. **Hardest judgment call in this review?** Deciding whether the new generic
   CLI error output was an intended security hardening or an overcorrection. I
   treated it as an overcorrection because `--verbose` is an explicit local-only
   debugging mode, not a public leak surface.

2. **What did you consider flagging but chose not to, and why?** The more
   generic server logs in `src/api.ts`. They do reduce operational detail, but I
   did not see a concrete correctness failure in the reviewed diff, so I left it
   as a residual supportability risk rather than a blocking code finding.

3. **What might this review have missed?** A real external script, shortcut, or
   bookmarked manual workflow could still rely on Basic Auth alone for POSTs.
   That cannot be proven from local code inspection.
