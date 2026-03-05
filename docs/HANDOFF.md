# HANDOFF -- Gig Lead Responder

**Date:** 2026-03-05
**Branch:** `main` (commit 7379fce)
**Phase:** Review complete -- email-parser.ts security review. Ready for Fix-Batched.

## Current State

leads.ts structural split is done. 751-line God Module split into 4 focused modules under `src/db/` with a barrel file. All 8 consumers repointed. `tsc --noEmit` clean. Two commits:

1. `d0cdcb3` — Create `src/db/` modules (migrate, leads, follow-ups, queries, barrel index)
2. `05f762d` — Repoint 8 consumer imports to `src/db/index.js`, delete `src/leads.ts`

### What changed

| File | Lines | Responsibility |
|------|-------|---------------|
| `src/db/migrate.ts` | ~150 | `initDb()`, schema, migrations, indexes |
| `src/db/leads.ts` | ~200 | CRUD, idempotency, venue misses, `runTransaction` (3-layer async guard), `setLeadOutcome` |
| `src/db/follow-ups.ts` | ~190 | 5-state machine, 8 transitions, `completeApproval` |
| `src/db/queries.ts` | ~170 | Dashboard lists, stats, analytics |
| `src/db/index.ts` | ~45 | Barrel re-exports 27 public symbols |

### Key decisions implemented

- `normalizeRow` renamed to `normalizeLeadRow` (cross-module clarity)
- Each module gets its own `stmtCache` + `stmt()` with db-reference guard (stale cache protection)
- `runTransaction` upgraded to three-layer async guard: `NotPromise<T>` type + `util.types.isAsyncFunction` + post-hoc thenable check
- `normalizeLeadRow` exported from `db/leads.ts` but NOT from barrel (two-tier export strategy)
- Each `db/*.ts` file has allowed-imports comment at top
- better-sqlite3 v12.6.2 confirmed (>= v11.10, native async throw — runtime guards are defense-in-depth)

### Verification results

- `npx tsc --noEmit` — zero errors
- `grep -r "from.*\/leads\.js" src/` (outside db/) — zero matches
- `grep -r "gate_passed === 0\|gate_passed === 1" src/` — zero matches
- `grep -r "process.env" src/db/` — only `DATABASE_PATH` in `migrate.ts`

## Previous Sessions

### Cycle 12 fixes (commits 8e09ce5..475bd12)

| Commit | Issue | What changed |
|--------|-------|-------------|
| `8e09ce5` | P1-1 | CSP nonce regex broadened |
| `017c053` | P1-2 | `/logout` changed from GET to POST |
| `69839b5` | P2-3 | Replay protection one-sided check |
| `0fb43f8` | P2-4 | `typeof raw !== "object"` guard |
| `aaa110b` | P2-5 | `listLeadsFiltered` dynamic SQL fix |
| `7e497cb` | P2-6 | `JsonValidator<T>` inlined |
| `841ea4e` | P2-7 | Dead `FollowUpAction*` types deleted |
| `475bd12` | Bonus | Dead re-export + semicolon |

## Key Artifacts

| Phase | Location |
|-------|----------|
| Brainstorm (split) | `docs/brainstorms/2026-03-05-leads-ts-structural-split-brainstorm.md` |
| Plan (split) | `docs/plans/2026-03-05-refactor-leads-ts-structural-split-plan.md` |
| Review (Cycle 10) | `docs/reviews/feat-lead-response-loop/REVIEW-SUMMARY.md` |
| Review (Cycle 11) | `docs/reviews/feat-lead-response-loop-final/REVIEW-SUMMARY.md` |
| Review (Cycle 13) | `docs/reviews/email-parser-security/REVIEW-SUMMARY.md` |
| Solution (Cycle 10) | `docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md` |
| Solution (Cycle 11) | `docs/solutions/architecture/review-fix-cycle-3-security-hardening.md` |
| Solution (Cycle 12) | `docs/solutions/architecture/review-fix-cycle-4-hardening-and-cleanup.md` |

## Deferred Items

**Structural debt:**
- dashboard.html 2,474 lines JS extraction at 3,000 threshold

**Known security gaps (from security-sentinel reviews):**
- verify.ts flagged_concerns injected outside XML delimiters
- follow-up.ts classification fields skip `sanitizeClassification()`
- `compressed_draft` has no independent length limit
- `email-parser.ts` security-reviewed (Cycle 13) — 3 P1s + 5 P2s pending fixes
- `index.html` and `mockup-hybrid.html` not covered by CSP nonce injection (verify if actively served)
- `csrfGuard` Basic Auth bypass path undocumented
- `stmt()` cache stale connection risk mitigated by db-reference guard in each module

## Three Questions

1. **Hardest implementation decision in this session?** Where to place `setLeadOutcome` — it reads with `getLead` and writes with `updateLead`, straddling CRUD and "business logic." Kept it in `db/leads.ts` per the plan because it's fundamentally a CRUD orchestrator, and moving it to queries would create a reverse dependency.

2. **What did you consider changing but left alone, and why?** Considered sharing `stmt()` via a utility module instead of duplicating per-module. Left it duplicated because (a) each module's SQL is disjoint so no wasted cache entries, (b) the codebase has no shared utility files, and (c) 12 lines of duplication is simpler than a new coupling point.

3. **Least confident about going into review?** The `runTransaction` three-layer async guard has never been tested in this codebase. Layer 1 (`NotPromise<T>`) and Layer 2 (`isAsyncFunction`) are straightforward, but Layer 3 (post-hoc thenable check) fires after the transaction commits — it catches the bug loudly but the synchronous portion already ran. Review should verify this is acceptable vs. a silent corruption scenario.

## Prompt for Next Session

```
Read docs/HANDOFF.md. This is Gig Lead Responder on branch main.
Review complete for email-parser.ts security review (Cycle 13).
Run fix-batched phase to address P1s and P2s from
docs/reviews/email-parser-security/REVIEW-SUMMARY.md.

Batch 1 (P1s — fix these first):
  001 - ReDoS in EVENT DATE regex (src/email-parser.ts:105)
        Fix: replace .*? with [^<]* in the regex
  002 - Prompt injection in classify stage (src/pipeline/classify.ts:21)
        Fix: wrap rawText with wrapUntrustedData("lead_email", rawText)
  003 - Unsafe `as string` casts (src/webhook.ts:80-86)
        Fix: use String(body.field ?? "") instead of (body.field as string) || ""

Batch 2 (P2s):
  004 - Empty-string Message-Id logic bug (src/webhook.ts:85)
        Fix: explicit empty-string check, depends on 003
  005 - No input length limits before regex (src/email-parser.ts)
        Fix: slice body-plain and body-html to 200K before regex
  006 - Explicit urlencoded body limit (src/server.ts:42)
        Fix: add limit: "100kb" to express.urlencoded()
  007 - Token URL not validated (src/email-parser.ts:54,111)
        Fix: validate URL scheme + domain after extraction
  008 - DISABLE_MAILGUN_VALIDATION bypass (src/webhook.ts:50-56)
        Fix: require DEV_WEBHOOK_KEY when validation disabled

Relevant files: src/email-parser.ts, src/webhook.ts, src/pipeline/classify.ts,
src/server.ts, src/utils/sanitize.ts.
One commit per fix, ~50-100 lines each. Run tsc --noEmit after each commit.
```
