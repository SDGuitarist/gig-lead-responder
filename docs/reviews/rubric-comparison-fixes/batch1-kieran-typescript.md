# Kieran TypeScript Reviewer -- Review Findings

**Agent:** kieran-typescript-reviewer
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8
**Commits:** 9119acd, bdf31e6, b807909, b68bb33, 09897ca

## Summary

Solid feature work across 5 commits. The changes add past-date detection, mariachi format routing, cultural vocabulary enforcement, and three new gut checks. The new `src/utils/dates.ts` module and the `resolveFormatRouting` extraction in `enrich.ts` are clean, well-scoped additions. The prompt files are prompt-engineering (string templates), not logic, so I am reviewing them for structural concerns rather than prose content.

Most findings are P2/P3. One P1 around testability of date-dependent code.

---

## Findings

### [P1] Date construction uses `new Date()` inline -- untestable and inconsistent across call sites
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:17`
**Also:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/classify.ts:10`
**Issue:** `new Date()` is called directly in two different pipeline stages (`classify.ts` line 10 and `enrich.ts` line 17). This makes both functions impossible to test with a controlled date. If the pipeline runs at 11:59 PM Pacific, `classify.ts` and `enrich.ts` could disagree on what "today" is because they construct the date independently at different moments during execution.

In `classify.ts`, the date is passed as a parameter to `buildClassifyPrompt(today)` -- good pattern. But in `enrich.ts`, the date is constructed inline:

```typescript
// enrich.ts:17
const today = parseLocalDate(new Date().toISOString().slice(0, 10));
```

**Suggestion:** Extract today's date once at the pipeline entry point (the caller of both `classifyLead` and `enrichClassification`) and thread it through as a parameter. This is the same pattern already used for `classify.ts` -- extend it to `enrich.ts`:

```typescript
// enrich.ts signature becomes:
export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
  today: Date,  // or: todayISO: string
): Classification {
```

This makes both functions deterministically testable and eliminates the clock-skew risk between pipeline stages. Until this is fixed, you cannot write a reliable unit test for past-date detection without mocking globals.

---

### [P2] `enrichClassification` docstring claims "pure function" but it reads the system clock
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:5`
**Issue:** The JSDoc says "Pure function -- returns a new object when overriding, original when not." After this change, the function reads `new Date()` on line 17, which is a side effect. A pure function produces the same output for the same inputs -- this one does not, because the output depends on the wall clock.

**Suggestion:** Fix the docstring to say "Deterministic when today is injected" (after applying the P1 fix above), or remove the "pure function" claim. Misleading docstrings are worse than no docstrings because they teach the wrong mental model.

---

### [P2] Optional fields on `Classification` use `?` (property-missing) instead of required with `| null`
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/types.ts:42-43,50`
**Issue:** The new fields are typed as optional properties:

```typescript
event_date_iso?: string | null;
past_date_detected?: boolean;
event_energy?: "background" | "performance" | null;
```

This creates three possible states for `event_date_iso`: `undefined` (property absent), `null` (explicitly no date), and a string value. The `?` modifier means consuming code must handle both `undefined` and `null`, and TypeScript will not warn if you forget to check for `undefined` vs `null` depending on your strictness settings.

Compare with how `stated_budget` is handled on line 38 -- it is a required field typed as `number | null`. No ambiguity: the field always exists, it is either a number or explicitly null.

The LLM can return `null` (instructed to in the prompt) but will never return `undefined` (JSON has no `undefined`). Meanwhile, `past_date_detected` is computed in TypeScript code and defaults to absent. This mismatch between "LLM-returned fields" and "code-computed fields" deserves different treatment.

