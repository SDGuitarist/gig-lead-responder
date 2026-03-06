---
title: "Runtime validation, atomic state transitions, and label normalization for analytics dashboard"
date: 2026-03-05
category: logic-errors
tags: [type-safety, temporal-coupling, data-normalization, solution-doc-compliance, dashboard, analytics]
severity: P1
component: lead-analytics-dashboard
root_cause: "Unsafe assumptions -- type casts instead of runtime validation, split operations instead of atomic transactions, renderer-side fallbacks instead of call-site normalization"
review_cycle: 14
related_findings: [040, 041, 042, 043, 044]
---

# Runtime Validation, Atomic State Transitions, and Label Normalization

Three patterns from Cycle 14 review fixes, all sharing one principle: **make invisible contracts visible and enforceable.**

### Prior Phase Risk

> "Error handling in the 8-query analytics transaction -- no agent tested failure paths" (Review Feed-Forward)

This compound phase accepts that risk. The fixes below address correctness of the query results and caller contracts, not transaction error handling. The error handling gap remains a deferred investigation item.

## Problem Statement

The lead analytics dashboard introduced three categories of latent risk:

1. **Silent data corruption:** Database query results were cast to TypeScript interfaces with `as` -- no runtime validation. Malformed or unexpected values (e.g., a new loss reason added to the DB but not to the app) would flow through to analytics charts unchecked.

2. **Temporal coupling between functions:** Setting a lead outcome required the caller to *also* call `skipFollowUp()` separately. This contract existed only as a code comment. Any new call site that forgot the second call would silently corrupt follow-up analytics.

3. **Fragile generic functions:** The dashboard's `renderBreakdownTable` resolved display labels through a waterfall fallback chain (`r.label || r.source_platform || r.event_type || r.reason || r.month`). Every new table type required modifying this generic function, and the chain masked bugs when multiple fields were present.

4. **Solution doc violation:** Monthly Trends `booked` count omitted the `status='done'` filter required by `align-derived-stat-queries.md`.

None of these caused visible bugs today. All would cause silent, hard-to-trace data issues the moment the system grew.

## Root Cause Analysis

**Pattern A -- Trusting type casts on external data.** TypeScript's `as` keyword is a compile-time assertion that disappears at runtime. Database results are *external data* -- their shape is unknown until validated. Casting skips the one moment where validation is cheap and failures are traceable.

**Pattern B -- Encoding multi-step invariants as caller obligations.** When operation A must always be followed by operation B, a `CALLER CONTRACT` comment is the weakest possible enforcement. It is invisible to the compiler, invisible at runtime, and invisible to new developers.

**Pattern C -- Pushing specificity into generic functions.** When a generic renderer handles multiple data shapes by inspecting which fields exist, it couples the generic function to every caller's data model. The function grows a new branch for every new use case.

## Solution

### Pattern A: Runtime validation on DB results

Replace `as` casts with explicit validation at the query boundary:

```typescript
// BEFORE -- unsafe cast
loss_reasons: lossReasons as LossReasonEntry[]

// AFTER -- runtime validation with coercion
loss_reasons: lossReasons.map((r): LossReasonEntry => ({
  reason: LOSS_REASONS.includes(r.reason as LossReason)
    ? (r.reason as LossReason)
    : "unspecified",
  count: r.count,
}))
```

The rule: every value crossing a trust boundary (DB, network, file system) gets validated at the point of entry. Unknown values are coerced to a safe default, not silently passed through.

### Pattern B: Compose temporal contracts into atomic functions

Wrap coupled operations in a single transactional function:

```typescript
// BEFORE -- caller must remember two calls
const updated = setLeadOutcome(id, outcome, options);
if (outcome !== null) skipFollowUp(id);

// AFTER -- single atomic function
export function setLeadOutcomeAndFreeze(
  id: number,
  outcome: LeadOutcome | null,
  options?: { outcome_reason?: LossReason; actual_price?: number },
): LeadRecord | undefined {
  const db = initDb();
  return db.transaction(() => {
    const updated = setLeadOutcome(id, outcome, options);
    if (updated && outcome !== null) skipFollowUp(id);
    return updated;
  })();
}
```

The original `setLeadOutcome()` becomes internal (not exported from barrel). The transaction guarantees atomicity. The caller cannot forget step two because step two does not exist as a separate concept.

### Pattern C: Normalize at call sites, not in generic functions

Move label resolution from the generic function to each call site:

```javascript
// BEFORE -- generic function guesses which field to use
var label = FORMAT_NAMES[r.label || r.source_platform || r.event_type || r.reason || r.month]
  || r.label || r.source_platform || r.event_type || r.reason || r.month || 'Unknown';

// AFTER -- each call site normalizes before calling
var trendRows = data.monthly_trends.map(function(r) { r.label = r.month; return r; });
var revRows = data.revenue_by_type.map(function(r) { r.label = r.event_type; return r; });
var lossRows = data.loss_reasons.map(function(r) { r.label = r.reason; return r; });

// Generic function is now trivial
var label = FORMAT_NAMES[r.label] || r.label || 'Unknown';
```

