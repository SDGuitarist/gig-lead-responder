# Batch 3 — Code Quality and Abstractions Results

**Branch:** feat/lead-conversion-tracking
**Date:** 2026-02-25
**Commit:** (pending)

### Prior Phase Risk

> "The B-5 fix (rejecting inapplicable sub-fields) adds new 400 responses that the dashboard's `apiPost` error handler needs to display. The dashboard currently shows a generic error toast — if the error messages aren't surfaced clearly, users won't know why their save failed. Batch C should verify the dashboard's error handling path covers this."

Verified: the dashboard's `.catch(function (err) { alert('Save failed: ' + err.message); })` handler on the outcome save calls `apiPost`, which rejects with the JSON error body's `.error` field. The 400 messages from B-5 ("actual_price is only applicable when outcome is booked") will appear in the alert. No change needed — the existing path surfaces them clearly.

## Rejected Findings (4)

- **C-1 (`as` cast → type guards):** The `as` casts in api.ts (lines 221, 242) occur immediately after `Set.has()` validation, which confirms the value is a member of the target type. A type guard would add code without changing runtime behavior. Rejected — the cast is safe post-validation.
- **C-3 (`getAnalytics()` split):** Moving analytics query code from `leads.ts` to a separate file would scatter related DB queries across files for no functional benefit. The function is one cohesive unit: 3 queries in a transaction. Rejected — churn, not improvement.
- **C-4 (targeted DOM update instead of full re-render):** The outcome save handler re-renders the full detail panel + calls `renderTable`/`renderMobile`. For v1 with <100 leads, this is fine. A targeted update would add complexity for negligible perf gain. Rejected — premature optimization.
- **C-5 (`finally` block restructure):** The `finally` block resets `savingOutcome`, re-enables the button, and re-enables the dropdown. This runs correctly on both success and error paths. The reviewer saw "confusion" but the behavior is correct. Rejected — no bug, no clarity gain.

## Changes Made

### C-2: Const arrays as single source of truth for outcomes/reasons
**File:** `src/types.ts:161-165`
**What changed:** Replaced `type LeadOutcome = "booked" | "lost" | "no_reply"` with `const LEAD_OUTCOMES = [...] as const` + derived type. Same for `LossReason` → `LOSS_REASONS`. Now the string values exist in exactly one place — the const array — and the type is derived from it.
**Why:** Prevents the values from drifting between `types.ts` and `api.ts`. Adding an outcome now means adding it to one array.

---

### C-7: `Set<LeadOutcome>` replaces `Set<string>` in api.ts
**File:** `src/api.ts:198-199`
**What changed:** `VALID_OUTCOMES` and `VALID_LOSS_REASONS` now use `new Set<LeadOutcome>(LEAD_OUTCOMES)` and `new Set<LossReason>(LOSS_REASONS)` instead of duplicating the string values. The `.has()` calls use `ReadonlySet<string>` cast since the input is unvalidated `req.body`.
**Why:** Single source of truth (depends on C-2). If `LEAD_OUTCOMES` changes, the Sets update automatically.

---

### C-6: Missing `outcome` index
**File:** `src/leads.ts:80`
**What changed:** Added `CREATE INDEX IF NOT EXISTS idx_leads_outcome ON leads(outcome)`. The `getAnalytics()` queries filter on `outcome IS NOT NULL` and `outcome = 'booked'` — this index supports both.
**Why:** Analytics queries scan the `outcome` column. Without an index, every query is a full table scan.

---

### C-8: Missing `source_platform` index
**File:** `src/leads.ts:81`
**What changed:** Added `CREATE INDEX IF NOT EXISTS idx_leads_source_platform ON leads(source_platform)`. The by-platform analytics query groups on this column.
**Why:** Same reasoning as C-6 — the GROUP BY on `source_platform` benefits from an index.

---

### C-9: Body size limit on JSON parser
**File:** `src/server.ts:18`
**What changed:** `express.json()` → `express.json({ limit: "100kb" })`. Express default is 100kb anyway, but making it explicit documents the intent and prevents surprises if the default changes.
**Why:** Defense-in-depth. The largest expected body is the outcome POST (~200 bytes).

