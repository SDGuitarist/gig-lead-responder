# Data Integrity Guardian — Review Findings

**Agent:** compound-engineering:review:data-integrity-guardian
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Findings

### [P1] Stale classification object returned in PipelineOutput
**File:** `src/run-pipeline.ts:127`
**Issue:** The `PipelineOutput` returned on line 127 includes `classification` (the original, pre-enrichment object), NOT `enriched`. This means the consumer of the pipeline output (CLI, web server, SMS handler, database persistence) receives a classification that is inconsistent with the drafts and gate results. Specifically: `past_date_detected` will be missing or false on the returned classification even though drafts were generated with past-date awareness; `format_recommended` may differ after mariachi routing override; `flagged_concerns` may be incomplete; `tier` and `close_type` may be stale after budget enrichment. The `LeadRecord` in the database stores `classification_json` from this output, so the persisted classification will not match the actual drafts.
**Suggestion:** Return `enriched` instead of `classification`:
```typescript
return {
  classification: enriched, pricing, drafts, gate, verified, timing, confidence_score,
};
```

---

### [P2] Stale classification object passed to confidence scoring
**File:** `src/run-pipeline.ts:124`
**Issue:** The `computeConfidence` function receives the original `classification` object, but the pipeline has already produced an enriched version. If any future enrichment modifies a field that `computeConfidence` reads, the score would silently use stale data.
**Suggestion:** Pass `enriched` instead of `classification` to `computeConfidence`.

---

### [P2] Verify gate threshold hardcoded as 12/14 but gut_checks count is implicit
**File:** `src/prompts/verify.ts:83`
**Issue:** The verify prompt hardcodes "At least 12 of 14 gut_checks are true" while `src/index.ts:103` dynamically counts gut checks with `Object.keys(checks).length`. These two sources of truth are not linked. Adding a 15th check would require manually updating the verify prompt — an easy-to-miss step.
**Suggestion:** Extract the gut check count and threshold as shared constants, or add a comment in `types.ts` at the `gut_checks` definition noting the verify prompt must be updated in tandem.

---

### [P2] Budget-mode prompt refers to pricing.format but enrichment may have changed format_recommended
**File:** `src/prompts/generate.ts:277` and `src/run-pipeline.ts:84-94`
**Issue:** `lookupPrice(classification)` on line 84 computes pricing using the original `classification.format_recommended`. Enrichment (line 94) may override the format (e.g., `mariachi_4piece` → `mariachi_full`). After enrichment, `pricing.format` still reflects the OLD format. Downstream in `buildBudgetModeBlock`, `findMinFloor(pricing.format, pricing.tier_key)` looks up rates using the pre-enrichment format. The minimum floor price shown in a warm redirect would be for the 4-piece, not the full ensemble — quoting a lower minimum than actually available.
**Suggestion:** Re-run `lookupPrice` after enrichment if `format_recommended` was changed.

---

### [P3] Non-atomic pricing + enrichment sequence
**File:** `src/run-pipeline.ts:84-94`
**Issue:** `pricing.budget` is mutated in-place on line 86 after `lookupPrice` constructs the pricing object. This in-place mutation is a code smell, though functionally correct since all operations are synchronous.
**Suggestion:** Consider having `lookupPrice` accept `stated_budget` and call `detectBudgetGap` internally, returning a fully-formed `PricingResult`.

---

### [P3] Duration "4" valid in type but missing from most rate tables
**File:** `src/types.ts:36` and `src/data/rates.ts`
**Issue:** `Classification.duration_hours` accepts `4` as valid, but only `mariachi_full` has a "4" duration key. If the LLM classifies a solo lead as 4 hours, `lookupPrice` will throw. The classify prompt says "Map to nearest valid value: 1, 1.5, 2, 3, or 4" without format-specific constraints.
**Suggestion:** Add format-specific duration constraints to the classify prompt (e.g., "Solo/duo: max 3 hours. Mariachi full: max 4 hours.").

---

### [P3] Optional event_energy field has no validation
**File:** `src/pipeline/classify.ts:16-28` and `src/pipeline/enrich.ts:87-88`
**Issue:** The classify stage validates several fields but does NOT validate `event_energy`. Enrichment reads `classification.event_energy` to determine whether a weekday mariachi lead is corporate background. If the LLM omits this field, `undefined !== "background"` is the safe default, but this implicit reliance is fragile.
**Suggestion:** Add a defensive default or validate that `event_energy` is one of the expected values.

---

### [P3] Optional fields in Classification not emitted by classify prompt
**File:** `src/prompts/classify.ts:140-150` and `src/types.ts:42-50`
**Issue:** `past_date_detected` and `platform` are optional in the type but the LLM is not instructed to omit them. The LLM could emit `past_date_detected: false` in its JSON, but the spread-overwrite pattern in enrichment correctly handles this.
**Suggestion:** No fix needed — noting for awareness.
