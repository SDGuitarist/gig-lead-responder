---
title: "feat: Lead Conversion Tracking"
type: feat
status: active
date: 2026-02-25
deepened: 2026-02-25
origin: docs/brainstorms/2026-02-25-lead-conversion-tracking-brainstorm.md
feed_forward:
  risk: "Small dataset may make analytics noisy — conversion rates and breakdowns by platform/format might be misleading with only a handful of leads"
  verify_first: true
---

# feat: Lead Conversion Tracking

## Enhancement Summary

**Deepened on:** 2026-02-25
**Agents used:** 10 (TypeScript reviewer, performance oracle, security sentinel, data integrity guardian, architecture strategist, pattern recognition specialist, frontend races reviewer, code simplicity reviewer, data migration expert, best practices researcher)

### Key Improvements from Deepening

1. **Type safety fix** — `LeadRecord.outcome` typed as `LeadOutcome | null` (not `string | null`), matching how `status: LeadStatus` is already typed. Same for `outcome_reason: LossReason | null`.
2. **CHECK constraints added** — SQLite 3.51.2 (bundled by better-sqlite3) supports CHECK on ALTER TABLE ADD COLUMN. Added for `outcome`, `outcome_reason`, and `actual_price`.
3. **Dedicated `setLeadOutcome()` function** — Encapsulates sub-field cleanup so no code path can bypass it.
4. **Tab-switching bug fixed** — Binary toggle logic would show two panels simultaneously. Rewritten to generic "hide all, show one" pattern.
5. **POST instead of PATCH** — Consistency with existing API (all mutations use POST). Eliminates need for `apiPatch()` helper.
6. **Frontend race condition guards** — In-flight gate prevents rapid-fire saves. Dropdown disabled during save.
7. **Simplified analytics** — Consolidated 5 SQL queries to 3 (wrapped in read transaction). Cut `by_competition` and `speed_vs_conversion` from v1. Removed cache system — refetch on every tab click.
8. **Simplified thresholds** — 2-tier system: under 5 leads shows fraction only; 5+ shows percentage + fraction. No "Other" bucketing.
9. **Pre-existing bug found** — `CREATE INDEX` on `confidence_score` (line 46) references column not in CREATE TABLE. Fix alongside this feature.

### Simplification Decisions

| Original Plan | Changed To | Why |
|--------------|-----------|-----|
| PATCH method | POST | Consistent with existing API, no new `apiPatch()` helper |
| 5 SQL queries | 3 queries in a read transaction | First 3 merge cleanly; snapshot consistency |
| `by_competition` breakdown | Cut from v1 | Not enough data, easy to add later |
| `speed_vs_conversion` metric | Cut from v1 | Needs 5+ booked AND 5+ lost — months away |
| Analytics cache + invalidation | Refetch on every tab click | <5ms query on small dataset, eliminates stale-data bugs |
| Per-metric threshold matrix | 2-tier: fraction only (<5) or pct+fraction (5+) | Simpler, still honest about sample size |
| Surgical DOM update | Re-render detail panel (existing pattern) | Consistent, avoids phantom-panel race condition |
| `outcome: string \| null` | `outcome: LeadOutcome \| null` | Type safety — matches `status: LeadStatus` pattern |

---

## Overview

Add a feedback loop that tracks what happens after the pipeline sends a response. The dashboard gets outcome controls (Booked / Lost / No Reply) on each lead card, a new **Insights** tab with conversion analytics, and a visual nudge for stale leads needing attention.

This is the foundation for Follow-Up Sequences (next feature cycle) — you can't automate follow-ups without knowing which leads are still open.

## Prior Phase Risk

> "Least confident: Whether the Analyze tab analytics will be useful with a small dataset. With only a handful of leads so far, conversion rates and breakdowns by platform/format might be noisy or misleading."

**How this plan addresses it:** Two-tier display system. Under 5 leads with outcomes: show raw fractions only ("2 of 3 booked"), no percentages. 5+ leads: show percentage + fraction ("38% — 3 of 8 booked"). Breakdown rows with fewer than 3 leads are visually de-emphasized (reduced opacity) rather than hidden — the user sees data is thin without it feeling broken. This follows the Stripe Dashboard pattern of "always show, never mislead."

## Problem Statement / Motivation

