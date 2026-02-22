# Pattern Recognition Specialist — Review Findings

**Agent:** pattern-recognition-specialist
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Findings

### [P2] Duplicated "today" computation — two call sites derive today's date with identical logic
**File:** `src/pipeline/classify.ts:10` and `src/pipeline/enrich.ts:17`
**Issue:** Both files compute today's date as `new Date().toISOString().slice(0, 10)`. This is the same expression copied in two places. In `classify.ts` it is passed into the prompt builder so the LLM knows today's date; in `enrich.ts` it is passed through `parseLocalDate()` for comparison. The duplication is small, but the real concern is consistency: if someone later changes how "today" is determined (for testing, for timezone control), they must remember to update both call sites. Additionally, `classify.ts` does NOT use `parseLocalDate()` — it feeds the raw ISO string into the prompt — while `enrich.ts` does. This means the two files could disagree on what "today" means if the system runs near midnight Pacific time.

```typescript
// classify.ts:10
const today = new Date().toISOString().slice(0, 10);

// enrich.ts:17
const today = parseLocalDate(new Date().toISOString().slice(0, 10));
```

**Suggestion:** Extract a `getToday(): string` function into `src/utils/dates.ts` next to `parseLocalDate`. Both call sites import it. This also gives a single place to inject a fixed date during testing.

---

### [P2] "today" in classify.ts uses UTC while enrich.ts uses local noon — timezone mismatch
**File:** `src/pipeline/classify.ts:10` vs `src/pipeline/enrich.ts:17`
**Issue:** `new Date().toISOString().slice(0, 10)` returns the date in **UTC**. The whole purpose of `parseLocalDate()` in `src/utils/dates.ts` is to avoid UTC midnight rollover — the JSDoc comment explicitly states: `new Date("2026-03-14") = UTC midnight = March 13 in Pacific`. But the input to both call sites is still derived from `toISOString()`, which is UTC. At 11 PM Pacific (7 AM UTC next day), `toISOString().slice(0, 10)` returns **tomorrow's date**, so `classify.ts` tells the LLM "today is February 22" when it is still February 21 in San Diego. `enrich.ts` then compares the event date against this same wrong "today." The `parseLocalDate` noon trick fixes the day-of-week for a known ISO string, but does not fix the fact that the "today" string itself is UTC-derived.

```typescript
// This runs at 11 PM Pacific on Feb 21:
new Date().toISOString().slice(0, 10) // → "2026-02-22" (UTC)
// classify.ts tells the LLM "Today's date is 2026-02-22" — wrong for Pacific
// enrich.ts compares event dates against Feb 22 — wrong for Pacific
```

**Suggestion:** Replace `new Date().toISOString().slice(0, 10)` with a helper that formats using Pacific time explicitly. A minimal version:

```typescript
export function getTodayPacific(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  // "en-CA" locale produces YYYY-MM-DD format
}
```

This is the highest-impact finding because the entire past-date detection feature relies on "today" being correct for the San Diego business.

---

### [P3] Magic string constants for flagged concerns used across three files
**File:** `src/pipeline/enrich.ts:33-34`, `src/prompts/generate.ts:217,226`, `src/prompts/verify.ts:171-172,176`
**Issue:** The strings `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` are hard-coded in three separate files. If one is misspelled or renamed, the others silently stop matching. This is a classic "stringly-typed" anti-pattern. The concern names are effectively a protocol between `enrich.ts` (producer) and `generate.ts` / `verify.ts` (consumers), but no type system enforces the contract.

```typescript
// enrich.ts:33 — producer
routing.format_recommended === "mariachi_full"
  ? "mention_4piece_alternative"
  : "mention_full_ensemble_upgrade",

// generate.ts:217 — consumer
if (classification.flagged_concerns.includes("mention_4piece_alternative")) {

// verify.ts:176 — consumer
if (classification.flagged_concerns.includes("mention_4piece_alternative")) {
```

**Suggestion:** Define these as exported constants in `src/types.ts`:

```typescript
export const CONCERN_4PIECE_ALT = "mention_4piece_alternative" as const;
export const CONCERN_FULL_ENSEMBLE = "mention_full_ensemble_upgrade" as const;
```

