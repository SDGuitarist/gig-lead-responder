---
title: "Follow-Up Pipeline: Automated Lead Nurturing with Human-in-the-Loop"
date: 2026-02-26
category: architecture
tags: [state-machine, scheduler, human-in-the-loop, sms-approval, follow-up, llm-drafting]
component: follow-up-pipeline
severity: feature
symptoms:
  - "Leads that don't reply to initial response are lost"
  - "No automated follow-up mechanism"
  - "Musician must manually track and follow up"
root_cause: "System had no post-response lifecycle — status=done was terminal"
resolution: "Added 4-state follow-up pipeline with AI drafting, SMS approval, and setTimeout scheduler"
prevention:
  - "Design features with full lifecycle in mind (what happens after the happy path?)"
  - "Use human-in-the-loop as V1 safety net, graduate to automation when trust is established"
  - "Separate concerns: follow-up lifecycle != lead response lifecycle (distinct status field)"
  - "Explicit retry limits and poison lead tracking prevent infinite loops"
  - "Kill switch (DISABLE_FOLLOW_UPS) decouples deployment from scheduler availability"
related_solutions:
  - "docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md"
  - "docs/solutions/architecture/hybrid-llm-deterministic-computation.md"
  - "docs/solutions/logic-errors/constants-at-the-boundary.md"
  - "docs/solutions/logic-errors/required-nullable-vs-optional-types.md"
  - "docs/solutions/architecture/silent-failure-escape-hatches.md"
pr: "#8"
branch: "feat/follow-up-pipeline"
files_changed: 8
lines_added: 449
review_findings: 11
---

# Follow-Up Pipeline: Automated Lead Nurturing with Human-in-the-Loop

## Prior Phase Risk

> **Least confident about going into the next batch or compound phase?** Whether "skipped" is the right status for poison leads that hit the retry limit. It conflates user-initiated skips (Alex texted SKIP) with system-initiated skips (3 failures). In V1 this is fine since Alex gets an SMS explaining the reason, but if V2 adds analytics on skip reasons, we'd need to distinguish them.

This compound doc accepts the risk. The conflation is documented in the V2 Considerations section below. If analytics are added, a `skip_reason` column can be added without changing the state machine.

## Problem

Leads that don't reply to the initial gig response go cold. There was no automated way to follow up — every re-engagement attempt required manual effort, which meant most non-responding leads were simply lost. The system's pipeline ended at `status = "done"` with no post-response lifecycle.

## Investigation

The brainstorm phase explored several approaches:
- **Fully automated follow-ups** (no human approval) — rejected because bad follow-ups damage reputation in a personal-service business.
- **Email-based reply detection** — deferred to V2 due to parsing complexity and need for real email samples.
- **Complex state machines with `sending` and `failed` states** — rejected because the architecture (better-sqlite3 synchronous + single-threaded, human-in-the-loop approval) eliminates the concurrency races those states protect against.

The key insight: human-in-the-loop design eliminates entire categories of failure modes, allowing a simpler state machine.

## Root Cause

No follow-up infrastructure existed. `status = "done"` was terminal — no state tracking for follow-up lifecycle, no scheduling mechanism, no AI drafting, and no SMS approval flow for subsequent contacts.

## Solution

A 4-state, 6-transition state machine with setTimeout-chaining scheduler and SMS approval flow.

**State machine:**

| From | To | Trigger |
|------|-----|---------|
| NULL | pending | `completeApproval()` — after initial response approved |
| pending | sent | Scheduler generates draft, stores in DB, sends SMS to Alex |
| sent | pending | Alex replies SEND — count++, schedule next |
| sent | exhausted | Alex replies SEND on 3rd follow-up — terminal |
| pending/sent | skipped | Alex replies SKIP — cancels all future follow-ups |

**Why no `sending` state:** With human-in-the-loop approval, there is no concurrent race to guard against. better-sqlite3 is synchronous and single-threaded. If the server crashes mid-generation, status remains `pending` and the scheduler retries next cycle. Adding a `sending` state would create complexity (timeout logic, stuck-state recovery) with zero safety benefit.

**Files (8 TypeScript files, +449 lines):**

| File | Responsibility |
|------|---------------|
| `src/types.ts` | `FOLLOW_UP_STATUSES` const array, `FollowUpStatus` union type |
| `src/leads.ts` | `getLeadsDueForFollowUp()`, `scheduleFollowUp()`, `completeApproval()`, `MAX_FOLLOW_UPS=3` |
| `src/follow-up-scheduler.ts` | setTimeout chaining, 15-min cycles, kill switch, LIMIT 10 burst protection |
| `src/prompts/follow-up.ts` | Value-add prompt (song/testimonial/urgency rotation), Haiku model |
| `src/pipeline/follow-up-generate.ts` | `callClaudeText` with `maxTokens=256` |
| `src/twilio-webhook.ts` | SEND/SKIP handlers, routing: APPROVAL > EDIT_ID > SKIP > SEND > catch-all |
| `src/api.ts` | `shapeLead()` includes follow-up fields, approve uses `completeApproval()` |
| `src/server.ts` | Scheduler startup in `app.listen()`, `server.close()` on SIGTERM |

