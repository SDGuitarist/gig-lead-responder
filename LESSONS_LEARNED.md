# Institutional Learnings

Living document of patterns and lessons learned across features. Each feature gets its own H2 section. New features append below using the [template](#template-for-new-features) at the bottom.

**Source:** `docs/solutions/` — patterns extracted from documented solutions.

## Table of Contents

- [Top 10 Patterns](#top-10-patterns)
- [Follow-Up Pipeline](#follow-up-pipeline)
  - [Search Context](#search-context)
  - [Quick Reference: Phase Mapping](#quick-reference-learning-to-implementation-phase-mapping)
  - [Learnings Summary](#learnings-summary)
  - [Recommendations](#recommendations)
  - [Risk Areas to Watch](#risk-areas-to-watch)
- [Railway / Deployment](#railway--deployment)
- [Template for New Features](#template-for-new-features)

---

## Top 10 Patterns

Patterns that recur across features or prevent entire categories of bugs. Search these first when starting a new feature.

| # | Pattern | Source | Solution File |
|---|---------|--------|---------------|
| 1 | Atomic claim for concurrent state transitions — conditional UPDATE with WHERE clause, not read-check-write | Follow-Up Pipeline | `atomic-claim-for-concurrent-state-transitions.md` |
| 2 | Fire-and-forget timeout — `Promise.race` wraps any async work that could hang | Follow-Up Pipeline | `fire-and-forget-timeout.md` |
| 3 | No-op gut checks — conditional checks return "Always true" when inactive, never omitted | Follow-Up Pipeline | `noop-gut-checks-conditional-features.md` |
| 4 | Async work before DB write — Twilio/Mailgun call first, single `updateLead()` after | Follow-Up Pipeline | `async-sqlite-transaction-boundary.md` |
| 5 | Guard inside the function, not at call site — `if (btn.disabled) return` at top of handler | Follow-Up Pipeline | `rate-limiting-race-condition-and-cleanup.md` |
| 6 | Constants at module boundaries — `FOLLOW_UP_STATUSES` array in `src/types.ts`, import everywhere | Follow-Up Pipeline | `constants-at-the-boundary.md` |
| 7 | Align derived-stat queries on same WHERE scope — CTE for base population | Follow-Up Pipeline | `align-derived-stat-queries.md` |
| 8 | Hybrid LLM + deterministic computation — LLM writes message, code chooses channel/urgency | Follow-Up Pipeline | `hybrid-llm-deterministic-computation.md` |
| 9 | Silent failure escape hatches — `DISABLE_{SERVICE}_VALIDATION` env var for first-deploy debugging | Follow-Up Pipeline | `silent-failure-escape-hatches.md` |
| 10 | `today` injected as parameter, never `new Date()` inside functions — makes functions pure/testable, prevents timezone bugs | Follow-Up Pipeline | `today-as-parameter-timezone.md` |
| 11 | Healthcheck before auth middleware — `/health` must be registered before any `app.use(router)` that applies `sessionAuth`, or Railway probe gets 401 | Railway/Deploy | `railway-healthcheck-auth-middleware-ordering.md` |
| 12 | Solution doc violations are almost always P1 — the Learnings Researcher cross-references findings against existing docs, surfacing repeated mistakes | Lead Response Loop | `review-fix-cycle-2-lead-response-loop.md` |
| 13 | Multi-agent reviews have blind spots shaped by agent roster — declare what's NOT covered | Lead Response Loop | `review-fix-cycle-2-lead-response-loop.md` |
| 14 | Merge verification needs a specific checklist of integration points, not just "it compiles" | Lead Response Loop | `review-fix-cycle-2-lead-response-loop.md` |
| 15 | Per-request `process.exit()` is never correct — fail-fast belongs at boot time | Lead Response Loop | `review-fix-cycle-2-lead-response-loop.md` |
| 16 | P3 deferrals need a tracking home (HANDOFF "Deferred Items") or they vanish between sessions | Lead Response Loop | `review-fix-cycle-2-lead-response-loop.md` |

---

## Follow-Up Pipeline

**Date:** 2026-02-26
**Feature:** Follow-up pipeline with state machine, scheduler, AI-generated drafts, SMS commands, email reply detection, and dashboard
**Search scope:** `docs/solutions/` — all 22 documented files scanned, 8 highly relevant matches found

### Search Context

**Feature Overview:**
- SQLite schema columns with state machine (`follow_up_status` with 7 states)
- `setInterval` scheduler (every 15 min)
- AI-generated follow-up drafts with a verify gate
- Twilio SMS command parsing (`SKIP`/`SNOOZE`/`YES-FU`)
- Mailgun email reply detection
- Express dashboard tab with follow-up queue

**Key Technologies:**
- TypeScript, SQLite (better-sqlite3), Express, Twilio, Mailgun, Claude API

---

### Quick Reference: Learning to Implementation Phase Mapping

| Learning | Applies To Phases | Key Action | File |
|----------|-------------------|------------|------|
| Atomic Claim for Concurrent State Transitions | 1-4 (all phases with status updates) | Use conditional UPDATE with WHERE clause to prevent double-sends | atomic-claim-for-concurrent-state-transitions.md |
| Fire-and-Forget Pipeline Timeout | 2-3 (scheduler + generation) | Wrap `generateFollowUp()` in `Promise.race` with 2-min timeout | fire-and-forget-timeout.md |
| No-Op Gut Checks for Conditional Features | 3 (follow-up verify gate) | Design smaller gate (~10-12 checks), always present, conditionally true | noop-gut-checks-conditional-features.md |
| Async Work Inside SQLite Transactions | 4 (SMS send + status update) | Do Twilio send first, then single atomic `updateLead()` call | async-sqlite-transaction-boundary.md |
| Reentrancy Guard (Keyboard Re-entry) | 6 (dashboard buttons) | Add `if (btn.disabled) return` inside snooze/skip/approve handlers | rate-limiting-race-condition-and-cleanup.md |
| Constants at Module Boundaries | 1 (schema + types) | Define `FOLLOW_UP_STATUSES` array once in `src/types.ts`, import everywhere | constants-at-the-boundary.md |
| Align Derived-Stat Queries | 6 (dashboard analytics) | Define base WHERE clause once (e.g., `follow_up_status IS NOT NULL`), reference in all queries | align-derived-stat-queries.md |
| Hybrid LLM + Deterministic Computation | 3 (follow-up generation) | LLM writes message, code chooses channel/urgency/retry-date | hybrid-llm-deterministic-computation.md |

---

### Learnings Summary

Each learning links to its full solution doc with code examples, failure modes, and prevention strategies.

**1. Atomic Claim for Concurrent State Transitions** — [Full doc](docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md)
Replace read-check-write with a single conditional `UPDATE ... WHERE status IN (...)`. Use `claimFollowUpForSending()` with `result.changes > 0` to detect concurrent claims. Name the pattern `claim*` to communicate intent. Transitional statuses (`sending`) make in-flight work visible in the UI.

**2. Fire-and-Forget Pipeline Timeout** — [Full doc](docs/solutions/architecture/fire-and-forget-timeout.md)
Wrap fire-and-forget promises in `Promise.race` with a 2-minute timeout (sized for 3 Claude API calls at 30s each + 20% headroom). On timeout, mark `follow_up_status = 'failed'` and alert. The `setInterval` scheduler is a complementary safety net for process crashes — use both.

**3. No-Op Gut Checks for Conditional Features** — [Full doc](docs/solutions/architecture/noop-gut-checks-conditional-features.md)
When a check only applies to some leads, return `"Always true — [reason]."` instead of omitting it. This keeps check count stable, threshold math simple, `GateResult` interface fixed, and LLM JSON schema consistent. Design follow-up gate with ~10-12 checks, threshold = `TOTAL - 2`.

**4. Async Work Before DB Write** — [Full doc](docs/solutions/database-issues/async-sqlite-transaction-boundary.md)
`better-sqlite3` is synchronous — you can't `await` inside `db.transaction()`. Do all async work (Twilio, Mailgun) first, then write everything to DB in one atomic `updateLead()` call. Design failure recovery around the gap: if SMS succeeds but DB fails, the scheduler's next cycle retries.

**5. Reentrancy Guard Inside Function** — [Full doc](docs/solutions/logic-errors/rate-limiting-race-condition-and-cleanup.md)
If a function can be called from multiple paths (click, keyboard, programmatic), the function must check `if (btn.disabled) return` at the top — not at the call site. Use `.finally()` for unconditional cleanup. Dashboard handlers `snoozeFollowUp()`, `skipFollowUp()`, `approveFollowUp()` all need this.

**6. Constants at Module Boundaries** — [Full doc](docs/solutions/logic-errors/constants-at-the-boundary.md)
Export `FOLLOW_UP_STATUSES` as `const` array from `src/types.ts`, derive the union type and runtime validation set from it. SQL CHECK constraints can't import from TypeScript — mark with `-- SYNC: FOLLOW_UP_STATUSES in src/types.ts` comment. When adding a state, update both.

**7. Align Derived-Stat Queries** — [Full doc](docs/solutions/database-issues/align-derived-stat-queries.md)
All dashboard queries (totals, by-channel, by-urgency) must share the same `WHERE` base population. Use a CTE: `WITH active_follow_ups AS (SELECT * FROM leads WHERE follow_up_status IS NOT NULL)` then reference it in every query. Otherwise percentages exceed 100% or totals go negative.

**8. Hybrid LLM + Deterministic Computation** — [Full doc](docs/solutions/architecture/hybrid-llm-deterministic-computation.md)
LLM writes the message body (fuzzy NLP). Code computes channel, urgency tier, retry count, and next date (deterministic). An `enrichFollowUpDraft()` pure function applies deterministic overrides between generation and verification. Never let the LLM count or route — it will get it wrong.

**9. Silent Failure Escape Hatches** — [Full doc](docs/solutions/architecture/silent-failure-escape-hatches.md)
`DISABLE_{SERVICE}_VALIDATION` env var skips cryptographic webhook verification but keeps all business logic (dedup, parsing, DB write). Only check `=== "true"`, log on every bypass + at startup. Never use for auth endpoints — only safe for third-party webhook signature validation. Add for Twilio and Mailgun on first deploy.

---

### Recommendations

#### Must-Do Before Implementation

1. **Define `FOLLOW_UP_STATUSES` constant array in `src/types.ts`** (Learning #6)
   - All 7 states: `pending`, `due`, `sending`, `sent`, `replied`, `skipped`, `snoozed`
   - Derive runtime validation set from this single source
   - Add SYNC comment to SQL CHECK constraint

2. **Design the follow-up verify gate as a separate, smaller gate** (Learning #3)
   - Estimate 10-12 checks (smaller than initial generate's 14)
   - Add all checks unconditionally (no optional fields)
   - Make conditional checks return `"Always true — [reason]."` when inactive
   - Set threshold as `FOLLOW_UP_THRESHOLD = FOLLOW_UP_TOTAL - 2`

3. **Plan for atomic follow-up status transitions** (Learning #1)
   - Create `claimFollowUpForSending(leadId)` function
   - Uses conditional UPDATE: `UPDATE leads SET follow_up_status = 'sending' WHERE id = ? AND follow_up_status IN ('due', 'pending')`
   - Check `result.changes > 0` to detect concurrent claims

4. **Implement `Promise.race` timeout wrapper** (Learning #2)
   - 2-minute timeout for follow-up generation (3 Claude API calls max)
   - Wrap scheduler's `generateFollowUp()` call
   - On timeout, mark `follow_up_status = 'failed'` and alert

5. **Verify async-DB boundary in follow-up send flow** (Learning #4)
   - Do Twilio SMS send first (outside any transaction)
   - Then update all DB fields in one synchronous `updateLead()` call
   - Design recovery around the gap: if SMS succeeds but DB fails, the scheduler's next cycle will retry

#### Patterns to Follow Throughout

- **Reentrancy guards inside functions, not at call sites** (Learning #5) — Dashboard buttons for snooze/skip/approve must check their own disabled state
- **All dashboard queries on same WHERE scope** (Learning #7) — If showing follow-up totals and breakdowns, define the base population once (e.g., `follow_up_status IS NOT NULL`), then reference it in all derived-stat queries
- **Deterministic code for enumerations and routing** (Learning #8) — Let Claude write the message body, let code choose the channel, retry count, and urgency tier
- **Debug escapes for webhook validation** (Learning #9) — Add `DISABLE_TWILIO_VALIDATION` and `DISABLE_MAILGUN_VALIDATION` env vars for first-deploy iteration

---

### Risk Areas to Watch

1. **Scheduler + Dashboard Race:** The scheduler marks leads `due`, the dashboard may display them concurrently. The atomic claim pattern prevents double-send, but the dashboard UI should reflect in-flight status with a transitional `'sending'` badge.

2. **Follow-Up Verify Gate Threshold:** If the gate is too strict (e.g., 11/12), follow-ups fail frequently and fall back to manual mode. If too loose (e.g., 9/12), low-quality follow-ups are sent. No perfect threshold — starts at `FOLLOW_UP_TOTAL - 2`, adjust based on production metrics.

3. **Email Reply Detection Edge Cases:** The Mailgun webhook must handle reply-to-reply chains, forwarded messages, and out-of-office auto-responses. Real email samples from GigSalad and The Bash needed before writing the parser (per plan's feed-forward risk).

4. **Snooze Timeout Logic:** A snoozed follow-up stays in `'snoozed'` status until `snoozed_until <= now`. The scheduler's `checkDueFollowUps()` must explicitly query for snoozed leads and un-snooze them (set `follow_up_status = 'pending'`, `follow_up_due_at = next-urgent-date`), or they remain invisible forever.

5. **SMS Rate Limiting:** The existing rate limiting (Learning #5 origin story) limits the main `/analyze` endpoint. Follow-ups send via Twilio on a background schedule — they bypass the rate limit. Consider adding a per-lead follow-up rate limit (e.g., max 3 follow-ups per 7 days) to avoid SMS spam.

---

### Files Searched

23 solution docs scanned. 8 highly relevant, 0 moderate, 15 not relevant (UI bugs, workflow, prompt engineering covered by other learnings). See `docs/solutions/` for full inventory.

---

## Lead Response Loop (Cycle 10 Review)

**Date:** 2026-03-04
**Feature:** Lead response loop — venue context integration, follow-up pipeline v2 dashboard, Mailgun/Twilio webhooks
**Search scope:** `docs/solutions/` — 2 solution docs produced, 7 existing docs cross-referenced by Learnings Researcher

### Learnings Summary

**14. Learnings Researcher Is the Highest-ROI Review Agent** — [Evidence: REVIEW-SUMMARY.md](docs/reviews/feat-lead-response-loop/REVIEW-SUMMARY.md)
Cross-referencing findings against existing solution docs surfaced 2 of 2 P1s. Without this agent, they'd have been rated on individual merit (likely P2). The compound flywheel: past docs make future reviews sharper. Always include the Learnings Researcher in agent rosters.

**15. Multi-Agent Reviews Have Blind Spots Shaped by Agent Roster** — [Full doc](docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md)
7 agents produced 66 findings but zero coverage of the LLM pipeline (prompt injection, output validation) and minimal coverage of 2,474-line client-side JS. A review is only as good as the agents deployed. Explicitly declare blind spots in every review summary.

**16. Merge Verification Needs a Specific Checklist** — [Full doc](docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md)
The merge of `feat/lead-response-loop` succeeded because HANDOFF listed 3 exact things to verify (healthcheck ordering, IPv6 binding, security headers). Generic "does it build?" would miss architectural regressions. When branches diverge, list specific integration points to verify.

**17. Per-Request `process.exit()` Is Never Correct** — [Full doc](docs/solutions/architecture/review-fix-cycle-2-lead-response-loop.md)
Auth middleware was calling `process.exit(1)` on every request when creds were missing. Should be a startup check. Fail-fast belongs at boot time, not in hot paths. Move fatal config checks to application startup.

**18. P3 Deferrals Need a Tracking Home** — [Evidence: REVIEW-SUMMARY.md](docs/reviews/feat-lead-response-loop/REVIEW-SUMMARY.md)
~30 P3 items across Cycles 9-10 are documented in review summaries but have no tracking beyond that. They'll be invisible in future brainstorms unless explicitly surfaced. When deferring P3s, add them to HANDOFF.md "Deferred Items" section so the next brainstorm can pick them up.

### Quick Reference: Learning to Implementation Phase Mapping

| Learning | Applies To | Key Action | Source |
|----------|-----------|------------|--------|
| Learnings Researcher ROI | Review | Always include in agent roster | REVIEW-SUMMARY.md |
| Agent roster blind spots | Review | Declare blind spots explicitly in review summary | review-fix-cycle-2 solution doc |
| Merge verification checklist | Work (merge) | List specific integration points in HANDOFF before merging | review-fix-cycle-2 solution doc |
| No per-request process.exit | Work | Move fatal config checks to startup | review-fix-cycle-2 solution doc |
| P3 deferral tracking | Review → Brainstorm | Add deferred P3s to HANDOFF "Deferred Items" | REVIEW-SUMMARY.md |

### Risk Areas to Watch

1. **LLM pipeline unreviewed:** generate.ts, verify.ts, enrich.ts have never been reviewed by a prompt-security agent. Prompt injection via lead text is a real risk.
2. **Dashboard JS at 2,474 lines:** Approaching 3,000-line extraction threshold. DOM-based XSS not examined.
3. **P3 decay:** Deferred items lose context over time. Re-evaluate at next brainstorm or they become stale.

---

## Railway / Deployment

**Date:** 2026-03-04
**Feature:** Railway healthcheck + deploy debugging
**Search scope:** 6 deploy attempts, 3 root causes found

### Learnings Summary

**11. Healthcheck Before Auth Middleware** — [Full doc](docs/solutions/architecture/railway-healthcheck-auth-middleware-ordering.md)
Express routers mounted with `app.use(router)` (no path prefix) run their middleware on ALL requests, not just routes the router defines. If `apiRouter` has `router.use(sessionAuth)`, it intercepts `/health` requests before they reach the healthcheck handler. Fix: register `/health` before all routers.

**12. Deploy Debugging Order**
When Railway deploys fail: (1) Read deploy logs for crash errors first (module not found, syntax error). (2) Remove healthcheck to test if app is reachable — the HTTP status code is diagnostic (401 = auth, 502 = not running). (3) Only try platform-level fixes (IPv6, timeouts, plan upgrades) after confirming the app itself works.

**13. Never Cherry-Pick Whole Files Across Diverged Branches**
Cherry-picking `server.ts` from a feature branch to main brought imports (`cookie-parser`, `follow-up-api`) that don't exist on main. The deploy crashed with `ERR_MODULE_NOT_FOUND`. Always make minimal edits directly on the target branch instead.

### Risk Areas to Watch

1. **Main/feature branch drift:** `server.ts` on main is now different from the feature branch version. When the feature branch merges, the feature branch version (with all imports) should win. The `/health` positioning fix must be preserved in the merge.

---

## Cross-Tool Workflow (March 2026)

**Date:** 2026-03-06
**Feature:** Codex integration as independent planning/review agent

### Learnings Summary

**19. Two Independent Reviewers > One Self-Reviewing Tool**
Codex reviews first (fresh eyes, no context bias from implementation), then Claude Code reviews with compound learnings researcher. Deduplicate findings across both. Two independent perspectives catch blind spots that a single tool misses — especially when the implementing tool also reviews its own work.

**20. Handoff Prompts Start With Plan Reference**
Codex generates focused Claude Code prompts with exact file paths, scope boundaries, acceptance criteria, and stop conditions. Always starts with "Read docs/plans/[file].md" to prevent broad exploration and conserve context window.

---

## Template for New Features

Copy this template when adding learnings for a new feature. Paste it as a new H2 section above this template.

```markdown
## [Feature Name]

**Date:** YYYY-MM-DD
**Feature:** [One-line description]
**Search scope:** `docs/solutions/` — [N] files scanned, [M] highly relevant matches

### Search Context

**Feature Overview:**
- [Key components]

**Key Technologies:**
- [Languages, libraries, services]

### Quick Reference: Learning to Implementation Phase Mapping

| Learning | Applies To | Key Action | File |
|----------|-----------|------------|------|
| [Pattern name] | [Which phases] | [What to do] | [solution file] |

### Learnings Summary

**1. [Pattern Name]** — [Full doc](docs/solutions/[category]/[filename].md)
[2-3 sentence summary: what the pattern is, why it matters, key action.]

### Recommendations

1. [Must-do items before implementation]

### Risk Areas to Watch

1. [Known risks and edge cases]
```

**When to add a new section:** Before implementing any feature that touches 3+ modules, involves concurrency, or integrates with external services. Run the `learnings-researcher` agent first, then capture the results here.
