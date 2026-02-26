# Code Simplicity Reviewer — Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Assessment

Complexity score: Low. Well-scoped feature following plan. No unnecessary abstractions, no premature caching, no over-generalized helpers.

## Findings

### [P1] Orphan `renderDetailPanel(updated)` call — return value discarded
**File:** `public/dashboard.html:1773`
**Issue:** Generates HTML string, throws it away. Same function called again on line 1778 where result is assigned to `innerHTML`. Dead code.
**Suggestion:** Delete line 1773.

---

### [P1] `_pendingOutcome` hack mutates shared state unsafely
**File:** `public/dashboard.html:1718-1736`
**Issue:** Temporarily overwrites `lead.outcome`, renders, restores. No try/finally. `_pendingOutcome` property set then deleted but never read (dead code). Mutation of shared object is a maintenance trap.
**Suggestion:** `var preview = Object.assign({}, lead, { outcome: sel.value || null });` — no mutation, no restore, fewer lines.

---

### [P2] `OutcomeUpdateBody` interface — YAGNI violation
**File:** `src/types.ts:164-168`
**Issue:** Defined, exported, never consumed. Dead type.
**Suggestion:** Delete it.

---

### [P2] `finally` block re-enables destroyed DOM nodes; error path confusion
**File:** `public/dashboard.html:1788-1792`
**Issue:** On success, `btn`/`dropdown` are detached after re-render (no-op). On error, they are still valid and correctly re-enabled. Logic is correct but confusing.
**Suggestion:** Re-render panel in `.catch()` for fresh controls, simplify `finally` to just reset `savingOutcomeForId`.

---

### [P3] Inline style in Insights pricing section
**File:** `public/dashboard.html` (renderInsights)
**Issue:** Inline `style="display:flex;gap:24px;..."` while every other element uses CSS classes.
**Suggestion:** Add `.pricing-row` class or leave it — cosmetic.
