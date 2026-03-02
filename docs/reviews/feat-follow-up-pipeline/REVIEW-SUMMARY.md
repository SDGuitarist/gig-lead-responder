# Review Summary — feat/follow-up-pipeline

**Date:** 2026-02-26
**Branch:** `feat/follow-up-pipeline`
**Commits reviewed:** 4 implementation commits (8eef572, 6c7ef88, 6416313, 25d1aa4)
**Files changed:** 8 TypeScript files (+449 lines)

## Prior Phase Risk

> **Least confident about going into review?** The SKIP handler's idempotency claim: SKIP queries `WHERE follow_up_status IN ('pending', 'sent')` so it can't find already-skipped leads — but there's no explicit guard against a race where Alex sends SKIP twice quickly.

**Resolution:** The Architecture strategist confirmed this is safe. better-sqlite3 is synchronous and single-threaded. Express serializes requests to the same route handler via the event loop. There is no concurrent race condition on SKIP in this architecture. The concern would only matter with an async database driver or multi-process deployment — neither applies here.

## Findings Summary

- **Total Findings:** 11
- **P1 (Critical):** 0 — no merge blockers
- **P2 (Important):** 7 — should fix before deploy
- **P3 (Nice-to-Have):** 4 — type safety improvements

## P2 — Important (Should Fix)

| # | Todo | Description | Effort | Source |
|---|------|-------------|--------|--------|
| 012 | Raw SQL bypasses normalizeRow() | SEND/SKIP handlers use `initDb()` directly, skip `normalizeRow()`, break data layer | Small | TypeScript, Architecture, Simplicity |
| 013 | Transaction inconsistency | Non-terminal SEND path wraps single `updateLead` in `runTransaction()`; terminal path does not. Both are single-statement, neither needs it. | Small | TypeScript, Architecture, Security, Simplicity |
| 014 | Missing server.close() on SIGTERM | Scheduler stops but HTTP server doesn't close — in-flight requests may be dropped | Small | TypeScript |
| 015 | Poison lead infinite retry | No retry limit — corrupt leads retry every 15 min forever, waste API credits | Small | Architecture, Security |
| 016 | Magic number 3 scattered | Max follow-ups (3) is literal in SEND handler, implied by array length in leads.ts | Small | TypeScript |
| 017 | Error message leakage via SMS | Raw `err.message` sent to Alex via SMS — could expose internal paths | Small | Security |
| 018 | Scheduler should reuse existing draft | If SMS fails after draft stored, retry regenerates a new draft (wastes API $) | Small | Performance, Architecture, TypeScript |

## P3 — Nice-to-Have

| # | Todo | Description | Effort | Source |
|---|------|-------------|--------|--------|
| 019 | Untyped JSON.parse | `classification_json` parsed as `any` instead of `Classification` type | Small | TypeScript |
| 020 | computeFollowUpDelay accepts any number | Should narrow to `0 | 1 | 2` | Small | TypeScript |
| 021 | Exhaustive switch in getValueAddInstructions | No `default` case — adding a 4th type would silently return `undefined` | Small | TypeScript |
| 022 | max_tokens too high for follow-ups | `callClaudeText` uses 4096 tokens; follow-ups need ~80. Add optional parameter. | Small | Performance |

## Discarded Findings