Then import and reference the constant everywhere. A typo becomes a compile error instead of a silent mismatch.

---

### [P3] `enrichClassification` is no longer a pure function as documented
**File:** `src/pipeline/enrich.ts:7`
**Issue:** The JSDoc says "Pure function — returns a new object when overriding, original when not." However, the function now calls `new Date()` internally (line 17), which makes it impure — the result depends on the current clock, not just the inputs. This was introduced when past-date detection moved into the enrich step. The impurity makes unit testing harder (you cannot control what "today" is without mocking `Date`) and contradicts the documented contract.

```typescript
/**
 * Enrich classification based on budget gap, date analysis, and format routing.
 * Pure function — returns a new object when overriding, original when not.
 */
export function enrichClassification(
  classification: Classification,
  pricing: PricingResult,
): Classification {
  // ...
  const today = parseLocalDate(new Date().toISOString().slice(0, 10)); // impure
```

**Suggestion:** Either (a) accept `today: string` as a third parameter and have the caller provide it (restoring purity), or (b) update the JSDoc to remove the "Pure function" claim. Option (a) is preferable because it aligns with how `buildClassifyPrompt(today)` already works — the caller injects the date.

---

### [P3] Optional fields `event_date_iso`, `past_date_detected`, and `event_energy` use `?` modifier but LLM always outputs them
**File:** `src/types.ts:42-43,50`
**Issue:** These three new fields are declared optional (`?`) in the `Classification` interface, but the classify prompt's JSON schema (in `src/prompts/classify.ts:140-143`) tells the LLM to always include them (with `null` as the "absent" value). The optional modifier means TypeScript allows these fields to be `undefined` at any call site, forcing consumers to guard against both `undefined` and `null`. In contrast, `stated_budget` (a similar "might not exist" field from a previous iteration) is typed as `number | null` without `?` — always present, sometimes null. The new fields break that convention.

```typescript
// Existing convention (non-optional, nullable):
stated_budget: number | null;

// New fields break the convention (optional AND nullable):
event_date_iso?: string | null;
past_date_detected?: boolean;
event_energy?: "background" | "performance" | null;
```

**Suggestion:** Remove the `?` modifier from `event_date_iso` and `event_energy` to match the `stated_budget` convention. Keep them as `string | null` and `"background" | "performance" | null`. For `past_date_detected`, since it is computed by TypeScript code (not the LLM), default it to `false` in `enrichClassification` and type it as `boolean` (non-optional) — or keep it optional since it is truly absent until enrichment runs.

---

### [P3] Builder functions in verify.ts follow a consistent no-op pattern — good design, minor naming inconsistency
**File:** `src/prompts/verify.ts:158,169,186`
**Issue:** The three new builder functions (`buildPastDateInstruction`, `buildMariachiPricingInstruction`, `buildCulturalVocabInstruction`) all follow the same pattern as the existing `buildBudgetAcknowledgedInstruction`: return "Always true" when the check does not apply, return a specific instruction when it does. This is a well-applied **Null Object / No-Op pattern** and keeps the verify prompt clean. However, the naming is slightly inconsistent: the existing function uses "Acknowledged" (`buildBudgetAcknowledgedInstruction`) while the new ones drop it (`buildPastDateInstruction`, `buildCulturalVocabInstruction`). The gut check keys themselves are consistent (`budget_acknowledged`, `past_date_acknowledged`, `cultural_vocabulary_used`), but the builder function names do not mirror them uniformly.

```typescript
// Existing:
function buildBudgetAcknowledgedInstruction(...)  // matches gut check: budget_acknowledged

// New:
function buildPastDateInstruction(...)            // gut check: past_date_acknowledged — missing "Acknowledged"
function buildMariachiPricingInstruction(...)      // gut check: mariachi_pricing_format — missing "Format"
function buildCulturalVocabInstruction(...)        // gut check: cultural_vocabulary_used — missing "Used"
```

