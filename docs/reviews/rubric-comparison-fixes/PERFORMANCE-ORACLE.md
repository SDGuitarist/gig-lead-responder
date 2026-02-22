# Performance Oracle -- Review Findings

**Agent:** performance-oracle
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Performance Summary

This pipeline processes one lead at a time through 3 sequential LLM calls (classify, generate, verify) with up to 2 retry loops on verification failure, yielding a worst-case of 7 LLM calls per lead. The enrichment layer (`enrich.ts`) and utility functions (`dates.ts`) are pure synchronous TypeScript with negligible CPU cost. The dominant performance characteristic is LLM API latency and token consumption, not local computation.

The changes under review (past-date detection, mariachi format routing, budget gap blocks, cultural vocab few-shot examples, verify gut checks 9/11 to 12/14) are well-structured. No critical performance regressions were introduced. Findings below are ordered by impact.

## Findings

### [P2] Prompt token growth from Classification JSON serialization in both generate and verify prompts

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/generate.ts:35` and `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/verify.ts:17`

**Issue:** The full Classification object is serialized via `JSON.stringify(classification, null, 2)` and injected into both the generate and verify system prompts. The Classification type has 25+ fields. Many of these fields are consumed only by one stage (e.g., `rate_card_tier` and `lead_source_column` are pricing concerns already resolved before generation; `stealth_premium_signals` is an array the LLM already evaluated during classification). Every token in the system prompt is billed on every call, and the verify prompt re-sends the entire classification even though the verifier only needs a subset (flagged_concerns, cultural_context_active, format info, platform, past_date_detected, stated_budget).

With the 4 new gut-check instruction builders in verify.ts, the verify system prompt has grown substantially. In the worst case (retry loop), this inflated prompt is sent 3 times for verification + 3 times for generation = 6 system prompt transmissions per lead.

**Current impact:** Each extra 100 tokens in the system prompt costs ~600 tokens across a worst-case run (6 calls). The Classification JSON alone is roughly 400-500 tokens pretty-printed.

**Projected impact at 100 leads/day:** ~300K unnecessary input tokens/day in the worst case. At Sonnet pricing ($3/M input tokens), this is roughly $0.90/day -- modest but compounding.

**Suggestion:** No action needed now. If token costs become a concern, create a `pickClassificationForVerify()` function that selects only the fields the verifier actually reads (flagged_concerns, cultural_context_active, cultural_tradition, format_recommended, platform, past_date_detected, stated_budget, event_date_iso, competition_level). This would cut the serialized payload by roughly 40-50%.

---

### [P3] Verify prompt rebuilds on every retry with identical output

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/verify.ts:15-18`

**Issue:** `buildVerifyPrompt(classification, pricing)` is called inside `verifyGate()`, which is called up to 3 times in `runWithVerification()`. The classification and pricing objects do not change between retries -- only the drafts change. The system prompt is rebuilt from scratch each time, running the same string concatenation and conditional logic.

**Current impact:** Negligible. The prompt builder runs in microseconds. The string allocations are small (the prompt is ~3-4KB).

**Projected impact at scale:** None. This is a correctness-over-performance design that is appropriate for a pipeline processing one lead at a time.

**Suggestion:** No action needed. If you ever want to micro-optimize, you could hoist the `buildVerifyPrompt` call above the retry loop in `runWithVerification` and pass it as a parameter to `verifyGate`. But the savings are on the order of microseconds per lead, so this is not worth the added complexity.

---

### [P3] Three sequential object spreads in enrichClassification

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:19-49`

**Issue:** The function creates up to 3 shallow copies of the Classification object via spread:
```typescript
enriched = { ...enriched, past_date_detected: true };          // spread 1
enriched = { ...enriched, format_recommended: ..., ... };      // spread 2
enriched = { ...enriched, tier: "qualification", ... };        // spread 3
```

Each spread copies ~25 keys. In the worst case (all 3 branches taken), this creates 3 intermediate objects.

**Current impact:** Effectively zero. The Classification object is small (under 1KB), the spreads complete in microseconds, and the intermediate objects are immediately eligible for GC. No references escape.

**Projected impact at scale:** None, even at 10,000 leads/day. This pattern would only matter if Classification had hundreds of keys or if this function were called in a tight loop, neither of which applies.

**Suggestion:** No action needed. Batch1 already flagged this as a minor concern and correctly concluded it is a non-issue. The immutable-style pattern (returning new objects rather than mutating) is the right trade-off for correctness and debuggability in a pipeline that processes one lead at a time.

---

### [P3] findMinFloor iterates all durations in the rate table on every no_viable_scope prompt build

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/generate.ts:302-319`

**Issue:** `findMinFloor()` iterates over all duration keys in a format's rate table to find the minimum floor price. This is called from `buildBudgetModeBlock()` only when `budget.tier === "no_viable_scope"`. The rate tables have at most 4 entries per format.

**Current impact:** A loop over 2-4 entries with simple comparisons. Completes in nanoseconds.

**Projected impact at scale:** None. The rate tables are static data structures. Even if you added 20 formats with 10 durations each, this would still be sub-microsecond.

**Suggestion:** No action needed. The current implementation is clear and correct. Precomputing min floors would add complexity for zero measurable gain.

---

### [P3] parseLocalDate creates Date objects that are used only for comparison

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/utils/dates.ts:6-8` and `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:16-18`

**Issue:** In the past-date detection block, `parseLocalDate` is called twice: once for the event date and once for "today." Both create new Date objects. The "today" date could theoretically be computed once at pipeline start and passed in, but the function is called exactly once per lead.

**Current impact:** Two Date object allocations per lead. Negligible.

**Suggestion:** No action needed. The `T12:00:00` noon-anchoring pattern is a smart fix for UTC midnight rollover and is worth the clarity cost.

---

### [P3] flagged_concerns array scanned via .includes() in multiple places

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/generate.ts:217-218` and `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/verify.ts:171-172`

