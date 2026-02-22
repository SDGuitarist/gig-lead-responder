# Architecture Strategist — Review Findings

**Agent:** architecture-strategist
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Findings

### [P1] Stale pricing after format routing override
**File:** `src/run-pipeline.ts:84-94` and `src/pipeline/enrich.ts:23-38`
**Issue:** The pipeline calls `lookupPrice(classification)` at line 84 using the original `format_recommended`, then `enrichClassification` at line 94 can override `format_recommended` (e.g., `mariachi_4piece` to `mariachi_full`). The `PricingResult` is never recalculated. Concrete scenario: LLM classifies as `mariachi_4piece`, pricing looks up 4-piece rates ($650 for 1hr). Enrichment flips to `mariachi_full` (weekend rule). The generate prompt injects $650 as the quote, but `mariachi_full` rates start at $1,650 for 2hr. The client would see a quote roughly 60% below the real rate.
**Suggestion:** Split enrichment into pre-price (format routing) and post-price (budget, past-date). Run format routing before `lookupPrice`, then run budget/date enrichment after.

---

### [P1] `new Date()` called inline in two pipeline stages
**File:** `src/pipeline/classify.ts:10` and `src/pipeline/enrich.ts:17`
**Issue:** Both functions construct "today" independently via `new Date().toISOString().slice(0, 10)`. This makes `enrichClassification` impure (despite its JSDoc claiming otherwise) and creates potential clock-skew near midnight UTC. If classify runs at 11:59:59 PM UTC and enrich runs at 12:00:00 AM UTC, they disagree on what "today" is, potentially flagging a live event as past-dated.
**Suggestion:** Create the "today" string once in `runPipeline` and pass it as a parameter to both stages. This makes both functions pure, testable, and clock-consistent.

---

### [P1] No validation of `event_date_iso` from LLM
**File:** `src/pipeline/enrich.ts:15-21` and `src/utils/dates.ts:7`
**Issue:** The LLM returns `event_date_iso` as a free-form string. `parseLocalDate` passes it to `new Date()` with no format validation. If the LLM returns `"March 22"` or `"TBD"`, the result is `Invalid Date`. The comparison `eventDate < today` with `Invalid Date` always returns `false`, so past-date detection silently fails. Similarly in `resolveFormatRouting` (line 77), `getDay()` on an Invalid Date returns `NaN`, making `isWeekend` always `false`.
**Suggestion:** Add a regex guard in `parseLocalDate`: `if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(...)`.

---

### [P2] Non-enriched classification returned in pipeline output
**File:** `src/run-pipeline.ts:124-128`
**Issue:** Line 94 creates `enriched` and passes it to generate+verify. But line 127 returns the original `classification` in the output, and line 124 passes it to `computeConfidence`. This means `output.classification.past_date_detected` is always `undefined`, `output.classification.format_recommended` is the LLM's original (not the routing override), and `output.classification.flagged_concerns` is missing format routing concerns. The `index.ts` warning at line 59 (`if (classification.past_date_detected)`) never triggers because it reads from the non-enriched object.
**Suggestion:** Return `enriched` instead of `classification` in the output object.

---

### [P2] Optional (`?`) vs required-nullable (`| null`) inconsistency on Classification
**File:** `src/types.ts:42-43,50`
**Issue:** New fields use `?` (optional) plus `| null` while existing fields of the same nature use just `| null` (required-nullable). The `?` + `| null` combination means callers must check for both `undefined` and `null`.
**Suggestion:** Use `event_date_iso: string | null`, `past_date_detected: boolean`, `event_energy: "background" | "performance" | null` (all required). Set defaults after LLM parse.

---

### [P2] Magic string constants for `flagged_concerns` across 3 files
**File:** `src/pipeline/enrich.ts:32-34`, `src/prompts/generate.ts:217,226`, `src/prompts/verify.ts:171,176`
**Issue:** `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` are raw string literals written in `enrich.ts` and matched in `generate.ts` and `verify.ts`. A typo in any file would silently break the handoff with no compiler protection.
**Suggestion:** Define `as const` string constants in `types.ts` or a new `constants.ts` and import in all three files.

---

### [P2] Hardcoded "12 of 14" threshold in verify prompt
**File:** `src/prompts/verify.ts:83`
**Issue:** The string `"At least 12 of 14 gut_checks"` is a hardcoded literal. `index.ts` already computes the count dynamically via `Object.keys(checks).length`. If a 15th gut check is added, the prompt would still say "12 of 14."
**Suggestion:** Derive count and threshold from constants and interpolate into the prompt string.

---

### [P2] UTC timezone leaks through `toISOString().slice(0,10)` in classify
**File:** `src/pipeline/classify.ts:10`
**Issue:** `toISOString()` returns UTC. After 5 PM Pacific (midnight UTC), the LLM receives tomorrow's date. This affects timeline_band classification and the LLM's year-assumption logic for dates like "March 22."
**Suggestion:** Use `new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })` which returns YYYY-MM-DD in Pacific time.

---

### [P2] `enrichClassification` JSDoc claims "pure function" but it reads the system clock
**File:** `src/pipeline/enrich.ts:7`
**Issue:** The JSDoc was accurate before this changeset. The addition of `new Date()` on line 17 makes the function impure. Misleading documentation is a maintenance risk.
**Suggestion:** Inject `today` as a parameter (preferred) or update the JSDoc.

---

### [P3] `resolveFormatRouting` uses `tier === "premium"` as proxy for "corporate"
**File:** `src/pipeline/enrich.ts:86-88`
**Issue:** The code comment says "corporate background" but `tier: "premium"` also matches luxury weddings, quinceañeras at high-end venues, etc. The heuristic is reasonable for now but could mis-route a non-corporate premium event.
**Suggestion:** Add a code comment acknowledging the limitation, or add an explicit `event_type_category` field to Classification.

---

### [P3] Format routing concerns appended without duplicate guard
**File:** `src/pipeline/enrich.ts:30-36`
**Issue:** If `enrichClassification` were called twice (future retry logic, edit pipeline path), `flagged_concerns` would contain duplicates. Not an active bug in the current pipeline, but the append pattern has no idempotency guard.
**Suggestion:** Check `!enriched.flagged_concerns.includes(concern)` before appending.

---

### [P3] `buildVerifyPrompt` takes `pricing` as optional but gut checks depend on enriched data
**File:** `src/prompts/verify.ts:10`
**Issue:** `pricing` is optional, which was fine when only `budget_acknowledged` depended on it. Now `mariachi_pricing_format` depends on `classification.flagged_concerns`, which depends on enrichment, which depends on pricing. The optional parameter masks a real dependency.
**Suggestion:** Make `pricing` required.