**Suggestion:** Not urgent, but for consistency, the builder function names could mirror the gut check key names: `buildPastDateAcknowledgedInstruction`, `buildMariachiPricingFormatInstruction`, `buildCulturalVocabularyUsedInstruction`. Alternatively, all four could be shortened to a consistent `build<CheckName>Instruction` where `<CheckName>` exactly matches the gut check key in camelCase.

---

### [P3] Conditional spread in enrichClassification — correct but subtle
**File:** `src/pipeline/enrich.ts:29-35`
**Issue:** The conditional spread `...(routing.show_alternative && { flagged_concerns: [...] })` is a valid JavaScript pattern, but it is one of the more subtle idioms in the codebase. When `show_alternative` is `false`, the spread evaluates to `...false`, which is a no-op. When `true`, it merges a new `flagged_concerns` array. This works correctly, but for a codebase maintained by a beginner developer (per CLAUDE.md), this pattern could be confusing during debugging.

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

**Suggestion:** Consider replacing with a plain `if` block for readability:

```typescript
enriched = { ...enriched, format_recommended: routing.format_recommended };
if (routing.show_alternative) {
  enriched = {
    ...enriched,
    flagged_concerns: [
      ...enriched.flagged_concerns,
      routing.format_recommended === "mariachi_full"
        ? "mention_4piece_alternative"
        : "mention_full_ensemble_upgrade",
    ],
  };
}
```

The behavior is identical but the intent is clearer.

---

### [P1] Past-date detection has no validation for malformed `event_date_iso` strings
**File:** `src/pipeline/enrich.ts:15-21`
**Issue:** `parseLocalDate(classification.event_date_iso)` will produce an Invalid Date if the LLM returns a malformed string (for example, `"March 22"` instead of `"2026-03-22"`, or an empty string). The truthiness check on line 15 (`if (classification.event_date_iso)`) passes for any non-empty string, including malformed ones. `new Date("March 22T12:00:00")` returns `Invalid Date`, and the comparison `Invalid Date < today` returns `false`, so past-date detection silently fails rather than crashing. This is a silent failure mode: a malformed date would not trigger detection and would not produce any error. The same risk applies to `resolveFormatRouting` at line 77, where `parseLocalDate(dateISO).getDay()` on an invalid date returns `NaN`, making `isWeekend` evaluate to `false` (weekday path), potentially applying an incorrect format override.

```typescript
if (classification.event_date_iso) {
  const eventDate = parseLocalDate(classification.event_date_iso);
  // If event_date_iso is "March 22", eventDate is Invalid Date
  // eventDate < today → false → silently skips past-date detection
```

**Suggestion:** Add a validation guard in `parseLocalDate` or at the call site:

```typescript
export function parseLocalDate(isoDate: string): Date {
  const d = new Date(`${isoDate}T12:00:00`);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: "${isoDate}"`);
  }
  return d;
}
```

This converts a silent failure into a visible error. The classify step could also validate `event_date_iso` format with a regex (`/^\d{4}-\d{2}-\d{2}$/`) before passing it downstream.

---

### [P2] `enrichClassification` enrichment order creates a subtle dependency: format routing reads `tier` before budget enrichment may change it
**File:** `src/pipeline/enrich.ts:24,41-49,86-88`
**Issue:** The three enrichment steps run in sequence: (1) past-date detection, (2) format routing, (3) budget enrichment. Format routing checks `classification.tier === "premium"` at line 86-88 to detect corporate background events. Budget enrichment at lines 41-49 can override `tier` to `"qualification"`. Because format routing runs first, it sees the original tier (e.g., `"premium"`), which is the correct behavior for format decisions. However, this ordering dependency is implicit — reordering the enrichment steps would change behavior, and there is no comment explaining why the order matters.

```typescript
// Step 2: Format routing — uses tier before budget may override it
const routing = resolveFormatRouting(enriched); // reads tier === "premium"

// Step 3: Budget — may override tier to "qualification"
if (pricing.budget.tier === "large" || pricing.budget.tier === "no_viable_scope") {
  enriched = { ...enriched, tier: "qualification", close_type: "hesitant" };
}
```

**Suggestion:** Add a comment above the format routing step: `// Must run before budget enrichment — reads original tier for corporate detection`. This protects against accidental reordering.

