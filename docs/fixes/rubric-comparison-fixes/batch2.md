# Batch 2 — Data Integrity and Hot Path Results

**Branch:** rubric-comparison-fixes
**Date:** 2026-02-21
**Commits:** 11f50cf, 10e9cfd, 9be5e43, d00f448

## Changes Made

### #3 + #13: Centralize "today" computation in Pacific time
**File:** `src/utils/dates.ts:6-8`, `src/pipeline/classify.ts:9`, `src/pipeline/enrich.ts:8-12`, `src/run-pipeline.ts:69`, `src/enrich-generate.test.ts`
**What changed:** Added `getTodayISO()` to dates.ts using `toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })`. Changed `classifyLead` and `enrichClassification` to accept `today` as a parameter instead of computing it internally. Pipeline computes today once at entry and passes it down. Updated JSDoc on enrichClassification to reflect it's now deterministic. Updated all 5 test calls to pass a fixed date string.
**Review finding:** P1 — UTC timezone gives wrong date after 5 PM Pacific; clock-skew between stages; functions impure despite JSDoc. P2 — Day-of-week depends on deployment timezone (addressed by same fix).

---

### #4: Validate event_date_iso from LLM
**File:** `src/pipeline/classify.ts:29-32`, `src/utils/dates.ts:16-18`
**What changed:** Added regex validation (`/^\d{4}-\d{2}-\d{2}$/`) at the trust boundary in `classifyLead` — malformed dates from the LLM are warned and nullified. Added NaN guard in `parseLocalDate` as defense in depth — throws on invalid dates instead of returning silent `Invalid Date` objects. Both layers protect against LLM returning "March 22" or "TBD" instead of proper ISO format.
**Review finding:** P1 — No validation of event_date_iso; parseLocalDate creates Invalid Date silently; getDay() on Invalid Date returns NaN causing incorrect format routing.

---

### #1: Recompute pricing after format routing override
**File:** `src/run-pipeline.ts:98-107`
**What changed:** After enrichment, if `format_recommended` changed (e.g., mariachi_4piece to mariachi_full), re-run `lookupPrice` and `detectBudgetGap` with the enriched classification. Changed `const pricing` to `let pricing` to allow reassignment. This prevents quoting 4-piece rates ($650) for full-ensemble bookings ($1,650+).
**Review finding:** P1 — lookupPrice uses original format; enrichment overrides format; pricing never recomputed; customer-facing drafts show wrong dollar amounts.

---

### #2: Return enriched classification in pipeline output
**File:** `src/run-pipeline.ts:137-140`
**What changed:** Pipeline now returns `enriched` (not `classification`) in the output object and passes it to `computeConfidence`. Previously: `past_date_detected` was always undefined in output; format overrides were invisible to consumers; tier/close_type changes from budget enrichment were lost; the CLI past-date warning never triggered; confidence scoring used stale data.
**Review finding:** P1 — Non-enriched classification returned; past_date_detected always undefined; format/tier/close_type stale.

## Considered but Rejected

- **Splitting enrichment into pre-price and post-price phases** (review suggestion for #1). Would require restructuring `enrichClassification` into two functions. The "reprice if format changed" approach is simpler and less invasive — format routing is the only enrichment step that affects pricing inputs.
- **Making `enrichClassification` accept `today` as optional with a default** — considered for backward compatibility with tests, but explicit is better. Tests should declare their date, not rely on wall-clock time.

## Deferred to Later Batch

- Nothing deferred from Batch B.

## Three Questions

### 1. Hardest decision in this batch?

Fix #1 — whether to reprice unconditionally or only when format changes. Unconditional repricing is simpler code but wasteful (double lookupPrice for every lead). Conditional repricing is slightly more complex but only triggers on the mariachi routing path. Went with conditional since the "format changed" check is a single equality comparison and makes the intent clear in the code.

### 2. What did you reject, and why?

Rejected the review's suggestion to split enrichment into pre-price and post-price phases. That would mean `enrichClassification` becomes two functions with shared state (what ran in phase 1 affects phase 2). The current single function with post-hoc repricing keeps enrichment as one cohesive unit.

### 3. Did anything in this batch change the scope or approach for the next batch?

Yes — fix #3 changed the `enrichClassification` signature to accept `today`. Batch C finding #15 (conditional spread readability) targets the same function. The function body is now slightly different from what the review analyzed, but the conditional spread pattern on lines 32-39 is unchanged. No other Batch C findings are affected.
