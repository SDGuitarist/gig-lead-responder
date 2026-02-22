# Code Simplicity Reviewer -- Review Findings

**Agent:** code-simplicity-reviewer
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8
**Commits reviewed:** 9119acd, bdf31e6, b807909, b68bb33, 09897ca

## Findings

### [P3] Redundant date-to-string conversion in enrich.ts

**File:** `src/pipeline/enrich.ts:17`
**Issue:** `parseLocalDate(new Date().toISOString().slice(0, 10))` round-trips a Date
through a string and back into a Date. You already have the current date as a Date
object -- you are converting Date -> ISO string -> slice -> Date. The comparison
`eventDate < today` only needs day-level granularity, but the round-trip adds
unnecessary steps.
**Suggestion:** Compare directly without re-parsing. For example:

```ts
const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
```

This avoids the string round-trip entirely. The noon trick from `parseLocalDate`
is still achieved by passing 12 as the hour.

**LOC impact:** ~0 (same line count, clearer intent)

---

### [P3] Three sequential spread copies in enrichClassification

**File:** `src/pipeline/enrich.ts:12-50`
**Issue:** The function creates up to three shallow copies of the classification
object via spread (`{ ...enriched, ... }`), once per enrichment step. Each spread
allocates a new object and copies every key. With a 20+ field Classification, this
means up to three full copies.

Since this is a synchronous function and no intermediate value escapes the function,
you could build a single mutation object and spread once at the end:

```ts
const overrides: Partial<Classification> = {};
// ... set overrides.past_date_detected, overrides.format_recommended, etc.
return Object.keys(overrides).length > 0
  ? { ...classification, ...overrides }
  : classification;
```

**Suggestion:** This is a minor optimization and a judgment call. The current code
is readable and each block is self-contained. If you prefer the explicit
"one spread per concern" style for clarity, that is a valid tradeoff. Flagging it
because three spreads for one function is worth noticing, not because it is a
must-fix.

**LOC impact:** ~2-3 lines saved

---

### [P2] Duplicated concern-flag string literals across enrich.ts and generate.ts

**File:** `src/pipeline/enrich.ts:33-34` and `src/prompts/generate.ts:217,226`
**Issue:** The strings `"mention_4piece_alternative"` and
`"mention_full_ensemble_upgrade"` appear as raw string literals in two files:
`enrich.ts` (where they are pushed into `flagged_concerns`) and `generate.ts`
(where they are checked via `.includes()`). They also appear in `verify.ts:171,176`.
Three files, same magic strings. A typo in any one location silently breaks the
feature with no error.
**Suggestion:** Define them as constants in one place and import:

```ts
// src/constants.ts (or at the top of enrich.ts, exported)
export const CONCERN_4PIECE_ALT = "mention_4piece_alternative";
export const CONCERN_FULL_UPGRADE = "mention_full_ensemble_upgrade";
```

Then import in all three files. This is the simplest fix for the highest-risk
category of bug (silent mismatch).

**LOC impact:** +3 (constant file), 0 net (replace literals with imports)

---

### [P3] resolveFormatRouting return type is over-specified

**File:** `src/pipeline/enrich.ts:60-62`
**Issue:** The inline return type `{ format_recommended: Format; show_alternative: boolean } | null`
is used exactly once, by one caller. It is not wrong, but it adds visual weight to
what is otherwise a clean private helper. TypeScript infers the return type
correctly if you omit it.
**Suggestion:** Let TypeScript infer the return type. The function is private
(not exported), so no downstream contract needs the explicit annotation. If you
prefer explicit types on every function as a project convention, keep it -- but
for a private helper called in one place, inference is simpler.

**LOC impact:** ~1 line shorter

---

### [P3] buildCulturalVocabBlock and buildDualFormatBlock inject prompt text that overlaps

**File:** `src/prompts/generate.ts:192-234`
**Issue:** `buildCulturalVocabBlock` injects the CULTURAL VOCABULARY block with
FAIL/PASS examples. Separately, `buildDualFormatBlock` injects the Dual Format
pricing anchor instructions. Both are called sequentially on line 116-117 and
concatenated into the prompt. This is fine architecturally -- each handles a
distinct concern. However, both functions independently check
`classification.flagged_concerns` and `classification.cultural_context_active`,
which the caller (`buildGeneratePrompt`) also has access to. The dispatch logic
is spread across the caller and the callees.

**Suggestion:** No change needed now. This is noting a complexity smell, not a
bug. If a third conditional block gets added in the same pattern, consider
refactoring all three into a single "build conditional blocks" function that
returns a combined string. For now, two is fine.

**LOC impact:** 0

---

### [P1] `today` is computed in two places with different methods

**File:** `src/pipeline/classify.ts:10` and `src/pipeline/enrich.ts:17`
**Issue:** `classifyLead` computes today as
`new Date().toISOString().slice(0, 10)` and passes it to the classify prompt.
`enrichClassification` independently computes today using the same expression
and passes it through `parseLocalDate`. These two `new Date()` calls will return
the same day in almost all cases, but they are called at different times during
pipeline execution. If the pipeline runs across midnight (unlikely but possible),
they could disagree -- classify says "2026-02-21" and enrich says "2026-02-22",
which would produce wrong results on the past-date check.