## Key Code Patterns

### 1. Human-in-the-loop simplifies state machines

If every action requires human approval before execution, defensive states like `sending` and patterns like atomic claims add complexity for problems that can't happen. Test this assumption explicitly: it holds when the DB is synchronous + single-threaded and the process is single-instance.

### 2. setTimeout chaining over setInterval

`setInterval` fires regardless of whether the previous callback completed. If 8 follow-ups each take 2 minutes, a 15-minute interval could overlap. `setTimeout` chaining guarantees no overlap by design — each cycle schedules the next only after completing.

### 3. Shared approval function

Both Twilio webhook and dashboard API approval paths use `completeApproval()`. This ensures `status = "done"` and `scheduleFollowUp()` happen atomically via `runTransaction()`. Prevents forgetting to trigger follow-up scheduling from one path.

### 4. Draft storage for crash recovery and cost savings

`follow_up_draft` column stores the generated text between generation and SEND approval. Benefits: (a) SEND handler knows exactly what was approved, (b) scheduler reuses existing drafts on retry instead of regenerating (saves API $), (c) survives server restarts.

### 5. Poison lead auto-skip

In-memory retry tracking (`Map<number, number>`) counts consecutive failures per lead. After 3 failures, the lead is automatically skipped and Alex receives an SMS notification. Prevents a single malformed lead from blocking the entire scheduler queue every cycle.

### 6. Exhaustive switch with default:never

`getValueAddInstructions` uses `default: never` so adding a 4th follow-up type without handling it causes a compile-time error. Catches missing handlers before runtime.

## What Was Fixed in Review

**P2 findings (7 fixes):**

| ID | Issue | Fix |
|----|-------|-----|
| 012 | Raw SQL bypassed `normalizeRow()` | Extracted `getLeadAwaitingFollowUp()` / `getLeadWithActiveFollowUp()` into leads.ts |
| 013 | Unnecessary `runTransaction()` around single `updateLead` | Removed — single statements are already atomic in SQLite |
| 014 | No `server.close()` on SIGTERM | Added graceful shutdown for in-flight HTTP requests |
| 015 | No retry limit for poison leads | In-memory retry tracking, auto-skip after 3 failures, SMS notification |
| 016 | Magic number `3` scattered | Exported `MAX_FOLLOW_UPS = 3` constant |
| 017 | Raw `err.message` in SMS notifications | Redacted error details, log full error server-side only |
| 018 | Scheduler re-generated draft on retry | Reuse existing `follow_up_draft` on retry (saves API $) |

**P3 findings (4 fixes):**

| ID | Issue | Fix |
|----|-------|-----|
| 019 | Untyped `JSON.parse` | Typed as `Classification` |
| 020 | `computeFollowUpDelay` accepted `number` | Narrowed to `0 \| 1 \| 2` |
| 021 | No exhaustive check in switch | Added `default: never` |
| 022 | `maxTokens` too high for follow-ups | Added optional param, set 256 for follow-ups |

## Risk Resolution

| Phase | Risk Flagged | Resolution |
|-------|-------------|------------|
| **Brainstorm** | Reply detection via email parsing is complex | Deferred to V2. SMS approval is the human-in-the-loop mechanism instead. |
| **Plan** | Follow-up prompt quality might produce generic messages | Mitigated by SMS approval — Alex reviews every draft. Value-add rotation provides structural variety. |
| **Work** | SKIP handler idempotency claim might not hold | Confirmed safe: conditional WHERE matches zero rows for already-skipped leads, handler treats as success. |
| **Review** | Production behavior under real volumes is unverified | Accepted — burst protection (LIMIT 10) and poison-lead auto-skip provide guardrails. Integration testing planned post-deploy. |
| **Fix** | "skipped" conflates user-initiated and system-initiated skips | Accepted for V1. `skip_reason` column can be added later without changing state machine. |

## Prevention Strategies

1. **Human-in-the-loop reduces state complexity.** Don't add defensive states for problems that can't occur with your current architecture. If that assumption changes (e.g., multi-process deployment), backfill the safety states.

2. **Chain timeouts, not intervals.** Use `setTimeout` with recursive calls when sequential execution matters. `setInterval` fires regardless of completion.

