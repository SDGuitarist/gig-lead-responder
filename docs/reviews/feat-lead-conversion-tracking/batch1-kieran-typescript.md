# Kieran TypeScript Reviewer — Review Findings

**Agent:** kieran-typescript-reviewer
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Findings

### [P1] `_pendingOutcome` mutation hack corrupts shared state if rendering throws
**File:** `public/dashboard.html:1718-1736`
**Issue:** The `change` handler temporarily mutates `lead.outcome` on the shared `currentLeads` object to trick `renderDetailPanel` into rendering the correct sub-fields, then restores it. If `renderDetailPanel` throws, `lead.outcome` is permanently corrupted. The `_pendingOutcome` property is dynamically added/deleted from a typed object.
**Suggestion:** Create a shallow copy instead: `var renderLead = Object.assign({}, lead, { outcome: sel.value || null });` and pass that to `renderDetailPanel`. No mutation, no restore, no corruption risk.

---

### [P2] Orphaned `renderDetailPanel(updated)` call does nothing
**File:** `public/dashboard.html:1773`
**Issue:** `renderDetailPanel(updated)` called as bare statement — returns HTML string but doesn't inject it anywhere. Actual DOM update happens on lines 1775-1779. Dead code.
**Suggestion:** Delete line 1773.

---

### [P2] `OutcomeUpdateBody` is defined but never imported or used
**File:** `src/types.ts:164-168`
**Issue:** Exported interface never referenced in `api.ts` or anywhere else. Dead code.
**Suggestion:** Remove it, or use it to type the destructured body.

---

### [P2] `AnalyticsBreakdown` imported but never used in leads.ts
**File:** `src/leads.ts:4`
**Issue:** Imported but never directly referenced — TypeScript resolves the nested type through `AnalyticsResponse`.
**Suggestion:** Remove `AnalyticsBreakdown` from the import.

---

### [P2] `VALID_OUTCOMES` and `VALID_LOSS_REASONS` typed as `Set<string>` instead of union types
**File:** `src/api.ts:197-198`
**Issue:** Typed as `Set<string>` — misses compile-time sync check if enum values change.
**Suggestion:** Use `new Set<LeadOutcome>(...)` and `new Set<LossReason>(...)`.

---

### [P2] `as` cast after validation instead of type guard narrowing
**File:** `src/api.ts:242-244`
**Issue:** Uses `outcome as LeadOutcome | null` instead of a type guard. Plan called for `isLeadOutcome()` type guard.
**Suggestion:** Add type guards to eliminate all `as` casts in the handler.

---

### [P3] `express.json({ limit: '100kb' })` not added per plan
**File:** `src/server.ts:18`
**Issue:** Plan called for explicit body size limit.
**Suggestion:** Add `express.json({ limit: '100kb' })`.

---

### [P3] `finally` block re-enables possibly destroyed DOM nodes
**File:** `public/dashboard.html:1788-1792`
**Issue:** After `renderTable`/`renderMobile` rebuild DOM, `btn` and `dropdown` point to detached nodes. Harmless but confusing.
**Suggestion:** Add a clarifying comment.

---

### [P3] Save success re-renders full table, may collapse open detail panels
**File:** `public/dashboard.html:1782-1783`
**Issue:** `renderTable(currentLeads)` rebuilds entire table. The detail re-render on lines 1775-1779 is then destroyed.
**Suggestion:** Verify `expandedId` is preserved across re-renders.
