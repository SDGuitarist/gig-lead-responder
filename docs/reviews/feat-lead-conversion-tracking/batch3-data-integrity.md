# Data Integrity Guardian — Review Findings

**Agent:** compound-engineering:review:data-integrity-guardian
**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Files reviewed:** 4 (src/types.ts, src/leads.ts, src/api.ts, public/dashboard.html)

## Items Verified as Correct (no finding)

- **Migration safety**: ALTER TABLE ADD COLUMN with `existingCols` check is idempotent and safe. CREATE TABLE and ALTER TABLE define identical constraints — no schema drift.
- **Transaction boundary for analytics**: `database.transaction()` ensures consistent snapshot read across all 3 queries.
- **Sub-field cleanup in `setLeadOutcome`**: Lines 291-299 always null both `actual_price` and `outcome_reason` first, then selectively set the relevant one. Prevents stale sub-fields across outcome transitions.
- **NULL default for `outcome`**: New ALTER TABLE columns default to NULL, matching the intended "untracked" state.
- **SQL injection prevention**: `UPDATE_ALLOWED_COLUMNS` whitelist prevents key injection. All queries use parameterized statements.
- **Concurrent save guard**: `savingOutcomeForId` flag prevents double-click race conditions.

## Findings

### [P1] CHECK constraint mismatch between database and API validation for `actual_price`
**File:** `src/leads.ts:42` and `src/api.ts:228`
**Issue:** The database CHECK constraint says `actual_price > 0` (strictly greater than zero), while the API validates `actual_price <= 0` — these agree on rejecting zero. However, the API enforces `actual_price < 100000` as an upper bound, but the database has **no upper bound constraint**. If `setLeadOutcome` or `updateLead` is ever called from a code path other than the API endpoint (future cron job, CLI script, test fixture), the 100k guard is bypassed. Additionally, the TypeScript type (`number | null`) allows `0`, which the database would reject with an opaque SQLite CHECK failure.
**Suggestion:** Add a runtime guard inside `setLeadOutcome` to reject `actual_price <= 0` before reaching the database, so error messages are clear rather than opaque SQLite failures:
```typescript
if (outcome === "booked" && options?.actual_price != null) {
  if (options.actual_price <= 0) {
    throw new Error("actual_price must be positive");
  }
  fields.actual_price = options.actual_price;
}
```

---

### [P2] Analytics queries use inconsistent scope filters — `total_untracked` permanently inflated
**File:** `src/leads.ts:308-349`
**Issue:** Query 1 filters by `WHERE status IN ('sent', 'done')`, so `total_leads` includes `sent` leads that cannot have outcomes (API only allows outcomes on `done` leads). `total_untracked = total_leads - total_with_outcome` is permanently inflated by the count of `sent` leads, showing "X leads untracked" when those leads can't actually be tracked. Queries 2 and 3 filter by `WHERE outcome IS NOT NULL` with **no status filter** — different row population than Query 1.
**Suggestion:** Align all three queries. Since only `done` leads can have outcomes, use `WHERE status = 'done'` in Query 1, and add `AND status = 'done'` to Queries 2 and 3.

---

### [P2] Outcome transition: inapplicable sub-fields silently discarded without API feedback
**File:** `src/api.ts:218-245`
**Issue:** `{ outcome: "no_reply", actual_price: 500 }` passes API validation. `setLeadOutcome` silently discards `actual_price` because outcome is not `"booked"`. User receives no feedback that their input was ignored. Silent data loss from the user's perspective.
**Suggestion:** Return 400 when sub-fields are provided for the wrong outcome type:
```typescript
if (outcome !== "booked" && actual_price != null) {
  res.status(400).json({ error: "actual_price can only be set when outcome is 'booked'" });
  return;
}
```

---

### [P2] `setLeadOutcome` does not validate lead is in `done` status
**File:** `src/leads.ts:282-301`
**Issue:** The API checks `lead.status !== "done"` on line 213, but `setLeadOutcome` itself does not enforce this. As an exported public function, any caller (future webhook, batch script, test) can set an outcome on a `received` or `failed` lead, creating inconsistent data. The database has no constraint preventing this.
**Suggestion:** Add a status guard inside `setLeadOutcome`:
```typescript
const current = getLead(id);
if (!current) return undefined;
if (outcome !== null && current.status !== "done") {
  throw new Error(`Cannot set outcome on lead ${id} with status "${current.status}"`);
}
```

---

### [P3] No index on `outcome` column
**File:** `src/leads.ts:78-79`
**Issue:** Analytics queries filter on `outcome IS NOT NULL` and aggregate by outcome values. No index exists. Low priority at current scale but cheap insurance.
**Suggestion:** Add `db.exec("CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(outcome)");`

---

### [P3] Client-side `_pendingOutcome` temporary mutation
**File:** `public/dashboard.html:1725-1736`
**Issue:** The change handler temporarily mutates `lead.outcome` to re-render sub-fields, then restores original. If `renderDetailPanel` throws, `lead.outcome` is left in wrong state for the session. Synchronous path makes this low-risk but fragile.
**Suggestion:** Use a shallow copy instead of mutating the shared object:
```javascript
var tempLead = Object.assign({}, lead, { outcome: sel.value || null });
panels[k].innerHTML = renderDetailPanel(tempLead);
```