**Issue:** `classification.flagged_concerns.includes("mention_4piece_alternative")` and similar calls perform linear scans of the flagged_concerns array. This array is used in both the generate and verify prompt builders.

**Current impact:** The array has at most 3-5 entries. Linear scan of 3-5 strings is faster than any alternative data structure (a Set would have higher construction overhead for such small N).

**Suggestion:** No action needed. Array.includes is the correct choice for collections this small.

---

### [P2] Worst-case LLM call count: 7 API round-trips per lead

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/verify.ts:25-55` and `/Users/alejandroguillen/Projects/gig-lead-responder/src/claude.ts:20-66`

**Issue:** The pipeline's worst-case call sequence is:

1. classify (1 call, or 2 if JSON parse fails)
2. generate attempt 1 (1 call, or 2 if JSON parse fails)
3. verify attempt 1 (1 call, or 2 if JSON parse fails)
4. generate retry 1 (1-2 calls)
5. verify retry 1 (1-2 calls)
6. generate retry 2 (1-2 calls)
7. verify retry 2 (1-2 calls)

Best case: 3 API calls. Worst case with retries but no JSON failures: 7. Worst case with JSON parse failures on every call: 14.

The 5 commits under review raised the gut check threshold from 9/11 to 12/14, which means drafts now need to pass 4 additional checks (budget_acknowledged, past_date_acknowledged, mariachi_pricing_format, cultural_vocabulary_used). If any of these new checks fail, the pipeline enters the retry loop, adding 2-4 more LLM calls.

**Current impact:** With 4 test leads all passing, the current pass rate appears stable. But the new checks are context-dependent (e.g., `cultural_vocabulary_used` only fires when cultural context is active), and their interaction with the 12/14 threshold means a lead that barely passed at 9/11 might now fail and trigger retries.

**Projected impact at scale:** At 50 leads/day with a 30% retry rate, that is ~15 leads * 4 extra calls = 60 extra API calls/day. At ~1000 tokens per call and Sonnet pricing, this is roughly $0.50-1.00/day in added cost and ~15 seconds of added latency per retried lead.

**Suggestion:** Monitor the retry rate after deploying these changes. If it climbs above 30%, consider:
1. Adding the fail_reasons from the previous attempt as context in the rewrite instructions (already done -- good).
2. Using a cheaper/faster model for verification (the verifier does not generate prose, it evaluates and extracts quotes -- a task that could potentially use Haiku).
3. Logging which specific gut checks cause failures to identify if one new check is disproportionately triggering retries.

---

### [P3] Classification object returned to caller is the pre-enrichment version

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/run-pipeline.ts:126-128`

**Issue:** The `runPipeline` function returns the original `classification` object (line 127), not the `enriched` version. The `enriched` version is passed to `selectContext` and `runWithVerification`, so the pipeline operates correctly. However, the output exposed to the caller (and logged in JSON mode) shows the pre-enrichment classification -- missing `past_date_detected: true`, any format routing overrides, and any budget-driven tier/close_type changes.

This is not a performance issue, but it is a data consistency concern that could cause confusion when debugging or reviewing pipeline output. I am noting it here because it was discovered during performance analysis and could lead to wasted debugging time (which is a form of developer-time performance).

**Suggestion:** Change line 127 in `run-pipeline.ts` from `classification` to `enriched` so the output reflects the actual state used by downstream stages. This is a one-word change with no performance cost.

---

## Scalability Assessment

**Current architecture:** Single-lead, single-threaded, sequential pipeline. Three LLM calls minimum, seven maximum.

**At 10x volume (50 leads/day):** No concerns. Each lead is independent. If processing is triggered by incoming emails/webhooks, leads can be processed concurrently with no shared state.

**At 100x volume (500 leads/day):** LLM API rate limits become the binding constraint, not local code performance. The Anthropic API has rate limits on requests-per-minute and tokens-per-minute. At 500 leads * 3-7 calls = 1,500-3,500 API calls/day, you would need to implement a request queue with rate limiting. The local code (enrichment, prompt building, pricing lookup) contributes effectively zero to total latency.

**At 1000x volume (5,000 leads/day):** Not a realistic scenario for a single-musician booking service, but if reached: API costs become the dominant concern (~$50-150/day at Sonnet pricing), and you would want to consider caching classification results for similar leads, batching verification, or using a cheaper model for the classify step.

**Memory:** All objects are small and short-lived. No unbounded data structures, no streaming buffers that grow with input size, no in-memory caches that could leak. The stdin reader in `index.ts` buffers the entire lead in memory, but leads are plain text under 1KB. No memory concerns at any realistic scale.

## Recommended Actions (Priority Order)

1. **[Low effort, high value]** Fix the classification/enriched mismatch in `run-pipeline.ts` line 127 -- return `enriched` instead of `classification`. This is a correctness fix, not a performance fix, but it was surfaced during this review.

2. **[Low effort, medium value]** Add logging to track which gut checks fail and how often retries are triggered. This gives you data to decide whether the 12/14 threshold is calibrated correctly after the new checks.

3. **[Medium effort, low urgency]** If token costs become a concern, create a `pickClassificationForVerify()` function to reduce the Classification payload sent to the verify prompt.

4. **[Medium effort, low urgency]** Consider using a faster/cheaper model (Haiku) for the verification step, since it performs evaluation rather than creative generation.
