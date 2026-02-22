# Batch 3 — Code Quality and Abstractions Results

**Branch:** rubric-comparison-fixes
**Date:** 2026-02-21
**Commits:** 0874426, 3db252b, 6f3553a, 0f74994, 1dfc29e, 15d5b2c, bfe76cc, 2406541

## Changes Made

### #5: Optional vs required-nullable type inconsistency
**File:** `src/types.ts:42,50`, `src/enrich-generate.test.ts:33-34`
**What changed:** Removed `?` from `event_date_iso` and `event_energy` in the Classification interface — both are now `string | null` and `"background" | "performance" | null` respectively. Updated test fixture to include the now-required fields.
**Review finding:** P2 — Optional vs required-nullable inconsistency; `?` with `| null` hides the LLM contract.

---

### #6: Magic string constants for flagged_concerns
**File:** `src/types.ts:1-3`, `src/pipeline/enrich.ts:37-39`, `src/prompts/generate.ts:217,226`, `src/prompts/verify.ts:171,176`
**What changed:** Exported `CONCERN_4PIECE_ALT` and `CONCERN_FULL_ENSEMBLE` constants from types.ts. Replaced all 6 inline string occurrences across enrich.ts, generate.ts, and verify.ts.
**Review finding:** P2 — Magic strings for flagged_concerns duplicated across 3 files; typo risk.

---

### #7: Hardcoded "12 of 14" threshold in verify prompt
**File:** `src/types.ts:98-116`, `src/prompts/verify.ts:1,83`
**What changed:** Added `GUT_CHECK_KEYS` constant array (14 entries), `GUT_CHECK_TOTAL` (14), and `GUT_CHECK_THRESHOLD` (12) to types.ts. Verify prompt now uses `${GUT_CHECK_THRESHOLD} of ${GUT_CHECK_TOTAL}` instead of literal "12 of 14".
**Review finding:** P2 — Hardcoded threshold drifts silently if gut checks are added/removed.

---

### #15 + #16 + #23: Conditional spread readability, named type, dedup guard
**File:** `src/pipeline/enrich.ts:4-8,36-48,72`
**What changed:** (1) Extracted `FormatRoutingResult` named interface for the routing return type. (2) Replaced nested conditional spread with explicit if-block for concern insertion. (3) Added `includes()` guard to prevent duplicate flagged_concerns entries.
**Review finding:** P3 — Conditional spread hard to read; anonymous return type; no deduplication guard on concerns array.

---

### #19: Builder function naming inconsistency
**File:** `src/prompts/verify.ts:63,130`
**What changed:** Renamed `buildBudgetAcknowledgedInstruction` to `buildBudgetInstruction` — now all four builders follow `build{Concept}Instruction` pattern.
**Review finding:** P3 — Budget builder verbose compared to the other three; inconsistent naming.

---

### #26: buildVerifyPrompt takes pricing as optional
**File:** `src/prompts/verify.ts:7-12`, `src/pipeline/verify.ts:8-13`
**What changed:** Made `pricing` parameter required in both `buildVerifyPrompt` and `verifyGate`. Removed the `?? { tier: "none" }` fallback. All callers already pass pricing.
**Review finding:** P3 — Optional pricing with silent default could mask a missing argument.

---

### #14: Unit test uses fragile reference equality
**File:** `src/enrich-generate.test.ts:60,69`
**What changed:** Replaced `assert.equal(result, c)` (reference equality) with `assert.deepStrictEqual(result, c)` (value equality) in two no-op enrichment tests.
**Review finding:** P2 — Reference equality breaks if implementation switches to always-spread.

---

### #21: Error message leaks raw LLM response
**File:** `src/claude.ts:61-65`
**What changed:** Truncated the raw response to first 200 characters in the JSON parse error message. Full response no longer appears in logs.
**Review finding:** P3 — Full LLM response in error could leak to logs or error surfaces.

## Considered but Rejected

- **Deriving gut check type from GUT_CHECK_KEYS array** — Considered using `typeof GUT_CHECK_KEYS[number]` to derive the gut_checks Record type automatically. Rejected because it would require changing the GateResult interface from explicit named booleans to a computed Record, losing the self-documenting property names in the type definition. The constant array + manual interface is slightly redundant but much clearer.
- **Matching builder names to exact gut check keys** (e.g., `buildPastDateAcknowledgedInstruction`) — Would make the names very long. The shorter descriptive pattern is more readable.
- **Making `event_date_iso` and `event_energy` fully required (not nullable)** — These can legitimately be null when the lead doesn't mention a date or energy level. Required-nullable is the correct contract.

## Deferred to Later Batch

- Nothing deferred from Batch C.

## Three Questions

### 1. Hardest decision in this batch?

Fix #7 — whether to derive the gut check type from the constant array or keep the array and interface separate. Auto-derivation would be DRYer, but it replaces explicit named booleans (`can_see_it: boolean`) with a computed `Record<typeof GUT_CHECK_KEYS[number], boolean>`, which is harder to read and loses the inline documentation. Keeping both means they could drift, but the count is what matters for the threshold, and the type stays human-readable.

### 2. What did you reject, and why?

Rejected auto-deriving the GateResult gut_checks type from the constant array. The explicit interface is self-documenting — you can see every gut check name at a glance without resolving a type alias. The redundancy risk (adding a key to one but not the other) is real but low, since gut checks change rarely and a missing key would surface immediately in the verify prompt output.

### 3. Did anything in this batch change the scope or approach for the next batch?

No. Batch D is all deferred items (new dependencies, product decisions). Nothing in Batch C's type changes, constant extractions, or refactors affects those deferred findings.