3. **Unify critical paths through a single function.** Any action that must happen identically across multiple entry points should flow through one shared function named for the domain concept.

4. **Store intermediate artifacts in the database.** Persist drafts, intermediate states, and context that retry handlers need. Saves API costs and makes the system crash-recoverable.

5. **Add explicit retry limits.** Any loop that retries on failure needs a cap. In-memory tracking is acceptable when restart = fresh chances.

6. **Redact error messages in external communications.** Never send raw `err.message` to users via SMS or email.

7. **Separate system-initiated and user-initiated status changes in V2.** Status values that conflate different causes break analytics. Plan the schema change early.

8. **Make token budgets explicit.** Add optional `maxTokens` parameters when different callers have different needs. Don't force all callers to specify.

9. **Use exhaustive switches.** `default: never` catches missing handlers at compile time when union types grow.

10. **Multi-agent code review pays off on state machines.** TypeScript reviewers catch type issues; architecture reviewers catch state transition edge cases; security reviewers catch information leakage.

## Cross-References

### Solutions Applied

- [Constants at the Boundary](../logic-errors/constants-at-the-boundary.md) — `FOLLOW_UP_STATUSES` array defined once, TypeScript type derived from it, SQL CHECK constraint synced.
- [Required-Nullable vs Optional Types](../logic-errors/required-nullable-vs-optional-types.md) — New `LeadRecord` fields use `T | null`, never `?:`.
- [Hybrid LLM + Deterministic Computation](hybrid-llm-deterministic-computation.md) — LLM writes messages; code handles timing, retry logic, and rotation.
- [Silent Failure Escape Hatches](silent-failure-escape-hatches.md) — `DISABLE_FOLLOW_UPS=true` env var as kill switch. SKIP is idempotent.
- [Testable Constraints for Prompt Compliance](../prompt-engineering/testable-constraints-for-prompt-compliance.md) — Follow-up prompt tested against 4 test leads before shipping.

### Solutions Deliberately Not Applied

- [Atomic Claim for Concurrent State Transitions](atomic-claim-for-concurrent-state-transitions.md) — Human-in-the-loop + synchronous DB + single-threaded event loop eliminates the race condition this pattern guards against. Reconsider if architecture changes.

### Related

- PR #8: feat/follow-up-pipeline (merged 2026-02-26)
- Review: `docs/reviews/feat-follow-up-pipeline/REVIEW-SUMMARY.md`
- Plan: `docs/plans/2026-02-26-feat-follow-up-pipeline-plan.md`
- Brainstorm: `docs/brainstorms/2026-02-26-follow-up-pipeline-brainstorm.md`

## V2 Considerations

| Item | Why Deferred | Trigger to Implement |
|------|-------------|---------------------|
| Reply detection (email parsing) | Need real email samples to validate patterns | Collect 10+ GigSalad/Bash reply emails |
| Status separation (user-skip vs system-skip) | SMS notification to Alex is sufficient for V1 | Adding analytics dashboard or skip-rate metrics |
| Dashboard follow-up tab | SMS controls sufficient for V1 volume | Volume exceeds ~5 active follow-ups simultaneously |
| Per-lead controls (SNOOZE, NEXT, SKIP-42) | Most-recent default handles 99% of cases at V1 volume | Multiple simultaneous active follow-ups |
| Direct client sends (email/SMS) | Risk of bad messages without proven prompt quality | 20+ successful SEND approvals with minimal edits |
| Urgency-based timing bands | Fixed 24h/3d/7d is simple and adequate | Event-date-sensitive leads getting stale follow-ups |

## Three Questions

1. **Hardest pattern to extract from the fixes?** The relationship between "human-in-the-loop simplifies state machines" and "when to stop simplifying." Removing the `sending` state was correct — but the review still found 11 issues in the simplified design. The lesson isn't "simple = safe" but "simple = fewer categories of bugs, with the remaining bugs being easier to find in review."

2. **What did you consider documenting but left out, and why?** The specific Twilio webhook routing order (APPROVAL > EDIT_ID > SKIP > SEND > catch-all). It's implementation detail that belongs in code comments, not a solutions doc. The pattern that matters — "anchor regexes with `$` and check specific before general" — is standard and doesn't need a dedicated lesson.

3. **What might future sessions miss that this solution doesn't cover?** The production behavior gap flagged in the review's Three Questions: Does the scheduler actually fire correctly after 24 hours on Railway? Does SEND/SKIP work with multiple simultaneous active follow-ups? Does the SMS fit within Twilio's 1600-char limit? These require integration testing post-deploy, and no amount of documentation substitutes for running the system under real conditions.
