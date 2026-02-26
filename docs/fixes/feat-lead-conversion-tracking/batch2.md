# Batch 2 — Data Integrity and Hot Path Results

**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Commit:** 7142756

### Prior Phase Risk

> "Batch B has the `_pendingOutcome` shared state fix and the analytics query scoping mismatch — both touch runtime behavior. The analytics query fix (finding B-4) changes what numbers users see, so it needs careful verification that all three sub-queries align on the same WHERE clause."

Addressed: verified all 3 analytics queries now use `WHERE status = 'done'` as the base filter, and the shallow copy replaces mutation entirely (no restore logic needed).

## Changes Made

### B-1: Shared state mutation replaced with shallow copy
**File:** `public/dashboard.html:1722-1733`
**What changed:** Replaced the mutate-render-restore pattern (`lead.outcome = pending; render; lead.outcome = orig; delete _pendingOutcome`) with a single `Object.assign({}, lead, { outcome: sel.value || null })`. The shallow copy `preview` is passed to `renderDetailPanel` — the original `lead` object is never touched.
**Review finding:** P1 — 5 agents flagged this. If `renderDetailPanel` threw, `lead.outcome` would stay corrupted for the session.

---

### B-2: XSS escape on `gate_status`
**File:** `public/dashboard.html:1992`
**What changed:** Wrapped `g.gate_status.toUpperCase()` with `esc()` before interpolation into `innerHTML`. The `gate_status` field originates from LLM JSON output and could contain HTML if the model misbehaves.
**Review finding:** P1 — `gate_status` was the only `analyzeKvHTML` value not going through `esc()`.

---

### B-3: Body guard before `req.body` destructuring
**File:** `src/api.ts:218-221`
**What changed:** Added `if (!req.body || typeof req.body !== "object")` check returning 400 before the `const { outcome, ... } = req.body` destructuring. When `Content-Type` header is missing, Express's `json()` middleware leaves `req.body` as `undefined`.
**Review finding:** P1 — Unhandled exception from destructuring `undefined`.

---

### B-4: Analytics query scoping aligned to `status = 'done'`
**File:** `src/leads.ts:328, 344, 353`
**What changed:** Query 1 changed from `WHERE status IN ('sent', 'done')` to `WHERE status = 'done'`. Queries 2 and 3 added `AND status = 'done'` to their existing `WHERE` clauses. Now all 3 queries operate on the same population: leads that have completed the pipeline and are eligible for outcome tracking.
**Review finding:** P1 — `total_untracked` was permanently inflated by `sent` leads that can never have outcomes.

---

### B-5: Inapplicable sub-fields rejected with 400
**File:** `src/api.ts:247-254`
**What changed:** Added two guards after existing validation: `actual_price` rejected unless outcome is `booked`, `outcome_reason` rejected unless outcome is `lost`. Previously these passed validation and were silently discarded by `setLeadOutcome`.
**Review finding:** P2 — API returned 200 OK while quietly dropping user-provided data.

---

### B-6: Runtime CHECK constraint guard for `actual_price`
**File:** `src/leads.ts:290-292`
**What changed:** Added `Number.isFinite` and `> 0` check on `options.actual_price` at the top of `setLeadOutcome`. This matches the DB's `CHECK(actual_price IS NULL OR actual_price > 0)` constraint, preventing a SQLite error if the function is called directly (bypassing API validation).
**Review finding:** P2 — Exported function had no guard matching the DB constraint.

---

### B-7: Status validation in `setLeadOutcome`
**File:** `src/leads.ts:286-288`
**What changed:** Added `getLead(id)` check at the top of `setLeadOutcome` — returns `undefined` if lead doesn't exist or isn't in `done` status. The API already checks this, but `setLeadOutcome` is exported and could be called from other code paths.
**Review finding:** P2 — Defense-in-depth for an exported function.

## Considered but Rejected

- **Returning error objects from `setLeadOutcome` instead of `undefined`** — Considered having the function return `{ error: "reason" }` for different failure modes (not found, wrong status, invalid price). Rejected because the API layer already provides specific error messages; the storage layer just needs to signal "no" without duplicating error formatting.
- **Adding `try/finally` to the old mutation pattern instead of replacing it** — The review suggested `try/finally` as a minimum fix. Went with shallow copy instead because it eliminates the problem entirely rather than just protecting against it. Fewer lines, no mutation, no restore path.

## Deferred to Later Batch

- Nothing deferred — all Batch B items completed.

## Three Questions

### 1. Hardest fix in this batch?

B-4 (analytics query alignment). Had to trace three separate SQL queries and verify they now share the same row population. The key insight: only `done` leads can have outcomes (API enforces this), so `total_leads` should only count `done` leads. The old `IN ('sent', 'done')` was inflating `total_untracked` by including `sent` leads that are still in the pipeline.

### 2. What did you consider fixing differently, and why didn't you?

For B-7, considered whether the extra `getLead(id)` call in `setLeadOutcome` is wasteful since `updateLead` also calls `getLead(id)` internally. That's two reads for one update. Decided the duplication is acceptable — it's a SQLite read on a small table, and the alternative (restructuring `updateLead` to accept a pre-fetched lead) would be scope creep touching a pre-existing function.

### 3. Least confident about going into the next batch or compound phase?

The B-5 fix (rejecting inapplicable sub-fields) adds new 400 responses that the dashboard's `apiPost` error handler needs to display. The dashboard currently shows a generic error toast — if the error messages aren't surfaced clearly, users won't know why their save failed. Batch C should verify the dashboard's error handling path covers this.