The pipeline lifecycle ends at "done" (draft approved and sent). There's no record of whether a quote turned into a booking. Without this data you can't calculate conversion rates, compare platforms, evaluate pricing strategy, or build follow-up automation (see brainstorm: `docs/brainstorms/2026-02-25-lead-conversion-tracking-brainstorm.md`).

## Proposed Solution

Four changes, each building on the previous:

1. **Schema + types** — 4 new columns on `leads` table (with CHECK constraints), new TypeScript types + interfaces
2. **API** — `POST /api/leads/:id/outcome` + `GET /api/analytics` endpoints
3. **Dashboard: outcome controls** — dropdown + sub-fields in detail panel, badge on summary row, visual nudge for stale leads
4. **Dashboard: Insights tab** — new 4th tab with conversion analytics

## Brainstorm Correction

The brainstorm says "The dashboard already has an empty Analyze tab with placeholder text." This is incorrect — the Analyze tab is a fully functional pipeline analysis tool (paste lead text → run 5-stage analysis). **This plan adds a new 4th tab called "Insights"** rather than repurposing the Analyze tab.

## Technical Considerations

### Architecture

- **No new tables.** 4 columns added to existing `leads` table via the established migration pattern in `src/leads.ts:55-69` (see brainstorm).
- **Outcome is separate from status.** `LeadStatus` stays unchanged. A lead can be `done` (pipeline finished) AND `booked` (business outcome).
- **Outcomes are editable.** A lead marked "No Reply" can later become "Booked." `outcome_at` tracks the most recent change (see brainstorm decision #6).
- **CHECK constraints at DB level.** SQLite 3.51.2 (bundled by better-sqlite3) supports CHECK on ALTER TABLE ADD COLUMN. Both migration and CREATE TABLE paths get identical constraints. (Data integrity guardian finding.)
- **Dedicated `setLeadOutcome()` function.** Sub-field cleanup (clearing actual_price when not booked, clearing outcome_reason when not lost) is encapsulated in one function in `src/leads.ts`. The API endpoint calls this, never `updateLead()` directly for outcome fields. (Data integrity guardian finding.)

### Edge Cases Resolved (from SpecFlow analysis)

| Edge Case | Decision | Rationale |
|-----------|----------|-----------|
| **Sub-field cleanup on outcome change** | `setLeadOutcome()` always clears both sub-fields, then sets only the relevant one | Single enforcement point — impossible to bypass |
| **Status gating** | Only `done` leads can have outcomes set (API returns 400 for others) | You can't have a business outcome on a lead you never quoted |
| **Clearing outcomes** | Allowed — dropdown has a "No Outcome" option that POSTs `outcome: null` | Accidents need an undo path |
| **outcome_reason validation** | API validates via `Set.has()` against enum: `price \| competitor \| cancelled \| other` | Matches existing `VALID_STATUSES` pattern in api.ts:80 |
| **actual_price validation** | `typeof === 'number'` + `Number.isFinite()` + `> 0` + `< 100000` | Rejects NaN, Infinity, strings, negatives (security sentinel finding) |
| **Nudge timestamp** | `sms_sent_at` with fallback to `updated_at` | Most accurate measure of "when the client got the quote" |
| **Nudge scope** | Only `done` leads, not `sent` or `failed` | `sent` = quote not delivered yet; `failed` = pipeline errored |
| **Nudge threshold** | `>= 7 days` (inclusive) | Simple, consistent |
| **Nudge drift on long-lived tabs** | Recompute on `visibilitychange` event | No setInterval needed — page refreshes stale indicators when user returns (frontend races finding) |
| **Conversion rate denominator** | booked / total with outcomes, displayed as "3 of 8 tracked" + separate "X leads untracked" count | Honest about the sample |
| **Analytics time range** | All-time only for v1 | Not enough data yet to warrant filters |

### Performance

All analytics queries run on a small SQLite dataset (dozens to low hundreds of leads). No indexing or caching needed. The analytics endpoint is lazy-loaded on Insights tab click, refetched every time (no cache — query completes in <5ms). Wrap the 3 analytics queries in a read transaction for snapshot consistency. (Performance oracle finding.)

### Security

- `POST /api/leads/:id/outcome` is behind existing `basicAuth` middleware
- Add `express.json({ limit: '100kb' })` for explicit body size limit (security sentinel finding)
- `actual_price` validated with `typeof`, `Number.isFinite()`, and bounds (security sentinel finding)
- `outcome` and `outcome_reason` validated via `Set.has()` against known enum values — no freeform input stored

## Implementation Phases

### Phase 1: Schema + Types

**Files:** `src/types.ts`, `src/leads.ts`

**`src/types.ts` changes:**

Add new types:

```ts
export type LeadOutcome = "booked" | "lost" | "no_reply";
export type LossReason = "price" | "competitor" | "cancelled" | "other";
```

Add 4 fields to `LeadRecord` (required-nullable, using the union types for compile-time safety — matching how `status: LeadStatus` is typed):

```ts
// In LeadRecord interface (after done_reason)
outcome: LeadOutcome | null;
outcome_reason: LossReason | null;
actual_price: number | null;
outcome_at: string | null;
```

Add same 4 fields to `LeadApiResponse` (same types).

Add request body type for the outcome endpoint:

```ts
interface OutcomeUpdateBody {
  outcome: LeadOutcome | null;
  actual_price?: number;
  outcome_reason?: LossReason;
}
```

Add analytics response type:

```ts
interface AnalyticsBreakdown {
  label: string;  // platform name, format name
  total: number;
  booked: number;
  rate: number;
}

interface AnalyticsResponse {
  total_leads: number;
  total_with_outcome: number;
  total_untracked: number;
  booked: number;
  lost: number;
  no_reply: number;
  conversion_rate: number;
  revenue: number;
  avg_quote_price: number | null;
  avg_actual_price: number | null;
  by_platform: AnalyticsBreakdown[];
  by_format: AnalyticsBreakdown[];
}
```

#### Research Insights (TypeScript reviewer)

- Use `LeadOutcome | null` not `string | null` — the compiler catches `updateLead(id, { outcome: "typo" })` at compile time.
- `updateLead()` accepts `Partial<Omit<LeadRecord, "id" | "created_at">>` — the new fields work correctly. But the API should call `setLeadOutcome()` instead.
- Use a type guard for runtime validation: `function isLeadOutcome(value: unknown): value is LeadOutcome`.
- `AVG()` and `json_extract()` return `number | null` from SQLite — handle in the TypeScript layer.

**`src/leads.ts` changes:**

1. Add 4 columns to `migrations` array (lines 59-68) **with CHECK constraints**:
   ```ts
   ["outcome", "TEXT CHECK(outcome IN ('booked','lost','no_reply'))"],
   ["outcome_reason", "TEXT CHECK(outcome_reason IN ('price','competitor','cancelled','other'))"],
   ["actual_price", "REAL CHECK(actual_price IS NULL OR actual_price > 0)"],
   ["outcome_at", "TEXT"],
   ```

2. Add 4 columns to `CREATE TABLE IF NOT EXISTS` statement (for fresh installs) — with matching CHECK constraints.

3. Add 4 columns to `UPDATE_ALLOWED_COLUMNS` set (line 144).

4. **Fix pre-existing bug:** Move `CREATE INDEX IF NOT EXISTS idx_leads_confidence` (line 46) to AFTER the migration block, so `confidence_score` column exists before the index is created. (Data migration expert finding.)

5. Add `setLeadOutcome()` function:
   ```ts
   export function setLeadOutcome(
     id: number,
     outcome: LeadOutcome | null,
     options?: { outcome_reason?: LossReason; actual_price?: number },
   ): LeadRecord | undefined {
     const fields: Partial<Omit<LeadRecord, "id" | "created_at">> = {
       outcome,
       outcome_at: outcome !== null ? new Date().toISOString() : null,
       // Always clear both sub-fields, then set only the relevant one
       actual_price: null,
       outcome_reason: null,
     };
     if (outcome === "booked" && options?.actual_price != null) {
       fields.actual_price = options.actual_price;
     }
     if (outcome === "lost" && options?.outcome_reason) {
       fields.outcome_reason = options.outcome_reason;
     }
     return updateLead(id, fields);
   }
   ```

#### Research Insights (data integrity guardian)

- CHECK constraints are supported — SQLite 3.51.2 (confirmed via `better-sqlite3/deps/sqlite3/sqlite3.h`). Matches the existing `CHECK(status IN (...))` on line 30.
- `setLeadOutcome()` is the single enforcement point for sub-field invariants. The API endpoint calls this, never `updateLead()` directly.
- `REAL` for `actual_price` is fine — IEEE 754 doubles represent whole-dollar amounts exactly in the $200-$2000 range. No accounting precision needed.

### Phase 2: API Endpoints

**Files:** `src/api.ts`, `src/leads.ts`

**`POST /api/leads/:id/outcome`** — set or clear an outcome. Uses POST (not PATCH) for consistency with existing `POST /approve` and `POST /edit` endpoints.

Request body:
```json
{ "outcome": "booked", "actual_price": 700 }
{ "outcome": "lost", "outcome_reason": "price" }
{ "outcome": "no_reply" }
{ "outcome": null }
```

Validation rules:
1. `id` must be valid integer → 400
2. Lead must exist → 404
3. Lead status must be `done` → 400 "Lead must be in done status to set outcome"
4. `outcome` must be one of `booked | lost | no_reply | null` → 400 (validate via `VALID_OUTCOMES` Set + `isLeadOutcome()` type guard)
5. If `outcome = booked`: accept optional `actual_price` — `typeof === 'number'` + `Number.isFinite()` + `> 0` + `< 100000`
6. If `outcome = lost`: accept optional `outcome_reason` — validate via `VALID_LOSS_REASONS` Set
7. Call `setLeadOutcome(id, outcome, { actual_price, outcome_reason })` — sub-field cleanup is handled inside
8. Return `shapeLead(updated)` (consistent with all other endpoints)

**Validation constants** (matching existing `VALID_STATUSES` pattern at api.ts:80):
```ts
const VALID_OUTCOMES = new Set<string>(["booked", "lost", "no_reply"]);
const VALID_LOSS_REASONS = new Set<string>(["price", "competitor", "cancelled", "other"]);
```

**`shapeLead()` update** — pass through the 4 new fields from `LeadRecord` to `LeadApiResponse`. No JSON parsing needed — they're direct columns:
```ts
outcome: lead.outcome,
outcome_reason: lead.outcome_reason,
actual_price: lead.actual_price,
outcome_at: lead.outcome_at,
```

**`GET /api/analytics`** — conversion analytics for the Insights tab.

**`src/leads.ts`: `getAnalytics()` function** — 3 SQL queries wrapped in a read transaction for snapshot consistency:

```ts
function getAnalytics(): AnalyticsResponse {
  return initDb().transaction(() => {
    // Query 1: Core counts + revenue + avg prices (merged from original 3)
    const core = db.prepare(`
      SELECT
        COUNT(*) AS total_leads,
        SUM(CASE WHEN outcome IS NOT NULL THEN 1 ELSE 0 END) AS total_with_outcome,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked,
        SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) AS lost,
        SUM(CASE WHEN outcome = 'no_reply' THEN 1 ELSE 0 END) AS no_reply,
        SUM(CASE WHEN outcome = 'booked' AND actual_price IS NOT NULL
            THEN actual_price ELSE 0 END) AS revenue,
        AVG(CASE WHEN outcome = 'booked' AND actual_price IS NOT NULL
            THEN actual_price END) AS avg_actual_price,
        AVG(CASE WHEN outcome IS NOT NULL AND pricing_json IS NOT NULL
            THEN json_extract(pricing_json, '$.quote_price') END) AS avg_quote_price
      FROM leads
      WHERE status IN ('sent', 'done')
    `).get();

    // Query 2: By platform
    const byPlatform = db.prepare(`
      SELECT source_platform AS label, COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE outcome IS NOT NULL
      GROUP BY source_platform
    `).all();

    // Query 3: By format (from classification_json)
    const byFormat = db.prepare(`
      SELECT json_extract(classification_json, '$.format_recommended') AS label,
        COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'booked' THEN 1 ELSE 0 END) AS booked
      FROM leads WHERE outcome IS NOT NULL AND classification_json IS NOT NULL
      GROUP BY label
    `).all();

    // Assemble response...
  })();
}
```

