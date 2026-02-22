# Git History Analyzer — Review Findings

**Agent:** compound-engineering:research:git-history-analyzer
**Branch:** main (rubric-comparison-fixes)
**Date:** 2026-02-21
**Files reviewed:** 8

## Findings

### [P1] Stale pricing after format override — wrong dollar amounts in customer-facing drafts
**File:** `src/run-pipeline.ts:84-94` and `src/prompts/generate.ts:220`
**Issue:** `lookupPrice(classification)` at `run-pipeline.ts:84` computes pricing using the original `classification.format_recommended` (which could be `mariachi_4piece`). Then `enrichClassification` at line 94 may override the format to `mariachi_full`. But the `pricing` object is never recomputed. This stale pricing flows into `buildGeneratePrompt` where `buildDualFormatBlock` at `generate.ts:220` tells the LLM: "Lead with the full ensemble at $${pricing.quote_price}" — but `pricing.quote_price` is the 4-piece rate, not the full ensemble rate. The same stale pricing appears in the prompt header. The LLM would present incorrect dollar amounts to the customer.
**Suggestion:** After `enrichClassification` overrides the format, re-run `lookupPrice(enriched)` if `enriched.format_recommended !== classification.format_recommended`. Alternatively, have `buildDualFormatBlock` look up the correct price directly from rate tables.

---

### [P2] Pipeline returns original classification, not enriched classification
**File:** `src/run-pipeline.ts:127`
**Issue:** Line 127 returns `classification` (original) rather than `enriched`. This means `past_date_detected`, overridden `format_recommended`, added `flagged_concerns` entries, and budget-driven `tier`/`close_type` overrides are all invisible to the CLI output and any downstream consumers. The CLI at `index.ts:59` checks `classification.past_date_detected`, but this is the un-enriched object, so the past-date warning never prints.
**Suggestion:** Change line 127 to return `enriched` instead of `classification`. Also update line 124 to use `enriched` for confidence scoring.

---

### [P2] Verify gate threshold was out of sync for 3 intermediate commits
**File:** `src/prompts/verify.ts:83`
**Issue:** Commits 2, 3, and 4 each added a new gut check but the threshold remained at "9 of 11" until commit 5 updated it to "12 of 14." Between these commits, the verify gate prompt was structurally inconsistent: the JSON schema listed 12-14 gut check fields but the pass condition still said "9 of 11."
**Suggestion:** Update the threshold atomically with each gut check addition. Consider computing the threshold dynamically: `Math.ceil(gutCheckCount * 0.86)` (gives 12 for 14 checks, 9 for 11). Express the ratio once, not hardcoded in prompt text.

---

### [P2] Implicit ordering dependency in enrichClassification
**File:** `src/pipeline/enrich.ts:23-50`
**Issue:** Format routing (lines 23-38) checks `classification.tier === "premium"` to identify corporate background events. Budget enrichment (lines 40-50) can override `tier` to `"qualification"`. The current order is correct, but this dependency is implicit. Reordering these blocks would silently break corporate-background detection for mariachi leads with large budget gaps.
**Suggestion:** Add a comment: `// NOTE: Format routing must run BEFORE budget enrichment — uses original LLM tier, not budget-adjusted tier.`

---

### [P3] Optional fields `event_energy` and `past_date_detected` create ambiguous states
**File:** `src/types.ts:42-43,50`
**Issue:** Both `event_date_iso` and `event_energy` are always produced by the LLM but declared optional (`?`). `past_date_detected` is only set to `true` in enrichment — never explicitly `false`. You cannot distinguish "enrichment ran, date was not past" from "enrichment never ran."
**Suggestion:** Remove `?` from `event_energy` and `event_date_iso`. For `past_date_detected`, set explicitly to `false` in enrichment when date is not past.

---

### [P3] `buildDualFormatBlock` uses sentinel values in `flagged_concerns` as control flow
**File:** `src/pipeline/enrich.ts:30-34` and `src/prompts/generate.ts:217,226`
**Issue:** The strings `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` are pushed into `flagged_concerns` by `resolveFormatRouting`, then checked with `.includes()` in generate.ts and verify.ts. These are machine-readable control flow signals masquerading as concerns. The `flagged_concerns` array is serialized into the prompt where the LLM sees raw strings like `"mention_4piece_alternative"` and is told to "address" them.
**Suggestion:** Separate control-flow flags from user-facing concerns. Consider adding a dedicated field like `format_routing_flag?: "anchor_high" | "mention_upgrade" | null` on Classification.

---

## Risk Assessment

| File | Commits (total) | Risk |
|------|-----------------|------|
| `src/prompts/generate.ts` | 16 | **High** — most-modified file, every feature touches it |
| `src/prompts/verify.ts` | 9 | **High** — growing rapidly (4 in this batch) |
| `src/pipeline/enrich.ts` | 3 | **Medium** — grew from 15 to 96 lines with implicit ordering |
| `src/utils/dates.ts` | 1 | **Low** — new, 8 lines, single-purpose |
| `src/pipeline/classify.ts` | 2 | **Low** — minimal logic, delegates to prompt + Claude call |
