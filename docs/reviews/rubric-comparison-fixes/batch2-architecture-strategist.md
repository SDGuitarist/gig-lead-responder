# Architecture Strategist -- Review Findings

**Agent:** architecture-strategist
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Commits reviewed:** 9119acd, bdf31e6, b807909, b68bb33, 09897ca
**Files reviewed:** 8

---

## Architecture Overview

The system is a linear 5-stage pipeline:

```
classify --> price --> enrich --> context --> generate+verify
```

Each stage has a clean separation between **pipeline logic** (`src/pipeline/*.ts`) and **prompt construction** (`src/prompts/*.ts`). Types live in `src/types.ts`. The pipeline orchestrator is `src/run-pipeline.ts`. This is a sound architecture for a single-user, single-domain LLM pipeline. The changes under review add three capabilities: past-date detection, mariachi format routing, and cultural vocabulary enforcement -- distributed across all layers.

---

## Findings

### [P1] Stale pricing after format routing override -- enrichment runs after pricing but can change the format

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/run-pipeline.ts:84-94`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:23-38`

**Issue:** The pipeline calls `lookupPrice(classification)` at line 84, producing a `PricingResult` based on the original `format_recommended`. Then `enrichClassification` at line 94 can override `format_recommended` (e.g., from `mariachi_4piece` to `mariachi_full`). The `PricingResult` is never recalculated. This means `pricing.quote_price`, `pricing.anchor`, `pricing.floor`, and `pricing.format` can all be wrong when the enriched classification reaches the generate and verify stages.

Concrete scenario: LLM classifies as `mariachi_4piece`, pricing looks up 4-piece rates ($650-$900 range for 1hr). Enrichment flips to `mariachi_full` (weekend rule). The generate prompt injects $650 as the quote, but `mariachi_full` rates start at $1,650 for 2hr. The client sees a quote that is roughly 60% below the real rate.

This is the most architecturally significant issue in the changeset. It violates the dependency rule: enrichment mutates state that pricing already consumed, but pricing does not re-run.

**Suggestion:** Either (a) move format routing before pricing by splitting enrichment into two phases (pre-price enrichment and post-price enrichment), or (b) re-run `lookupPrice` after enrichment if `format_recommended` changed. Option (a) is cleaner because it preserves the "each stage runs once" invariant. Example:

```typescript
// In run-pipeline.ts
const preEnriched = applyFormatRouting(classification); // new function
const pricing = lookupPrice(preEnriched);
pricing.budget = detectBudgetGap(...);
const enriched = enrichClassification(preEnriched, pricing); // only budget + past-date
```

**Batch1 overlap:** This confirms batch1 finding #6 ("pricing.quote_price may be stale after format routing override") and #8 ("implicit enrichment ordering dependency"). The architectural root cause is that enrichment was extended from a single concern (budget) to three concerns (budget, date, format) without re-evaluating the pipeline ordering contract.

---

### [P1] new Date() called inline in two pipeline stages -- untestable, clock-skew between stages

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/classify.ts:10`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:17`

**Issue:** Both `classifyLead` and `enrichClassification` construct "today" independently via `new Date().toISOString().slice(0, 10)`. Two architectural problems:

1. **Testability**: Neither function accepts an injected clock. You cannot write a unit test for past-date detection without monkey-patching `Date` or using a timer fake. The `enrichClassification` JSDoc says "Pure function" but it calls `new Date()`, which makes it impure.

2. **Clock skew**: If the pipeline runs near midnight UTC (4-5 PM Pacific), `classify` and `enrich` could get different dates. `classify` tells the LLM "today is 2026-03-14" and the LLM extracts `event_date_iso: "2026-03-14"`. Then `enrich` runs a few seconds later, `new Date()` returns "2026-03-15", and `parseLocalDate("2026-03-14") < parseLocalDate("2026-03-15")` flags a non-past date as past. The probability is low but the consequence is severe (a live event gets a "your date has passed" message).

**Suggestion:** Create the "today" string once in `runPipeline` and pass it as a parameter to both `classifyLead(rawText, today)` and `enrichClassification(classification, pricing, today)`. This makes both functions pure and testable, and eliminates clock skew.

**Batch1 overlap:** Direct confirmation of batch1 finding #1.

---

### [P1] No validation of `event_date_iso` from LLM output -- malformed strings silently produce wrong dates

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:15-21`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/utils/dates.ts:7`