#### Research Insights (performance oracle)

- 3 queries on <500 rows: under 5ms combined. No optimization needed.
- Read transaction guarantees snapshot consistency — prevents a rare edge case where a row changes between queries.
- `json_extract()` is fast on small datasets. No need to denormalize `quote_price`.
- `AVG()` ignores NULLs correctly — but add `pricing_json IS NOT NULL` guard to prevent `json_extract` on NULL blobs.
- Skip indexes on `outcome` column — full table scan is faster at this row count.

### Phase 3: Dashboard — Outcome Controls + Nudge

**File:** `public/dashboard.html`

**3a. SYNC constants** — add to the JS constants section (after `STATUS_DISPLAY`):

```js
// SYNC: OUTCOME_DISPLAY must match LeadOutcome type in src/types.ts
var OUTCOME_DISPLAY = {
  booked:   { cls: 'badge-success', label: 'Booked' },
  lost:     { cls: 'badge-danger',  label: 'Lost' },
  no_reply: { cls: 'badge-muted',   label: 'No Reply' }
};

// SYNC: LOSS_REASONS keys must match LossReason type in src/types.ts
var LOSS_REASONS = {
  price:      'Price too high',
  competitor: 'Went with competitor',
  cancelled:  'Event cancelled',
  other:      'Other'
};
```