More importantly, having two sources of "today" is a testability problem. Neither
function accepts `today` as a parameter, so you cannot write a deterministic test
for past-date detection without mocking `Date`.

**Suggestion:** Compute `today` once at the pipeline entry point (e.g., in
`runPipeline`) and thread it through as a parameter. Both `classifyLead` and
`enrichClassification` should accept it:

```ts
// In runPipeline or main:
const today = new Date().toISOString().slice(0, 10);

// Then:
const classification = await classifyLead(rawText, today);
const enriched = enrichClassification(classification, pricing, today);
```

This eliminates the drift risk and makes both functions testable with a fixed
date.

**LOC impact:** +2 (parameter additions), -2 (remove internal Date calls), net 0

---

### [P3] pastDateBlock ternary creates a large multiline string inline

**File:** `src/prompts/generate.ts:17-23`
**Issue:** The `pastDateBlock` ternary is clear and correct, but the "true" branch
is a 4-line template literal inside a ternary. This is the same pattern as
`budgetBlock` (which uses a helper function). The inconsistency is minor -- one
conditional block uses a helper, the other is inline.
**Suggestion:** If you add more conditional blocks to the prompt header, extract
`pastDateBlock` into a helper for consistency with `buildBudgetModeBlock`. For
now, inline is fine -- it is only used once and is short enough to read.

**LOC impact:** 0

---

### [P3] `event_date_iso` and `event_energy` are optional in types.ts but always present after classification

**File:** `src/types.ts:42-43,50`
**Issue:** Both `event_date_iso` and `event_energy` are declared with `?`
(optional) in the Classification interface. This means every consumer must
null-check them even though the LLM always returns them (the classify prompt
schema requires them). The `?` was likely added because old classification
results (before this feature) do not have these fields, but going forward they
will always be present.

The `past_date_detected` field (line 43) is correctly optional -- it is set by
TypeScript code, not the LLM, so it genuinely may not exist.

**Suggestion:** If you are not loading old classification JSON from a database
that lacks these fields, change `event_date_iso` and `event_energy` from
optional (`?`) to required with `| null`:

```ts
event_date_iso: string | null;
event_energy: "background" | "performance" | null;
```

This matches the prompt schema (which always returns them, possibly as null) and
eliminates unnecessary optional chaining in consumers. If backward compatibility
with stored data is needed, keep the `?`.

**LOC impact:** 0 (type-level only)

---

### [P2] Verify prompt hardcodes "12 of 14" threshold

**File:** `src/prompts/verify.ts:83`
**Issue:** The threshold `At least 12 of 14 gut_checks` is a raw number in the
prompt string. The denominator (14) is the count of keys in `gut_checks`, which
is defined in `types.ts`. If another gut check is added, this string must be
manually updated in two places: the prompt text AND the `GateResult` interface.
The `index.ts` display already uses
`Object.keys(checks).length` dynamically (line 103), but the verify prompt does
not.

**Suggestion:** Compute the threshold from the actual gut check count. Since the
prompt is a string template, you could do:

```ts
const totalChecks = 14; // or derive from a shared constant
const threshold = totalChecks - 2;
// then in the prompt:
`At least ${threshold} of ${totalChecks} gut_checks are true`
```

Better yet, derive `totalChecks` from the GateResult type keys if possible, or
define a constant shared between `types.ts` and `verify.ts`. This way adding a
gut check only requires updating one place.

**LOC impact:** +2 lines, prevents a future manual sync bug

---

### [P3] classify prompt repeats "mariachi_full (default)" rule that code overrides

**File:** `src/prompts/classify.ts:91`
**Issue:** The classify prompt tells the LLM: "mariachi_full (default). Code may
override to mariachi_4piece for weekday corporate background events -- classify
the event context signals, not the format constraint." Meanwhile,
`resolveFormatRouting` in `enrich.ts` implements the actual override logic. The
prompt instruction is accurate -- it tells the LLM to focus on signals rather
than format rules. But the phrase "Code may override" leaks an implementation
detail into the LLM prompt. The LLM does not need to know that code will
override its decision; it just needs to know what to output.

**Suggestion:** Simplify to: "Mexican heritage event + ANY guitar/music request
-> mariachi_full (default)." Remove the "Code may override" clause. The LLM does
not act on it, and removing it makes the prompt shorter and cleaner. The LLM's
job is to classify `event_energy` correctly (background vs. performance), which
it already does from the separate `event_energy` field instruction.

**LOC impact:** -1 sentence in prompt

---

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P1       | 1     | `today` computed independently in two pipeline stages (drift + testability risk) |
| P2       | 2     | Magic string literals duplicated across 3 files; hardcoded 12/14 threshold |
| P3       | 7     | Minor readability/consistency items (spread pattern, type optionality, prompt wording, inline ternary, return type annotation, round-trip date conversion, overlapping block builders) |

**Total potential LOC reduction:** ~5-8 lines (this feature is already lean)
**Complexity score:** Low -- the changes are well-structured, each concern is
isolated into its own function, and the prompt instructions are specific.
**Recommended action:** Fix P1 (thread `today` as parameter) and P2 (extract
magic strings as constants, compute threshold dynamically). P3 items are optional
and can be addressed if you are already editing those files for another reason.