**Issue:** The LLM returns `event_date_iso` as a free-form string. `parseLocalDate` passes it directly to `new Date()` with no validation. If the LLM returns `"March 22"`, `"2026/03/14"`, `"TBD"`, or any non-ISO string, `new Date("March 22T12:00:00")` returns `Invalid Date`. The comparison `eventDate < today` with an `Invalid Date` always returns `false`, so past-date detection silently skips. No error is thrown, no warning is logged.

More subtly, if the LLM returns `"2026-3-14"` (missing leading zero), `new Date("2026-3-14T12:00:00")` parses successfully in V8 but the behavior is implementation-defined. The code trusts LLM output with no defensive parsing.

**Suggestion:** Add validation in `parseLocalDate` or at the call site:

```typescript
export function parseLocalDate(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid ISO date format: "${isoDate}" (expected YYYY-MM-DD)`);
  }
  return new Date(`${isoDate}T12:00:00`);
}
```

Or, if you prefer graceful degradation over throwing, return `null` and let callers skip the date logic. Either way, do not silently accept arbitrary strings.

**Batch1 overlap:** Direct confirmation of batch1 finding #2.

---

### [P2] Optional fields (`?`) vs required-nullable (`| null`) inconsistency on Classification

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/types.ts:42-43` and `:50`

**Issue:** Three new fields use `?` (optional) while existing fields of similar nature use `| null` (required-nullable):

```typescript
event_date_iso?: string | null;   // optional AND nullable (double-absent)
past_date_detected?: boolean;     // optional
event_energy?: "background" | "performance" | null;  // optional AND nullable
```

Compare with the established pattern:

```typescript
stated_budget: number | null;     // required, nullable
cultural_tradition: "spanish_latin" | null;  // required, nullable
```

The `?` plus `| null` combination means callers must check for both `undefined` and `null`, which is a TypeScript anti-pattern. Existing code already checks `if (classification.event_date_iso)` which happens to handle both, but it creates an inconsistent contract. Some fields are "always present, sometimes null" and others are "sometimes not present at all." This makes the type less self-documenting and more error-prone for future contributors.

Additionally, `past_date_detected` being optional means downstream code (generate prompt, verify prompt) must always use `?.` or `!` access, instead of a simple boolean check against a guaranteed field. Since it defaults to `false` conceptually, it should be `past_date_detected: boolean` with a default of `false` set during classification.

**Suggestion:** Standardize on required-nullable for LLM-sourced fields and required with defaults for computed fields:

```typescript
event_date_iso: string | null;       // LLM extracts or returns null
past_date_detected: boolean;         // computed, default false
event_energy: "background" | "performance" | null;  // LLM judgment
```

Set defaults in `classifyLead` after parsing the LLM response:

```typescript
result.event_date_iso = result.event_date_iso ?? null;
result.past_date_detected = false; // computed later in enrich
result.event_energy = result.event_energy ?? null;
```

**Batch1 overlap:** Direct confirmation of batch1 finding #4.

---

### [P2] Magic string constants for `flagged_concerns` scattered across 3 files

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:32-34`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/generate.ts:217,226`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/verify.ts:171,176`

**Issue:** The strings `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` appear as raw string literals in three separate files. `enrich.ts` writes them into `flagged_concerns`, `generate.ts` reads them to decide which dual-format block to inject, and `verify.ts` reads them to decide which gut check instruction to use. A typo in any one file (e.g., `"mention_4piece_alterntive"`) would silently break the handoff -- the concern would be written but never matched.

This is a cross-cutting contract encoded as string matching with no compiler protection. The same issue exists for `"no_viable_scope"` in the `BudgetGapResult` type, but that one at least uses a discriminated union with TypeScript enforcement. The `flagged_concerns` array has no such protection.

**Suggestion:** Define constants in a shared location (either `types.ts` or a new `src/constants.ts`):

```typescript
export const CONCERN_MENTION_4PIECE = "mention_4piece_alternative" as const;
export const CONCERN_MENTION_FULL_UPGRADE = "mention_full_ensemble_upgrade" as const;
```

Then import and use in all three files. TypeScript will catch any misspelling at compile time.

**Batch1 overlap:** Direct confirmation of batch1 finding #5.

---

### [P2] Hardcoded threshold "12 of 14" in verify prompt text -- fragile if gut checks change again

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/verify.ts:83`

**Issue:** The verify prompt tells the LLM `"At least 12 of 14 gut_checks are true"`. These numbers are hardcoded string literals. `index.ts` already computes the count dynamically (`Object.keys(checks).length`), but the prompt itself does not. If a future commit adds a 15th gut check, the prompt would still say "12 of 14" while the actual check count is 15. The LLM would apply the wrong threshold.