**3b. Outcome badge on summary rows** — in both `renderTable()` and `renderMobile()`, after the status badge, add an outcome badge if `l.outcome` is set.

**3c. Outcome controls in detail panel** — in `renderDetailPanel()`, add an outcome section below the existing action buttons:

- Dropdown: `-- No Outcome --` | `Booked` | `Lost` | `No Reply`
- Conditional sub-fields:
  - If Booked: `actual_price` number input (placeholder: quote_price if available)
  - If Lost: `outcome_reason` dropdown with the 4 options
- Save button (calls `POST /api/leads/:id/outcome`)
- Pre-populate from existing `l.outcome` / `l.outcome_reason` / `l.actual_price`
- Use `data-outcome-save="ID"` for event delegation (per `docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md`)

**3d. Visual nudge for stale leads** — a small amber "Needs outcome" micro-badge on summary rows for leads where:
  - `status === 'done'`
  - `outcome === null`
  - `sms_sent_at` (or fallback `updated_at`) is >= 7 days ago

Recompute on `visibilitychange` event (no polling):
```js
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) { renderTable(currentLeads); renderMobile(currentLeads); }
});
```

**3e. API integration + race condition guards:**

After saving outcome, patch the local `currentLeads` array in-place and re-render the detail panel (existing pattern — do NOT use surgical DOM updates, per pattern recognition specialist).

