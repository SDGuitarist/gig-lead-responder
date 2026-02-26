# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Positive Patterns

- Validation Set pattern mirrors existing `VALID_STATUSES`
- Single response shaper (`shapeLead()`) correctly extended
- `setLeadOutcome()` encapsulates sub-field cleanup — good Facade pattern
- Migration pattern matches existing style with CHECK constraints
- Event delegation with `data-*` attributes consistent with codebase
- SYNC comments on JS constants match established convention
- Tab switching refactor follows Open-Closed Principle

## Findings

### [P1] `_pendingOutcome` mutation hack — shared state corruption risk
**File:** `public/dashboard.html:1725-1736`
**Issue:** Temporarily mutates `lead.outcome` on shared `currentLeads` object. If `renderDetailPanel` throws, state is permanently corrupted. `_pendingOutcome` property is set then deleted but never read — dead code. No `try/finally` around restore.
**Suggestion:** `var preview = Object.assign({}, lead, { outcome: sel.value || null });` — eliminates mutation, restore, and dead property.

---

### [P2] Orphan `renderDetailPanel()` call with no DOM target
**File:** `public/dashboard.html:1773`
**Issue:** Returns HTML string that is thrown away. Same function called again on line 1778 where result is used. Dead code.
**Suggestion:** Delete line 1773.

---

### [P2] `OutcomeUpdateBody` interface defined but never used
**File:** `src/types.ts:164-168`
**Issue:** Exported but never imported or referenced. Dead type.
**Suggestion:** Delete or use to type `req.body`.

---

### [P2] No type guard — uses `as` cast instead
**File:** `src/api.ts:221, 242`
**Issue:** Plan specified `isLeadOutcome()` type guard. Implementation uses `as` cast which bypasses type narrowing.
**Suggestion:** Add type guards.

---

### [P2] Enum values duplicated across 5 locations
**File:** Multiple (types.ts, leads.ts x2, api.ts, dashboard.html)
**Issue:** String literals for outcomes and loss reasons in 5 places. SYNC comments mitigate JS/TS boundary.
**Suggestion:** Export const array from types.ts, derive both type and validation Set from it.

---

### [P3] Global lock naming: `savingOutcomeForId` suggests per-ID but is global
**File:** `public/dashboard.html:1716, 1744`
**Issue:** Name implies per-ID tracking but behavior is a global lock.
**Suggestion:** Rename to `savingOutcome`.

---

### [P3] Naming inconsistency: `database` vs `db` in leads.ts
**File:** `src/leads.ts:305`
**Issue:** New `getAnalytics()` uses `const database = initDb()` while rest of file uses `db` or `initDb()` inline.
**Suggestion:** Use `const db = initDb()` for consistency.

---

### [P3] Client clock used for stale nudge detection
**File:** `public/dashboard.html:1191-1196`
**Issue:** `isStale()` compares server UTC timestamp with `Date.now()`. Wrong client clock = inaccurate nudge.
**Suggestion:** Acceptable for v1. Add comment noting the assumption.