This is architecturally fragile because the threshold lives in two places -- the prompt text (for LLM enforcement) and the `index.ts` display (for human display) -- with no shared source of truth. The `GateResult` type in `types.ts` defines the gut check fields, but neither the count nor the threshold is derived from it.

**Suggestion:** Derive the count from the type or from a constant:

```typescript
const GUT_CHECK_COUNT = 14;
const GUT_CHECK_PASS_THRESHOLD = 12;

// In the prompt:
`At least ${GUT_CHECK_PASS_THRESHOLD} of ${GUT_CHECK_COUNT} gut_checks are true`
```

Or, more robustly, build the gut check field list in one place and derive both the prompt text and the type from it.

**Batch1 overlap:** Direct confirmation of batch1 finding #7.

---

### [P2] UTC timezone still leaks through `new Date().toISOString().slice(0,10)` in classify

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/classify.ts:10`

**Issue:** The code uses `new Date().toISOString().slice(0, 10)` to get "today." `toISOString()` returns UTC. After 5 PM Pacific (midnight UTC), this returns tomorrow's date. The LLM then receives `Today's date is 2026-03-15` when the user is actually on March 14 Pacific time. If a lead says "March 14" the LLM might interpret it as yesterday and assign a different `timeline_band`.

`parseLocalDate` in `dates.ts` solves the UTC problem for date comparisons by anchoring to noon, but the "today" string passed to the LLM is still UTC-derived. The system operates in San Diego (Pacific time) and all leads are local events.

**Suggestion:** Use a timezone-aware "today" derivation:

```typescript
function getTodayPacific(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  // "en-CA" locale returns YYYY-MM-DD format
}
```

Or, if you prefer no locale dependency, use `Intl.DateTimeFormat`. This should be the single source of "today" passed to all stages (see P1 finding about clock injection).

**Batch1 overlap:** Direct confirmation of batch1 finding #3.

---

### [P2] `enrichClassification` claims to be pure but has a side effect (reads system clock)

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:7`

**Issue:** The JSDoc says `"Pure function -- returns a new object when overriding, original when not."` This was true before this changeset (it only checked `pricing.budget.tier`). The addition of `new Date()` on line 17 makes the function impure. The comment is now misleading.

This is a documentation-architecture mismatch. Other developers (or an LLM reviewing code) will trust the "pure function" claim and not account for time-dependency when writing tests or reasoning about the function.

**Suggestion:** Either make it actually pure by injecting `today` as a parameter (preferred -- see P1 finding above), or update the JSDoc to say "Deterministic for a given clock state" or similar. The former is better because it enables snapshot testing.

---

### [P2] `enriched` classification returned to caller but `confidence_score` computed from original `classification`

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/run-pipeline.ts:124,126-128`

**Issue:** Line 94 creates `enriched` from `classification`. Lines 115-117 correctly pass `enriched` to `runWithVerification`. But line 124 computes `computeConfidence(gate, verified, classification)` using the original, non-enriched classification. And line 127 returns `classification` (not `enriched`) as `output.classification`.

This means the returned output has:
- `classification.past_date_detected` is `undefined` (not enriched)
- `classification.format_recommended` is the LLM's original (not the routing override)
- `classification.flagged_concerns` does not include the format routing concerns

But `drafts` and `gate` were generated from the enriched version. The output is internally inconsistent: the classification says one thing, the drafts say another.

The `index.ts` display at line 59 checks `classification.past_date_detected`, which is always `undefined` on the non-enriched object, so the "WARNING: Event date appears to be in the past" message never prints even when the pipeline correctly detected and handled a past date.

**Suggestion:** Return `enriched` instead of `classification` in the output, and pass `enriched` to `computeConfidence`:

```typescript
const confidence_score = computeConfidence(gate, verified, enriched);
return {
  classification: enriched, pricing, drafts, gate, verified, timing, confidence_score,
};
```

---