**In-flight gate** (frontend races finding):
```js
var savingOutcomeForId = null;

function saveOutcome(id, payload) {
  if (savingOutcomeForId !== null) return; // refuse while saving
  savingOutcomeForId = id;

  // Disable dropdown + save button
  var btn = document.querySelector('[data-outcome-save="' + id + '"]');
  var dropdown = document.querySelector('[data-outcome-select="' + id + '"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  if (dropdown) dropdown.disabled = true;

  apiPost('/api/leads/' + id + '/outcome', payload)
    .then(function (updated) {
      // Patch local array, re-render detail panel
      for (var i = 0; i < currentLeads.length; i++) {
        if (currentLeads[i].id === id) { currentLeads[i] = updated; break; }
      }
      renderDetailPanel(updated); // re-render, not surgical update
      // Update summary row badge
      updateRowOutcomeBadge(id, updated.outcome);
    })
    .catch(function (err) {
      alert('Save failed: ' + err.message);
    })
    .finally(function () {
      savingOutcomeForId = null;
      if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
      if (dropdown) dropdown.disabled = false;
    });
}
```

#### Research Insights (frontend races reviewer)

- **In-flight gate**: One boolean prevents rapid-fire saves from interleaving. Disable both the dropdown and Save button during save.
- **Re-render over surgical update**: If the user collapses the panel while save is in-flight, surgical update targets phantom DOM nodes. Re-rendering from `currentLeads` is safe — the detail panel reads fresh data on next expand.
- **Test with Slow 3G throttling**: Open DevTools → Network → Slow 3G, then try saving outcomes on two different leads quickly to verify the gate works.

### Phase 4: Dashboard — Insights Tab

**File:** `public/dashboard.html`