This made the generic function simple enough to also replace 17 lines of hand-rolled HTML in the booking cycle section -- deduplication came free once the abstraction was clean.

## Key Insight

All three patterns share a single principle: **make invisible contracts visible and enforceable.**

| Invisible contract | Enforcement mechanism |
|---|---|
| `as` cast: "I promise this data has this shape" | `.map()` with runtime validation |
| `CALLER CONTRACT`: "I promise to call these together" | Single atomic function with transaction |
| Fallback chain: "I promise each shape only has one of these fields" | Explicit `r.label` normalization at call site |

The cost of enforcing these contracts at write time is a few extra lines. The cost of *not* enforcing them is a silent data bug, weeks later, in a part of the system nobody is looking at.

## Prevention Strategies

### Pattern A: Runtime validation on DB results

- **Review checklist:** "Does every `as SomeType` cast on a database query result have a corresponding `.map()` that validates or coerces each field, especially union-typed strings?"
- **Heuristic:** Apply whenever a query returns a column that maps to a TypeScript union type, or a query result is passed directly to an API response without transformation.
- **Grep check:** `rg "as \w+\[\]" src/db/` should return zero results, or each must have a comment explaining why the cast is safe.

### Pattern B: Temporal coupling composition

- **Review checklist:** "Does any function have a CALLER CONTRACT, MUST ALSO CALL, or similar comment? If so, compose the two operations into one function and remove the comment."
- **Heuristic:** Apply whenever a function's correctness depends on the caller doing something else before or after. If two operations are always paired, they are one operation.
- **Smell:** Any comment containing "must," "always," "don't forget," or "caller is responsible" near a function signature.

### Pattern C: Call-site normalization

- **Review checklist:** "Does any generic/shared function inspect caller-specific field names? If so, move the field selection to the call site and pass a uniform shape."
- **Heuristic:** Apply whenever a shared function has a fallback chain or switch/case that grows with each new caller. Normalize at the boundary between specific and generic code.
- **Grep check:** Inside `renderBreakdownTable`, `rg "r\.source_platform|r\.event_type|r\.reason|r\.month"` should return zero matches.

## Related Documentation

| Doc | Relevance |
|-----|-----------|
| `docs/solutions/database-issues/align-derived-stat-queries.md` | The invariant violated by #041 -- all analytics queries must share the same WHERE scope |
| `docs/solutions/logic-errors/required-nullable-vs-optional-types.md` | Pattern A parallel -- when to use type guards vs `as` casts |
| `docs/solutions/logic-errors/constants-at-the-boundary.md` | Pattern A -- `LOSS_REASONS` const array and `Set.has()` validation |
| `docs/solutions/architecture/express-handler-boundary-validation.md` | Pattern A -- "guard at the boundary" principle |
| `docs/solutions/architecture/follow-up-pipeline-human-in-the-loop-lifecycle.md` | Pattern B context -- the follow-up state machine |
| `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md` | Pattern B parallel -- atomic WHERE-guarded writes |
| `docs/solutions/architecture/noop-gut-checks-conditional-features.md` | Pattern C parallel -- normalize at the source, not the consumer |
| `docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md` | Dashboard rendering context |
| `docs/solutions/architecture/review-fix-cycle-12-full-codebase-hardening.md` | Prior hardening cycle context |

## Risk Resolution

**Flagged risk (Review Feed-Forward):** Error handling in the 8-query analytics transaction -- no agent tested failure paths.

**What happened:** This compound phase focused on the 5 committed fixes (correctness and contracts). The error handling gap was not in scope for these fixes and was not encountered during implementation.

**Lesson:** Transaction error handling in `getAnalytics()` remains untested. If `json_extract` throws on malformed `pricing_json`, the transaction should roll back cleanly (SQLite default), but the Express error handler's behavior for this path is unverified. Add to deferred items for a future review cycle.

## Three Questions

1. **Hardest pattern to extract from the fixes?** The relationship between Pattern C (label normalization) and the deduplication win in #044. The deduplication wasn't a separate pattern -- it was a *consequence* of getting Pattern C right. Documenting it as a bonus rather than a fourth pattern was the right call, but it took deliberation.

2. **What did you consider documenting but left out, and why?** The Monthly Trends `status='done'` fix (#041) as a standalone pattern. It's really just "follow the existing solution doc invariant" -- the pattern is already documented in `align-derived-stat-queries.md`. Repeating it here would dilute the three novel patterns.

3. **What might future sessions miss that this solution doesn't cover?** The error handling gap flagged in Risk Resolution. This doc teaches you to validate data and compose operations, but it doesn't address what happens when a query *throws*. A future analytics feature could add a query that fails on edge-case data, and no solution doc currently covers transaction error handling patterns.