| Finding | Reason discarded |
|---------|-----------------|
| "Follow-up not sent to client" | **By design.** Plan explicitly states V1: ALL follow-ups are SMS drafts to Alex. Direct client sends are V2. |
| "No API endpoints for SEND/SKIP" | **V2 scope.** Plan Phase 6 (Dashboard) defers API controls. Agent-native reviewer correctly flagged the parity gap, but the plan made this decision deliberately. |
| "Dashboard has zero follow-up awareness" | **V2 scope.** Plan says "V1: follow_up_status visible in existing leads table via updated shapeLead()." UI rendering is Phase 6. |
| Learnings researcher: "Add atomic claim pattern" | **Not applicable.** Plan deliberately removed `sending` state because human-in-the-loop eliminates the concurrent race. better-sqlite3 is synchronous + single-threaded. |
| Learnings researcher: "Async work inside transactions" | **Already correctly structured.** `completeApproval()` does sync-only DB work inside the transaction. Async work (Claude API, SMS) happens in the scheduler, outside any transaction. |
| "Duplicate 'Outcome tracking types' comment" | **Too minor for a todo.** Trivially fixable during any edit session. |
| "scheduleFollowUp is a one-call-site wrapper" | **Simplicity reviewer said either way is fine.** Net 0 LOC change. Not worth a todo. |
| "Heartbeat log every 15 min is noisy" | **Useful for V1 debugging.** Can reduce later when system is proven stable. |

## Review Agents Used

| Agent | Key Contribution |
|-------|-----------------|
| TypeScript reviewer | Most findings (16 items). Identified normalizeRow bypass, transaction inconsistency, SIGTERM gap, type narrowing opportunities. |
| Security sentinel | Confirmed no SQL injection, validated auth model. Found error message leakage (only actionable finding). |
| Performance oracle | Scheduler doesn't block Express (confirmed), reuse-draft-on-retry saves API dollars, max_tokens optimization. |
| Architecture strategist | Scheduler transaction boundary is the biggest architectural issue. Confirmed state machine completeness. V2 upgrade path is clean. |
| Code simplicity reviewer | Validated that 3-file structure is justified. Only simplification: remove `runTransaction` wrapper. Overall: "well-built code." |
| Agent-native reviewer | Correctly identified SEND/SKIP API gap. Acknowledged as V2 scope per plan, but documented for future. |
| Learnings researcher | Surfaced 5 relevant patterns from docs/solutions/. Most were already applied or not applicable to this architecture. |

## What's Solid

- `completeApproval()` shared function correctly bridges both approval paths
- setTimeout chaining prevents overlap by design
- Composite index `(follow_up_status, follow_up_due_at)` is optimal for the scheduler query
- Per-lead error handling in scheduler — one failure doesn't kill the batch
- LIMIT 10 prevents startup burst after downtime
- FOLLOW_UP_STATUSES const-to-CHECK-constraint pattern ensures type/schema consistency
- Value-add follow-up types (song, testimonial, urgency) are domain-appropriate
- Haiku model choice is cost-appropriate for short messages
- Follow-up prompt tested against all 4 test leads before shipping

## Three Questions

1. **Hardest judgment call in this review?** Whether the "follow-up not sent to client" finding from the TypeScript reviewer was a real bug or by-design behavior. It was flagged as CRITICAL by the reviewer, but the plan explicitly says "V1: ALL follow-ups are SMS drafts to Alex. Direct client sends are V2." Discarding a reviewer's CRITICAL finding requires confidence in the plan — I re-read the plan's V1 Model table, the brainstorm's key decisions, and the deployment order to confirm this was deliberate.

2. **What did you consider flagging but chose not to, and why?** The learnings researcher's recommendation to add the atomic claim pattern back. The plan phase deliberately removed the `sending` state because human-in-the-loop eliminates the concurrent race that the pattern protects against. Adding it back would contradict a carefully reasoned simplification. The architecture strategist confirmed: "better-sqlite3 is synchronous and single-threaded... there is no concurrent race condition." If the system ever moves to multi-process or async DB, revisit.

3. **What might this review have missed?** Production behavior under real email volumes. All review agents analyzed the code statically. The follow-up prompt was tested against 4 mock leads, but none of the reviewers could verify: (a) Does the scheduler actually fire correctly after 24 hours on Railway? (b) Does SEND/SKIP work when multiple leads have active follow-ups simultaneously? (c) Does the SMS message fit within Twilio's 1600-character limit with a long draft? These require integration testing post-deploy, not code review.