**4a. Tab button** — add after the Analyze tab button:
```html
<button class="tab-btn" data-tab="insights">Insights</button>
```

**4b. Tab panel** — new `<div class="tab-panel" id="panel-insights">`:

**Layer 1 — Glance (always visible):**
- Summary cards row: Conversion Rate, Revenue, Leads Tracked / Untracked
- Conversion rate card: big percentage + small fraction below ("38% — 3 of 8 booked")
- Under 5 leads: fraction only ("2 of 3"), no percentage

**Layer 2 — Scroll to see:**
- By Platform breakdown: simple table with CSS-only bars (`width: N%` on a div)
- By Format breakdown: same pattern
- Rows with < 3 leads de-emphasized (opacity: 0.7) not hidden

**CSS-only bar pattern:**
```css
.bar {
  height: 20px;
  background: linear-gradient(90deg, #cf9145, #e0b374);
  border-radius: 3px;
  min-width: 4px;
  transition: width 0.4s ease-out;
}
```

Scale bars relative to the maximum value (so the best performer fills 100% width). This is the Mixpanel pattern — makes comparisons visually clear.

**4c. Tab switching JS** — rewrite to generic "hide all, show one" pattern (fixes bug where binary toggle would show two panels simultaneously):

```js
var ALL_PANELS = ['panel-leads', 'panel-analyze', 'panel-insights'];

function showTab(tab) {
  // Hide all panels
  ALL_PANELS.forEach(function (id) {
    document.getElementById(id).classList.remove('active');
  });

  // Show the right one
  if (tab === 'analyze') {
    document.getElementById('panel-analyze').classList.add('active');
  } else if (tab === 'insights') {
    document.getElementById('panel-insights').classList.add('active');
    loadInsights(); // lazy load
  } else {
    document.getElementById('panel-leads').classList.add('active');
    if (tab === 'queue') setFilter('pending');
    else if (tab === 'all') setFilter('all');
  }

  // Update active button
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tab);
  });
}
```

**4d. Data loading** — refetch `GET /api/analytics` on every Insights tab click. No cache. SQLite query is <5ms; caching adds complexity for zero perceived benefit and introduces stale-data bugs.

**4e. Analytics thresholds** — simplified 2-tier system:

| Lead Count | Display |
|-----------|---------|
| 0 outcomes | "No outcomes recorded yet — mark leads as Booked, Lost, or No Reply to see conversion stats" |
| 1-4 outcomes | Fractions only: "2 of 3 booked." No percentages. Global note: "Based on N leads" |
| 5+ outcomes | Percentage + fraction: "38% — 3 of 8 booked" |
| Breakdown row < 3 leads | Row shown with reduced opacity (0.7), no bar, fraction only |

#### Research Insights (best practices researcher)

- **Always show the denominator.** "38%" alone is meaningless. "3 of 8" communicates both the rate and the confidence.
- **De-emphasize, don't hide.** Stripe and Plausible dim low-confidence data (opacity) rather than removing it. Hiding feels broken; dimming communicates "thin data."
- **Progressive disclosure.** Summary cards at top (glance), breakdowns below (scroll). Response speed and competition-level breakdowns are cut from v1 — add as expandable sections in a future cycle.
- **CSS-only bars.** Scale bars relative to the max value in the set (not absolute 0-100%). A 50% rate that is the best among platforms should fill the full bar width.
- **Loading skeleton.** Use a CSS shimmer animation instead of a spinner — perceived load time feels faster.

## System-Wide Impact

- **Interaction graph**: `POST outcome` → `setLeadOutcome()` → `updateLead()` → SQLite write. No callbacks, no middleware beyond auth. Analytics endpoint is read-only.
- **Error propagation**: Validation errors return 400 with message. DB errors propagate as 500. No retry concerns — all writes are synchronous single-statement.
- **State lifecycle risks**: `setLeadOutcome()` is the single enforcement point for sub-field cleanup. CHECK constraints at DB level are the safety net. `outcome_at` tracks last change. No partial-failure risk (single UPDATE statement is atomic).
- **API surface parity**: The new POST endpoint follows the exact same patterns as `POST /approve` and `POST /edit`. `shapeLead()` remains the single response shaper.
- **Integration test scenarios**: (1) Set booked → change to lost → verify actual_price cleared. (2) Set outcome on received lead → verify 400. (3) Load insights with 0 outcomes → verify empty state message. (4) Rapid-fire saves → verify in-flight gate blocks second save.