### [P3] `resolveFormatRouting` uses `tier === "premium"` as a proxy for "corporate" -- brittle heuristic

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:86-88`

**Issue:** The corporate background exception checks `classification.tier === "premium" && classification.event_energy === "background"`. But `tier: "premium"` does not exclusively mean corporate. It also applies to luxury venues, "ready to book ASAP" + detailed logistics, 25+ guests at high-end, and stealth premium signals (see classify prompt Step 4). A quinceañera at a luxury hotel would be `tier: "premium"` + `event_energy: "background"` but is not a corporate event. This would incorrectly route to `mariachi_4piece`.

This is a minor semantic gap, not a structural violation. The `Classification` type does not have an explicit `is_corporate` or `event_type_category` field, so the enrichment layer improvises with proxy signals. The risk is low because most quinceañeras would have `event_energy: "performance"`, but the code comment says "corporate background" while the logic says "premium background."

**Suggestion:** Either add an explicit `event_type_category` field to Classification (and have the LLM classify it), or add a code comment acknowledging the heuristic's limitations and the assumption that premium + background is a reliable proxy for corporate events.

---

### [P3] Format routing injects concerns without checking for duplicates

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:30-36`

**Issue:** If `enrichClassification` is ever called twice (e.g., in a future edit pipeline path or retry logic), the format routing concern would be appended again, creating duplicates in `flagged_concerns`. The current pipeline only calls it once, so this is not an active bug, but the spreading pattern `[...enriched.flagged_concerns, newConcern]` has no idempotency guard.

**Suggestion:** Either add a duplicate check before appending, or document that `enrichClassification` must be called exactly once per pipeline run. A simple guard:

```typescript
const concern = routing.format_recommended === "mariachi_full"
  ? "mention_4piece_alternative"
  : "mention_full_ensemble_upgrade";
if (!enriched.flagged_concerns.includes(concern)) {
  enriched = { ...enriched, flagged_concerns: [...enriched.flagged_concerns, concern] };
}
```

---

### [P3] `buildVerifyPrompt` accepts `pricing` as optional but format routing gut checks depend on enriched `flagged_concerns`

**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/verify.ts:10`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/verify.ts:13`

**Issue:** `buildVerifyPrompt` takes `pricing?: Pick<PricingResult, "budget">` as optional. `verifyGate` also takes `pricing?: PricingResult`. This was fine when the only pricing-dependent check was `budget_acknowledged`. But the new `mariachi_pricing_format` gut check reads `classification.flagged_concerns` (which depends on enrichment, which depends on pricing). So the dependency chain is:

```
pricing --> enrichment --> flagged_concerns --> verify prompt
```

If someone calls `verifyGate(drafts, classification)` without pricing (as the signature allows), the `budget_acknowledged` check defaults to "always true" (safe), but the classification passed in might not be enriched, meaning `flagged_concerns` would be empty and `mariachi_pricing_format` would also default to "always true." This masks a missing dependency rather than failing explicitly.

The `runEditPipeline` function at `run-pipeline.ts:149` calls `verifyGate(drafts, classification, pricing)` with pricing required, so the current code paths are safe. But the optional parameter on the public API is misleading about what is actually needed.

**Suggestion:** Make `pricing` required in `verifyGate` and `buildVerifyPrompt`. If a caller genuinely does not have pricing, they should construct a stub with `budget: { tier: "none" }` explicitly, rather than relying on the function to default it.

---

## Compliance Summary

| Principle | Status | Notes |
|-----------|--------|-------|
| Single Responsibility | PASS | Each file has a clear, focused purpose. Enrichment handles all post-classification mutations. |
| Open/Closed | PASS | New gut checks were added without modifying existing check logic. Builder functions extend cleanly. |
| Dependency Inversion | PARTIAL | Pipeline stages depend on concrete types, not abstractions. Acceptable for this scale. The `new Date()` calls violate DI by hardcoding the clock. |
| Layering (prompt vs pipeline) | PASS | The separation between `prompts/*.ts` (what to tell the LLM) and `pipeline/*.ts` (what to do in code) is well maintained. |
| Data flow integrity | FAIL | Stale pricing after format routing (P1). Non-enriched classification in output (P2). |
| Testability | FAIL | Impure functions (`new Date()`), no validation of LLM output, no injectable clock. |
| Type safety | PARTIAL | Discriminated unions for `BudgetGapResult` are excellent. But `flagged_concerns` uses unprotected string matching across file boundaries. |

## Risk Summary

1. **Incorrect pricing on mariachi leads** (P1): Format routing can change the format after pricing has been calculated. This could result in quoting a 4-piece price for a full ensemble. Real money is at stake.

2. **Non-enriched classification leaks to output** (P2): The pipeline returns the pre-enrichment classification, so callers (including `index.ts` display and any future API consumers) see stale data.

3. **Silent date parsing failures** (P1): Malformed `event_date_iso` from the LLM produces `Invalid Date` with no error, causing past-date detection to silently skip.

4. **Clock-skew between stages** (P1): Two independent `new Date()` calls can produce different "today" values near midnight UTC.