---

### [P3] `resolveFormatRouting` treats Friday as weekend — domain-correct but worth documenting
**File:** `src/pipeline/enrich.ts:78`
**Issue:** `isWeekend` includes Friday (`day === 5`), which differs from the standard Mon-Fri / Sat-Sun split. This is likely intentional (mariachi bands are booked for Friday evenings), but it is a domain-specific business rule encoded in a boolean with no comment explaining the Friday inclusion.

```typescript
const isWeekend = day === 0 || day === 5 || day === 6; // Fri, Sat, Sun
```

**Suggestion:** Add a brief comment: `// Fri-Sun: 4-piece not available (full ensemble demand)`. This makes the business reasoning visible for future maintainers.

---

### [P3] `buildDualFormatBlock` references `pricing.quote_price` which may be the wrong price when format was overridden
**File:** `src/prompts/generate.ts:220`
**Issue:** When `mention_4piece_alternative` is flagged, `buildDualFormatBlock` outputs: `Lead with the full ensemble at $${pricing.quote_price}`. But `pricing` was computed from the original classification, before format routing changed `format_recommended`. If the format was overridden from `mariachi_4piece` to `mariachi_full`, the `pricing.quote_price` may still reflect the 4-piece rate (since pricing runs before enrichment in the pipeline). Whether this is actually a problem depends on pipeline ordering — if pricing is re-run after enrichment, this is fine. But from the code visible in these files, the pricing result is passed into enrichment as a parameter, implying pricing ran first.

```typescript
return `
**Dual Format: Anchor High**
Lead with the full ensemble at $${pricing.quote_price}. Then offer the 4-piece as:
```

**Suggestion:** Verify that `pricing.quote_price` reflects the post-enrichment format. If pricing runs before enrichment (which the function signature `enrichClassification(classification, pricing)` suggests), the quote price may need to be re-derived or the dual-format block should reference the rate table directly.

---

### [P3] Good pattern: Deterministic code over LLM for objective checks
**File:** `src/pipeline/enrich.ts:14`, `src/pipeline/enrich.ts:60-96`
**Issue:** This is a positive finding, not a problem. The changes consistently move deterministic logic (date comparison, day-of-week format routing) out of the LLM prompt and into TypeScript code. The comment on line 14 — `// Past-date detection (deterministic — never ask the LLM)` — codifies this as a principle. The same pattern applies to format routing: the LLM classifies `event_energy` and `event_date_iso`, but the hard constraint (4-piece weekday only) is enforced in code. This is a strong architectural pattern for a pipeline where LLM outputs are inputs to deterministic business rules.

**Suggestion:** No change needed. Consider documenting this as a project principle (e.g., in CLAUDE.md or a PATTERNS.md): "Objective, rule-based decisions are enforced in TypeScript, not in prompts. The LLM provides signal; code enforces constraints."

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| P1       | 1     | Missing validation for malformed `event_date_iso` — silent failure in date detection and format routing |
| P2       | 3     | UTC timezone mismatch for "today"; duplicated today computation; implicit enrichment ordering dependency |
| P3       | 6     | Optional vs nullable convention inconsistency; magic string constants; impure function documentation; conditional spread readability; Friday-as-weekend comment; dual-format price source |
| Positive | 1     | Deterministic code over LLM for objective checks — strong pattern |

**Top 3 recommendations (by impact):**

1. **Fix the UTC timezone bug** (P2, `classify.ts:10` and `enrich.ts:17`). The entire past-date feature and the "today" injected into the LLM prompt can be wrong after 5 PM Pacific. Use `America/Los_Angeles` timezone-aware formatting.

2. **Add validation to `parseLocalDate`** (P1, `utils/dates.ts:6`). A malformed `event_date_iso` from the LLM silently skips past-date detection and can route mariachi formats incorrectly. Throw on invalid input so the error surfaces immediately.

3. **Extract a `getToday()` helper** (P2, `utils/dates.ts`). Centralizes the "what is today" question, fixes the UTC issue in one place, and enables injecting a fixed date for testing.