## Acceptance Criteria

### Phase 1: Schema + Types
- [ ] 4 new columns exist in leads table (fresh install and migration)
- [ ] CHECK constraints on `outcome`, `outcome_reason`, and `actual_price`
- [ ] `LeadOutcome`, `LossReason`, `OutcomeUpdateBody`, `AnalyticsResponse` types defined
- [ ] `LeadRecord` has 4 new required-nullable fields with union types
- [ ] `LeadApiResponse` has 4 new required-nullable fields with union types
- [ ] `UPDATE_ALLOWED_COLUMNS` includes all 4 new columns
- [ ] `setLeadOutcome()` function encapsulates sub-field cleanup
- [ ] Pre-existing bug fixed: `idx_leads_confidence` moved after migrations

### Phase 2: API
- [ ] `POST /api/leads/:id/outcome` sets outcome with validation
- [ ] Validation uses `Set.has()` pattern + type guard + `Number.isFinite()`
- [ ] `setLeadOutcome()` called (never `updateLead()` directly for outcome)
- [ ] Status gating: returns 400 for non-done leads
- [ ] `shapeLead()` includes outcome fields in response
- [ ] `GET /api/analytics` returns metrics from 3 queries in read transaction
- [ ] Analytics handle NULL values and empty datasets without errors
- [ ] `express.json({ limit: '100kb' })` added

### Phase 3: Dashboard Outcome Controls
- [ ] Outcome dropdown in detail panel with conditional sub-fields
- [ ] Outcome badge on summary rows (table + mobile)
- [ ] Visual nudge indicator on stale done leads (7+ days, no outcome)
- [ ] Nudge refreshes on `visibilitychange` (no polling)
- [ ] In-flight gate prevents rapid-fire saves
- [ ] Dropdown + save button disabled during save
- [ ] Save → POST → patch currentLeads → re-render detail panel (existing pattern)
- [ ] Pre-populates existing outcome data when expanding a lead
- [ ] SYNC comments on OUTCOME_DISPLAY and LOSS_REASONS

### Phase 4: Dashboard Insights Tab
- [ ] New "Insights" tab button and panel
- [ ] Tab switching rewritten to generic "hide all, show one" pattern
- [ ] Summary cards: conversion rate (pct + fraction), revenue, tracked/untracked
- [ ] 2-tier threshold: fraction only (<5), pct + fraction (5+)
- [ ] Breakdown tables: by platform, by format — with CSS-only bars
- [ ] Low-data rows de-emphasized (opacity), not hidden
- [ ] Refetches analytics on every tab click (no cache)
- [ ] Loading skeleton animation while fetching

## Success Metrics

- User can mark outcomes on all done leads within 30 seconds each
- Insights tab loads in < 500ms (SQLite query on small dataset)
- All 4 test leads can have outcomes set and changed without errors
- Rapid-fire save attempts are blocked (in-flight gate)

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Small dataset makes analytics noisy | 2-tier threshold system: fraction only (<5), pct+fraction (5+). Low-data rows dimmed. |
| Dashboard HTML is 1400+ lines (one file) | Changes are additive. Tab-switching refactored to generic pattern. Post-ship: consider extracting Insights JS to separate file. |
| `json_extract()` in analytics SQL | SQLite 3.51.2 bundled by better-sqlite3. Tested via `pragma("table_info(leads)")` approach. |
| CHECK constraint on ALTER TABLE | Verified: SQLite 3.51.2 supports it (above 3.37.0 threshold). |
| Pre-existing bug: phantom index on confidence_score | Fixed as part of Phase 1 — move index creation after migration block. |
| Frontend race conditions | In-flight gate + disabled controls + re-render pattern (not surgical DOM). |

## Implementation Order (Work Phase Sessions)

The 4 phases map to 2 work sessions:

1. **Session 1**: Phase 1 (schema + types) + Phase 2 (API endpoints) — backend complete, testable via curl
2. **Session 2**: Phase 3 (outcome controls + nudge) + Phase 4 (Insights tab) — all dashboard work together

