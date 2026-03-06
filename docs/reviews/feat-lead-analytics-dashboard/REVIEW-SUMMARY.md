# Review Summary: feat/lead-analytics-dashboard (Cycle 14)

**Date:** 2026-03-05
**Branch:** `feat/lead-analytics-dashboard`
**Commits reviewed:** 7 analytics commits (`8289ab7`..`f754e36`) + context from Cycle 12 fixes
**Review agents:** 7

## Severity Snapshot

| Priority | Count |
|----------|-------|
| P1 | 0 |
| P2 | 4 |
| P3 | 3 |
| **Total** | **7** |

**Plus 1 pre-existing:** `040-pending-p1-loss-reasons-unsafe-type-cast.md` (from earlier review, re-confirmed by TS reviewer)

## Merge Decision

**No P1 blockers found.** The feature can merge after addressing the P2 findings (or explicitly accepting them). The P2s are correctness/maintainability issues, not bugs that affect current users.

### Recommended Fix Order

| # | Issue | Priority | Why this order | Unblocks |
|---|-------|----------|---------------|----------|
| 1 | 041 - Monthly Trends `booked` missing `status='done'` | P2 | Solution doc violation -- same root cause class as the original alignment fix | -- |
| 2 | 042 - CALLER CONTRACT temporal coupling | P2 | Architectural -- prevents silent data corruption if new call sites added | -- |
| 3 | 043 - Label resolution chain fragile | P2 | Maintainability -- unblocks 044 and 047 | 044, 047 |
| 4 | 044 - Booking cycle table duplication | P2 | Depends on 043 (label normalization) | -- |
| 5 | 045 - avg_price falsy check | P3 | One-line fix, trivial | -- |
| 6 | 046 - Monthly Trends gap-filling | P3 | UX improvement, ~10 lines | -- |
| 7 | 047 - pctGate + bar value implicit | P3 | Depends on 043 | -- |

## Feed-Forward Focus Area Results

### 1. Line budget tightness (2,694/2,800)
**Verdict: Acceptable.** All 7 agents agree the rendering logic is well-structured. The parameterized `renderBreakdownTable` handles 5 table types in one function. Custom renderers (`renderBookingCycleSection`, `renderFollowUpEffectivenessSection`) are separate functions with clear names. The compression is managed, not reckless. **However:** the architecture reviewer notes that 2,694 lines in a single HTML file is a maintenance risk. Next feature that bumps the count should include extracting the Insights tab JS into a separate file.

### 2. Monthly Trends WHERE clause deviation
**Verdict: `received` is correct, `booked` needs a fix.** The `received` count intentionally omits `status = 'done'` to measure total incoming volume -- this is documented and appropriate. However, the `booked` SUM also omits the filter, which violates the solution doc pattern. See todo 041.

### 3. skipFollowUp bug fix edge cases
**Verdict: Correct.** The `if (outcome !== null)` guard prevents calling `skipFollowUp` when clearing an outcome. The re-fetch (`getLead(id) ?? updated`) ensures the response reflects the follow-up status change. `skipFollowUp` is idempotent. No edge case issues found. The **architectural concern** (temporal coupling) is tracked separately as todo 042.

### 4. WHERE clause alignment across all 5 queries
**Verdict: Compliant.** Queries 4, 6, 7, 8 all correctly use `WHERE status = 'done'`. Query 5 (`received`) intentionally deviates -- documented in code comment. The learnings researcher confirmed zero violations against `align-derived-stat-queries.md`, except the `booked` count in Query 5 (todo 041).

## Agent Reports

### kieran-typescript-reviewer
- 0 P1, 3 P2, 4 P3
- Key findings: Monthly Trends booked filter (P2), lossReasons unsafe cast (P2, pre-existing as 040), label chain fragility (P2)
- skipFollowUp verified correct, all edge cases handled

### security-sentinel
- 0 Critical, 0 High, 0 Medium, 2 Low (informational)
- All SQL uses `stmt()` prepared statements, all rendering uses `esc()`, auth on all routes
- **Bottom line: feature is secure**

### performance-oracle
- No critical issues. 8 queries in a single SQLite transaction is fine for <1000 leads
- No new indexes needed at current scale
- Noted: Monthly Trends gap-filling not implemented (correctness, not performance)
- **Bottom line: no performance changes needed**

### architecture-strategist
- Key: CALLER CONTRACT should be structurally enforced (P2)
- skipFollowUp placement in api.ts is correct (avoids circular dependency)
- Single analytics endpoint is sustainable for now
- Dashboard at 2,694 lines needs extraction plan before next feature
- FORMATTERS + parameterized table is a good abstraction (not premature)

### learnings-researcher
- Searched 16 solution docs, found 4 directly relevant + 2 contextual
- **Zero compliance violations** against documented patterns
- All queries align with `align-derived-stat-queries.md`
- Dashboard rendering follows `targeted-dom-toggle-data-attributes.md` pattern
- Follow-up state machine fields rendered correctly per lifecycle doc
- No handler boundary violations

### code-simplicity-reviewer
- Label resolution chain is the biggest simplification opportunity
- Booking cycle table duplication saves ~17 lines
- pctGate flag and bar value guessing are implicit but minor
- **Overall: code is reasonably well-structured, minor tweaks only**

### agent-native-reviewer
- **PASS.** All 5 new analytics sections returned as structured JSON via `GET /api/analytics`
- All type interfaces exported and usable by external consumers
- No semantic data trapped in rendering layer
- Pre-existing gap: no token-based auth for M2M (affects all endpoints, not new)

## Blind Spots -- What This Review Did NOT Cover

- **LLM pipeline behavior** -- no agent reviewed prompt injection resilience or response format drift
- **Accessibility** -- no agent checked keyboard navigation, screen reader compatibility, or color contrast for new sections
- **Browser compatibility** -- no agent tested CSS/JS in older browsers
- **Integration testing** -- no agent verified the full flow (API -> dashboard rendering) with real data
- **Error handling in analytics endpoint** -- what happens if one of the 8 queries throws? Does the transaction rollback cleanly? No agent tested this path.

## Three Questions

1. **Hardest judgment call in this review?** Whether Monthly Trends `booked` count (P2 #041) is a real issue or acceptable documentation-level deviation. The plan explicitly documents the intentional deviation for `received`, and in practice `outcome = 'booked'` implies `status = 'done'`. But the solution doc is clear: all outcome-related aggregates must filter on `status = 'done'`. Calling it P2 (not P1) because it's harmless today but violates the documented invariant.

2. **What did you consider flagging but chose not to, and why?** Dashboard line count (2,694/2,800). All agents acknowledged it's getting tight, but the architecture reviewer correctly said "plan extraction, don't fix now." Creating a P2 todo for something that needs a separate feature branch would be misleading. Instead, it's documented in HANDOFF deferred items and in this summary.

3. **What might this review have missed?** The error path when one of the 8 analytics queries fails mid-transaction. All agents focused on the happy path (correct WHERE clauses, proper rendering). If `json_extract` throws on malformed `pricing_json`, does the transaction handle the error gracefully? This is an edge case no agent explored, and it could result in a 500 error on the Insights tab.

## Feed-Forward

- **Hardest decision:** Severity assignment for Monthly Trends booked filter -- P2 not P1 because harmless today
- **Rejected alternatives:** Flagging dashboard line count as a todo (better as a deferred item/plan trigger)
- **Least confident:** Error handling in the 8-query analytics transaction -- no agent tested failure paths