---

### C-10: `savingOutcomeForId` → `savingOutcome` rename
**File:** `public/dashboard.html:1719, 1745, 1746, 1789`
**What changed:** Renamed the in-flight gate variable from `savingOutcomeForId` to `savingOutcome`. The variable stores an ID (or null), and the "ForId" suffix was redundant — it's clear from context that it tracks which lead is being saved.
**Why:** Cleaner name. The "ForId" suffix added nothing; the usage pattern (`savingOutcome = id` / `savingOutcome = null`) is self-documenting.

---

### C-11: `database` → `db` naming consistency in `getAnalytics`
**File:** `src/leads.ts:316-357`
**What changed:** Renamed the local `database` variable to `db` inside `getAnalytics()`. Every other function in this file uses `initDb()` inline or the module-level `db`. This function was the only one using a different name.
**Why:** Consistency with the rest of the file.

---

### C-12: Read-only transaction comment
**File:** `src/leads.ts:316`
**What changed:** Updated JSDoc comment from "3 queries in a read transaction" to "3 queries in a read-only transaction." The transaction wraps 3 SELECT queries — no writes.
**Why:** Clarifies intent. A reader might wonder why SELECTs are wrapped in a transaction; "read-only" signals it's for snapshot consistency, not atomicity.

---

### C-13: CHECK constraint SYNC comments
**File:** `src/leads.ts:40-41, 68-71`
**What changed:** Added `-- SYNC: LEAD_OUTCOMES in types.ts` and `-- SYNC: LOSS_REASONS in types.ts` comments next to the CHECK constraints in both the CREATE TABLE and ALTER TABLE migration statements.
**Why:** The CHECK constraint values must match the const arrays in `types.ts`. These comments flag the dependency so future changes to `LEAD_OUTCOMES` trigger a schema review.

---

### C-14: `analyzeKvHTML` label escaping
**File:** `public/dashboard.html:1947`
**What changed:** Wrapped `p[0]` (the label) with `esc()` in `analyzeKvHTML`. Previously only the value (`p[1]`) was caller-escaped; labels were inserted raw. All current callers pass hardcoded strings, but the function signature accepts arbitrary pairs.
**Why:** Defense-in-depth. If a future caller passes a dynamic label, it won't be an XSS vector.

---

### C-15: Inline style → CSS class in `renderInsights`
**File:** `public/dashboard.html:712-717, 1873`
**What changed:** Replaced `style="display:flex;gap:24px;font-size:14px;color:#2c2419;"` on the pricing row with a new `.insights-prices` CSS class. All other Insights elements already use classes.
**Why:** Consistency. The rest of the Insights UI is styled with classes; this was the one inline holdout.

## Deferred to Later Batch

- Nothing deferred — all accepted findings completed.

## Three Questions

### 1. Hardest fix in this batch?

C-2 + C-7 together. The const array → derived type pattern (`const LEAD_OUTCOMES = [...] as const; type LeadOutcome = (typeof LEAD_OUTCOMES)[number]`) is straightforward, but the downstream effect — `Set<LeadOutcome>.has()` rejecting `string` arguments — required a `ReadonlySet<string>` cast at the `.has()` call site. The alternative was keeping `Set<string>` (defeats the purpose) or adding a type guard function (overkill for two call sites).

### 2. What did you consider fixing differently, and why didn't you?

For C-7, considered adding a `isLeadOutcome(s: string): s is LeadOutcome` type guard instead of the `ReadonlySet<string>` cast. It would eliminate the cast and give TypeScript full narrowing. Didn't do it because: (1) the guard would be 3 lines wrapping the same `.has()` call, (2) the cast is only used in two places, and (3) adding a type guard for a 3-value enum is over-abstraction.

### 3. Least confident about going into the next batch or compound phase?

The C-13 SYNC comments are only as good as the developer remembering to check them. If someone adds a new outcome value to `LEAD_OUTCOMES` but doesn't update the CHECK constraints, the DB will reject the insert at runtime. A proper fix would be generating the CHECK constraint from the const array, but that's a schema migration pattern change — well beyond this batch's scope.