Each session should produce working, committable code. Phase 1+2 together because the API is untestable without the schema. Phase 3+4 together because the tab-switching refactor (needed for Phase 4) should happen in the same session as the outcome controls.

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-25-lead-conversion-tracking-brainstorm.md](docs/brainstorms/2026-02-25-lead-conversion-tracking-brainstorm.md) — Key decisions: columns on leads table (not separate table), detailed outcomes with optional sub-fields, outcomes are editable, dashboard-only input.

### Internal References

- Migration pattern: `src/leads.ts:55-69`
- API endpoint pattern: `src/api.ts:103-153` (approve endpoint)
- UPDATE whitelist: `src/leads.ts:144-151`
- shapeLead helper: `src/api.ts:22-72`
- Tab switching JS: `public/dashboard.html:1386-1404`
- Detail panel render: `public/dashboard.html:1077-1165`
- VALID_STATUSES pattern: `src/api.ts:80`
- Required-nullable typing: `docs/solutions/logic-errors/required-nullable-vs-optional-types.md`
- DOM toggle pattern: `docs/solutions/ui-bugs/targeted-dom-toggle-data-attributes.md`
- Atomic claim pattern: `docs/solutions/architecture/atomic-claim-for-concurrent-state-transitions.md`
- Async SQLite boundary: `docs/solutions/database-issues/async-sqlite-transaction-boundary.md`

### Deepening Agents

| Agent | Key Finding |
|-------|------------|
| TypeScript reviewer | Use `LeadOutcome \| null` not `string \| null`; define `OutcomeUpdateBody` + `AnalyticsResponse` interfaces |
| Performance oracle | Wrap queries in read transaction for snapshot consistency; skip cache and indexes |
| Security sentinel | Add `express.json({ limit: '100kb' })`; validate actual_price with `typeof` + `Number.isFinite()` |
| Data integrity guardian | CHECK constraints supported (SQLite 3.51.2); create `setLeadOutcome()` for cleanup invariant |
| Architecture strategist | Generic tab-switching; generalized API helper; `json_extract()` in SQL is correct |
| Pattern recognition specialist | Tab-switch bug (binary toggle breaks with 3 panels); use re-render not surgical DOM; add SYNC comment for LOSS_REASONS |
| Frontend races reviewer | In-flight gate for saves; disable dropdown during save; optimistic cache invalidation; check panel open before DOM update |
| Code simplicity reviewer | POST not PATCH; consolidate SQL queries; cut `by_competition` and `speed_vs_conversion`; kill cache; 2 sessions not 3 |
| Data migration expert | ALTER TABLE safe for all 4 columns; REAL fine for actual_price; pre-existing phantom index bug |
| Best practices researcher | 2-tier threshold display; always show denominator; CSS-only bars; progressive disclosure; loading skeleton |

## Three Questions

1. **Hardest decision in this session?** Whether to gate outcome-setting to only `done` leads or also allow `sent` leads. The brainstorm says "leads in sent or done status" for the visual nudge, which implies both. But `sent` means the pipeline completed but SMS wasn't sent — the client hasn't seen the quote yet. Allowing outcomes on unsent quotes would corrupt conversion analytics ("booked" a gig you never quoted on). Gated to `done` only, which is stricter than the brainstorm suggested but protects data integrity.

2. **What did you reject, and why?** (1) PATCH method — rejected for POST to stay consistent with existing API (all mutations use POST). (2) Analytics cache with invalidation — rejected because the SQLite query is <5ms and caching introduces stale-data race conditions. (3) `by_competition` and `speed_vs_conversion` breakdowns — cut from v1 because they need months of data to be meaningful and add significant JS complexity. (4) Surgical DOM updates — rejected in favor of the existing re-render pattern because collapsed panels create phantom-node race conditions. (5) Per-metric threshold matrix with "Other" bucketing — simplified to 2-tier fraction/percentage system.

3. **Least confident about going into the next phase?** The CHECK constraint on ALTER TABLE ADD COLUMN. The data integrity guardian confirmed SQLite 3.51.2 supports it, but the data migration expert assumed it doesn't. The plan proceeds with CHECK constraints — if they fail at runtime during migration, the fallback is trivial (remove the CHECK clause from the migration tuple, keep application-level validation). Test this in Session 1 before building anything that depends on it.