**Suggestion:** Make LLM-returned fields required with `| null` (matching `stated_budget`'s pattern). Keep `past_date_detected` as optional since it is code-computed and genuinely absent until enrichment runs:

```typescript
// LLM returns these -- always present in JSON
event_date_iso: string | null;
event_energy: "background" | "performance" | null;

// Code-computed -- genuinely optional
past_date_detected?: boolean;
```

This aligns with the existing convention in the file and prevents the triple-state ambiguity for LLM-returned data.

---

### [P2] `flagged_concerns` is typed as `string[]` -- concern values are magic strings
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:32-33`
**Also:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/generate.ts:217,226`
**Also:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/verify.ts:171,176`
**Issue:** The new code introduces two concern strings `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` that are checked via `.includes()` in three separate files. These are effectively a protocol between `enrich.ts` (producer) and `generate.ts`/`verify.ts` (consumers). If someone typos one string, the system silently does nothing.

```typescript
// enrich.ts produces:
"mention_4piece_alternative"

// generate.ts consumes:
classification.flagged_concerns.includes("mention_4piece_alternative")

// verify.ts also consumes:
classification.flagged_concerns.includes("mention_4piece_alternative")
```

**Suggestion:** This is a known concern pattern -- not new to this feature, since `flagged_concerns` was already `string[]`. However, since this feature adds the first concerns that are produced by TypeScript code (rather than by the LLM), it is worth flagging: these two strings should be constants or a union type. A simple starting point:

```typescript
// In types.ts or a constants file
export const CONCERN_4PIECE_ALT = "mention_4piece_alternative" as const;
export const CONCERN_FULL_UPGRADE = "mention_full_ensemble_upgrade" as const;
```

This is not blocking since it is a pre-existing pattern, but this feature makes it worse by adding code-to-code string matching (not just LLM-to-code).

---

### [P2] `buildDualFormatBlock` uses `pricing.quote_price` which may be stale after format routing override
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/prompts/generate.ts:220`
**Issue:** When `resolveFormatRouting` in `enrich.ts` overrides `format_recommended` (e.g., from `mariachi_4piece` to `mariachi_full`), the pricing was computed before the override. The `buildDualFormatBlock` function then injects `pricing.quote_price` into the prompt:

```typescript
Lead with the full ensemble at $${pricing.quote_price}.
```

But `pricing.quote_price` was calculated for the original format, not the overridden one. If the full ensemble costs more than the 4-piece, the prompt will instruct the LLM to "lead with the full ensemble" at the 4-piece price.

**Suggestion:** Verify the pipeline ordering. If `enrichClassification` runs after pricing (which the function signature `(classification, pricing)` suggests), then the pricing was computed against the pre-override format. Either:
1. Re-price after enrichment, or
2. Document why the price is correct (e.g., "pricing always uses the final format because X runs first")

I cannot confirm the severity without reading the full pipeline orchestrator, but this smells like a logic bug.

---

### [P3] `resolveFormatRouting` return type could use a named type
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:61-62`
**Issue:** The return type is an inline object literal:

```typescript
function resolveFormatRouting(
  classification: Classification,
): { format_recommended: Format; show_alternative: boolean } | null {
```

This is fine for a private helper, but it appears three times in the function body as return values. If the shape changes, you update the signature and hope you got all three returns right.

**Suggestion:** Extract to a named type for clarity:

```typescript
interface FormatRoutingResult {
  format_recommended: Format;
  show_alternative: boolean;
}
```

Not blocking -- the function is small and local. This is a readability preference.

---

### [P3] `parseLocalDate` has no input validation
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/utils/dates.ts:6-8`
**Issue:** The function trusts that `isoDate` is a valid `YYYY-MM-DD` string. If the LLM returns a malformed date (e.g., `"March 22"` or `"2026-13-45"`), `new Date("March 22T12:00:00")` returns `Invalid Date` and all downstream comparisons silently produce `false`.

```typescript
export function parseLocalDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}
```

**Suggestion:** At minimum, check for `Invalid Date` and throw:

```typescript
export function parseLocalDate(isoDate: string): Date {
  const date = new Date(`${isoDate}T12:00:00`);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date: "${isoDate}"`);
  }
  return date;
}
```

This converts a silent wrong answer into a loud failure. Since this is LLM-sourced data, defensive parsing matters.

---

### [P3] Repeated `new Date().toISOString().slice(0, 10)` pattern for "today as ISO string"
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/classify.ts:10`
**Also:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:17`
**Issue:** The same expression appears in two files. It is a small pattern, but the `toISOString()` method returns UTC, not local time. At 11 PM Pacific on March 14, `toISOString().slice(0, 10)` returns `"2026-03-15"`. This is the exact timezone bug that `parseLocalDate` was written to prevent -- but the bug is re-introduced at the point where "today" is determined.

**Suggestion:** Add a `todayISO()` function to `src/utils/dates.ts` that returns today's local date as an ISO string, avoiding UTC:

```typescript
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

Then use it in both call sites (or better, in the single pipeline entry point per the P1 fix).

---

