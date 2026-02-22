# Performance Oracle — Review Findings

**Agent:** performance-oracle
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Executive Summary

No critical (P1) performance issues. The changes are well-structured for a single-lead-at-a-time pipeline where LLM API latency dominates all other costs. The enrichment step is synchronous TypeScript with negligible overhead compared to the 3+ LLM API calls.

## Findings

### [P2] Prompt token growth — full Classification serialized into generate and verify prompts
**File:** `src/prompts/generate.ts:35` and `src/prompts/verify.ts:17`
**Issue:** The full Classification object (25+ fields, ~400-500 tokens pretty-printed) is serialized via `JSON.stringify(classification, null, 2)` into both the generate and verify system prompts. The 5 new fields (`event_date_iso`, `past_date_detected`, `event_energy`, plus new `flagged_concerns` entries) add ~50-80 tokens per prompt. In the worst-case retry loop (generate fails verify, retries up to 2x), this inflated prompt ships 6 times (3 generate + 3 verify calls). At ~$0.003/1K input tokens (Claude Sonnet), this adds ~$0.001 per lead in the worst case — negligible now, but worth watching if token costs grow or if the Classification object continues to expand.
**Suggestion:** Consider serializing only the fields each prompt actually needs, rather than the full object. Not urgent — the cost is small and the simplicity of "dump the whole object" has maintenance value.

---

### [P2] Worst-case 7 LLM calls per lead due to new gut checks
**File:** `src/pipeline/verify.ts:25-55`
**Issue:** The new 12/14 gut check threshold (up from 9/11) adds 4 new checks that could trigger verify failures and retries. Each retry adds 2 more API calls (generate + verify). The pipeline allows up to 2 retries, so worst case is: classify(1) + generate(3) + verify(3) = 7 API calls. With Claude Sonnet at ~2-4s per call, worst-case latency is 14-28 seconds per lead. The new checks (`past_date_acknowledged`, `mariachi_pricing_format`, `cultural_vocabulary_used`) are well-calibrated with "Always true" no-ops when inactive, so they should rarely cause false failures. But if the retry rate increases after deployment, this is the lever to investigate.
**Suggestion:** Monitor the retry rate after deployment. If it increases, check which new gut checks are failing and whether the "Always true" no-op is correctly triggering for inactive checks.

---

### [P2] Non-enriched classification returned in pipeline output (correctness, not performance)
**File:** `src/run-pipeline.ts:127`
**Issue:** The pipeline returns the original `classification` object to the caller, not the `enriched` version. This means the `--json` output is missing `past_date_detected`, format routing overrides, and budget-driven tier changes. The downstream stages (generate, verify) use the correct `enriched` object, so the pipeline works correctly — but the output shown when running with `--json` does not reflect the actual state used.
**Suggestion:** Change `classification` to `enriched` on line 127 of `run-pipeline.ts`.

---

### [P3] Three sequential object spreads in `enrichClassification`
**File:** `src/pipeline/enrich.ts:12-50`
**Issue:** The function creates up to 3 shallow copies of the Classification object (~25 fields) via spread. Each spread allocates a new object and copies every key. With a ~25-field object, this is ~75 property copies in the worst case. This is negligible — JavaScript engines optimize object spreads heavily, and this function runs once per lead (not in a hot loop). The LLM API call preceding this takes 2-4 seconds; the spreads take <0.01ms.
**Suggestion:** No action needed. The current "one spread per concern" pattern is clear and maintainable. Only revisit if Classification grows to 100+ fields (unlikely).

---

### [P3] `JSON.stringify(classification, null, 2)` in prompts uses pretty-print formatting
**File:** `src/prompts/generate.ts:35`
**Issue:** Pretty-printing with 2-space indent adds ~30% more whitespace tokens compared to compact JSON. For a ~500-token object, this is ~150 extra tokens per prompt. However, pretty-printed JSON is significantly easier for the LLM to parse, which reduces the chance of misinterpretation and retries (which cost far more than 150 tokens).
**Suggestion:** No action needed. The readability benefit for the LLM outweighs the token cost.

---

### [P3] `parseLocalDate` creates a Date object for every comparison
**File:** `src/utils/dates.ts:7`
**Issue:** Called 2-3 times per lead (once for past-date check, once for format routing day-of-week). Date construction from a string is a lightweight operation (~microseconds). Not a performance concern.
**Suggestion:** No action needed.

---

### [P3] Cultural vocab few-shot examples add ~200 tokens to generate prompt
**File:** `src/prompts/generate.ts:192-210`
**Issue:** The `buildCulturalVocabBlock` function adds PASS/FAIL examples (~200 tokens) to the generate prompt when `cultural_context_active` is true. This runs for every mariachi/Mexican heritage lead. The examples are effective (they prevent the LLM from using incorrect cultural terms), and 200 tokens is ~$0.0006 per lead.
**Suggestion:** No action needed. The examples are well-calibrated and the cost is trivial.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| P1 | 0 | — |
| P2 | 3 | Prompt token growth, worst-case 7 LLM calls, non-enriched output returned |
| P3 | 4 | Object spreads, pretty-print JSON, Date construction, cultural vocab tokens |

**Overall assessment:** The changes have negligible performance impact. The pipeline is I/O-bound (LLM API calls), and the new TypeScript logic adds microseconds to a multi-second pipeline. The main performance risk is increased retry rate from the 4 new gut checks — monitor after deployment.