### [P3] Conditional spread in object literal is harder to read than explicit assignment
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/enrich.ts:29-35`
**Issue:** The conditional concern injection uses a spread pattern that is correct but dense:

```typescript
enriched = {
  ...enriched,
  format_recommended: routing.format_recommended,
  ...(routing.show_alternative && {
    flagged_concerns: [
      ...enriched.flagged_concerns,
      routing.format_recommended === "mariachi_full"
        ? "mention_4piece_alternative"
        : "mention_full_ensemble_upgrade",
    ],
  }),
};
```

The `...(condition && { key: value })` pattern is a known TypeScript idiom, but here it nests a ternary inside an array spread inside a conditional spread inside an object spread. Four levels of nesting in one expression.

**Suggestion:** Split into two steps for readability:

```typescript
enriched = { ...enriched, format_recommended: routing.format_recommended };

if (routing.show_alternative) {
  const concern = routing.format_recommended === "mariachi_full"
    ? "mention_4piece_alternative"
    : "mention_full_ensemble_upgrade";
  enriched = {
    ...enriched,
    flagged_concerns: [...enriched.flagged_concerns, concern],
  };
}
```

More lines, but each line does one thing. Follows the project's own principle: duplication over complexity.

---

### [P3] `classifyLead` does not validate the new optional fields from LLM response
**File:** `/Users/alejandroguillen/Projects/gig-lead-responder/src/pipeline/classify.ts:17-28`
**Issue:** The function validates `format_recommended`, `duration_hours`, `rate_card_tier`, and `lead_source_column` -- but the new `event_date_iso` and `event_energy` fields have no validation. Since these are now consumed by deterministic TypeScript code in `enrichClassification` (not just passed into prompts), malformed values could cause subtle bugs.

For example, if the LLM returns `event_date_iso: "March 22"` instead of `"2026-03-22"`, `parseLocalDate` will silently produce `Invalid Date` (per the P3 finding above), and past-date detection will silently skip.

**Suggestion:** Add a lightweight format check for `event_date_iso` when it is not null:

```typescript
if (result.event_date_iso && !/^\d{4}-\d{2}-\d{2}$/.test(result.event_date_iso)) {
  console.warn(`Unexpected event_date_iso format: "${result.event_date_iso}", treating as null`);
  result.event_date_iso = null;
}
```

This is defensive programming against LLM non-compliance. Warn and degrade gracefully rather than propagating garbage.

---

## Non-Issues (reviewed, no action needed)

1. **`src/index.ts` changes** -- Minimal, clean. The `past_date_detected` log line at line 59-61 follows the existing pattern. The dynamic gut check count on line 103 (`Object.keys(checks).length`) automatically adapts to the three new checks without hardcoding. Good.

2. **`src/prompts/verify.ts` helper functions** -- `buildPastDateInstruction`, `buildMariachiPricingInstruction`, `buildCulturalVocabInstruction` all follow the exact same pattern as the existing `buildBudgetAcknowledgedInstruction`. Consistent, easy to follow. The "Always true" no-op pattern for inactive checks is clean.

3. **`src/prompts/generate.ts` new functions** -- `buildCulturalVocabBlock` and `buildDualFormatBlock` are well-extracted from the main prompt template. Each has a clear single responsibility and returns empty string when not applicable.

4. **`src/utils/dates.ts`** -- Good extraction. The noon-anchor pattern is well-documented with a clear JSDoc explaining the UTC midnight rollover problem. The file is small and focused.

5. **Gate threshold update 9/11 to 12/14** -- Correctly updated in `verify.ts` line 83 to match the three new gut checks. The output JSON schema in the same file is also updated.

6. **Import organization** -- All new imports follow the existing pattern (type imports separated, internal modules grouped). No issues.

---

## Verdict

The feature is well-structured. The code changes are proportional to the feature scope -- no unnecessary complexity was added to existing modules. The `enrichClassification` function grew in responsibility but each concern (past-date, format routing, budget) is cleanly separated within it, and `resolveFormatRouting` was correctly extracted as a private helper.

**Blocking issues:** None. The P1 (testability/clock-skew) is the most important fix but does not cause incorrect behavior under normal conditions (pipeline stages execute within seconds of each other). It becomes a problem when you try to write tests.

**Recommended priority order for fixes:**
1. P1: Thread today's date from pipeline entry point (testability + correctness)
2. P2: Fix optional field types on Classification (type safety)
3. P2: Verify pricing/format-override ordering (potential logic bug)
4. P3: Add parseLocalDate validation (defensive against LLM)
5. P3: Extract todayISO to fix UTC-at-midnight bug
