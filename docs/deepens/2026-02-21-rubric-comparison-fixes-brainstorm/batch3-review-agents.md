# Batch 3 — Review Agent Findings

**Date:** 2026-02-21
**Agents run:** 14
**Agents with findings:** 13

---

## kieran-typescript-reviewer

**Type:** compound-engineering:review:kieran-typescript-reviewer
**Findings:**

### CRITICAL: Fix 1 asks the LLM to do date comparison — should be TypeScript
**Severity:** P1
**Applies to:** Fix 1 (Past-Date Detection)
**Issue:** The brainstorm says the classify prompt checks if the event date has passed. But date comparison is deterministic — LLMs are unreliable at date math. The batch2 research already contradicts this: "Deterministic checks belong in code, not in prompts."
**Suggestion:** Have the LLM extract `event_date_iso: string | null` (it already parses dates for `timeline_band`). TypeScript computes `past_date_detected` after classification returns, same pattern as `detectBudgetGap` runs after `lookupPrice`.

### WARNING: Fix 1 and Fix 2 share a hidden dependency on `event_date_iso`
**Severity:** P1
**Applies to:** Fix 1 + Fix 2
**Issue:** Fix 1 needs `event_date_iso` for past-date detection. Fix 2 needs it for day-of-week computation. Neither fix calls this out as a shared dependency. The Classification type currently has no `event_date_iso` field.
**Suggestion:** Add `event_date_iso: string | null` to Classification as a prerequisite for both fixes. Note this in the plan as Step 0.

### WARNING: Fix 2 bundles two independent features
**Severity:** P2
**Applies to:** Fix 2 (Anchor-High Mariachi Pricing)
**Issue:** Fix 2 combines (a) format routing correction and (b) dual-format presentation. These touch different files (classify.ts vs generate.ts), serve different purposes, and can be tested independently.
**Suggestion:** Split Fix 2 into Phase A (routing rules in classify) and Phase B (dual-format generate prompt injection).

### UTC timezone pitfall on `new Date()`
**Severity:** P2
**Applies to:** Fix 1 + Fix 2
**Issue:** `new Date("2026-03-14")` parses as UTC midnight, which becomes the previous calendar day in US Pacific time. Christmas Eve 2025 becomes December 23 — wrong day-of-week.
**Suggestion:** Shared utility: `function parseLocalDate(isoDate: string): Date { return new Date(\`${isoDate}T12:00:00\`); }`

### Fix 2 signal routing needs explicit word lists
**Severity:** P2
**Applies to:** Fix 2
**Issue:** "Background" vs "entertainment" vs "participatory" are vague categories. Without explicit signal words, the LLM makes holistic judgments from implicit tone — the same failure mode the brainstorm is trying to fix.
**Suggestion:** List concrete signal words: `Background: "cocktail hour", "ambient", "dinner music"`. `Performance: "entertainment", "high energy", "Las Mananitas", "serenade"`.

### Fix 3 vocab table has a factual error
**Severity:** P3
**Applies to:** Fix 3 (Cultural Vocabulary Mapping)
**Issue:** "Godmother celebration → Quinceañera" is wrong. A quinceañera is a girl's 15th birthday celebration, not a "godmother celebration."
**Suggestion:** Change to "15th birthday celebration → Quinceañera"

### Fix 3 relationship with existing CULTURAL_SPANISH_LATIN.md unclear
**Severity:** P3
**Applies to:** Fix 3
**Issue:** The context pipeline already injects `CULTURAL_SPANISH_LATIN.md` when cultural context is active. The new few-shot examples add a second set of vocabulary instructions. The plan should clarify: is the context doc being replaced, supplemented, or made subordinate?
**Suggestion:** State explicitly: the context doc provides general cultural framing, the new few-shot examples enforce vocabulary precision. Update the "See CULTURAL_SPANISH_LATIN.md" pointer to be consistent with the inline approach.

### Open Question 2 is answered by the research
**Severity:** P3
**Applies to:** General
**Issue:** "Does the pipeline parse day-of-week?" — No, it does not. The research provides the implementation pattern. Mark as resolved in the plan.

---

## pattern-recognition-specialist

**Type:** compound-engineering:review:pattern-recognition-specialist
**Findings:**

### Fix 1 offloads date comparison to the LLM — fragile anti-pattern
**Severity:** P1
**Applies to:** Fix 1
**Issue:** `past_date_detected` is a binary yes/no with a hard boundary (today). Getting this wrong means either generating a date-clarification line for a future event (embarrassing) or missing a past date (the original bug).
**Suggestion:** Compute in TypeScript. The email parser already extracts `event_date` as a string. Parse into Date, compare against `new Date()`, stamp the boolean onto classification in `run-pipeline.ts` (same location where `platform` is stamped on line 74).

### Fix 2 mixes operational constraint with LLM classification
**Severity:** P2
**Applies to:** Fix 2
**Issue:** "4-piece is weekday only" is a hard operational constraint. Putting it in prompt instructions is fragile — the LLM may not follow it consistently.
**Suggestion:** Split: (1) classifier sets `format_recommended` based on genre/cultural signals, (2) post-classification override in TypeScript (same pattern as `enrichClassification()`) forces `mariachi_full` on Fri-Sun.

### Dual-format presentation has no type support
**Severity:** P2
**Applies to:** Fix 2
**Issue:** `Classification` has a single `format_recommended: Format`. No mechanism to express "recommend full ensemble, also offer 4-piece." The verify gate can't validate a dual-format draft without structured data.
**Suggestion:** Add `alternative_format` field to Classification or PricingResult, mirroring `scoped_alternative` in BudgetGapResult.

### Date parsing duplication risk
**Severity:** P3
**Applies to:** Fix 1 + Fix 2
**Issue:** Both fixes need date parsing. Risk of two independent implementations drifting.
**Suggestion:** Create shared `parseEventDate(dateString: string): Date | null` utility. The email parser extracts a raw string, not a Date object — one conversion point serves both fixes.

### Cultural vocabulary injection duplicates context pipeline
**Severity:** P3
**Applies to:** Fix 3
**Issue:** Cultural content will be injected in two places: the context string via `context.ts` and the generate prompt. The conditional check (`cultural_context_active && cultural_tradition === "spanish_latin"`) is duplicated.
**Suggestion:** Document that cultural knowledge now lives in two places. Future changes must update both.

### Holiday contradiction in Fix 2
**Severity:** P2
**Applies to:** Fix 2
**Issue:** The brainstorm says "holiday premium is a separate feature" but includes holidays in the routing condition ("if Friday-Sunday OR holiday"). This means holiday detection IS needed for routing, even if pricing is deferred.
**Suggestion:** Resolve: either implement holiday detection now (for routing) or remove holidays from the routing rule.

### Existing bug: `run-pipeline.ts` uses `classification` instead of `enriched`
**Severity:** P3
**Applies to:** General (existing, pre-brainstorm)
**Issue:** Line 124 passes original `classification` to `computeConfidence`, and line 127 includes it in `PipelineOutput`. If enrichment changed `tier`, confidence uses stale data.
**Suggestion:** Track for future fix. Will compound as more enrichment steps are added.

---

## architecture-strategist

**Type:** compound-engineering:review:architecture-strategist
**Findings:**

### Fix 2 challenges the single-format pipeline assumption
**Severity:** P1
**Applies to:** Fix 2
**Issue:** The pipeline assumes one format, one price, one draft. Dual-format presentation requires rethinking PricingResult and the verify gate. Three options: (a) prompt-only with `alternate_format` field, (b) multi-format pipeline (too large), (c) LLM handles in prompt (architecture regression).
**Suggestion:** Option (a) — add `alternate_format_pricing: { format: Format, quote_price: number } | null` to PricingResult. Mirrors the existing `scoped_alternative` pattern.

### `buildClassifyPrompt()` takes zero arguments — Fix 1 breaks this
**Severity:** P2
**Applies to:** Fix 1
**Issue:** Injecting today's date forces `buildClassifyPrompt()` to accept parameters. This propagates to `classifyLead` and `runPipeline`.
**Suggestion:** `buildClassifyPrompt(today: string)` — pass from runPipeline. Keeps prompt builders pure and testable. A default of `new Date().toISOString().slice(0, 10)` at the runPipeline call site.

### Classification type is growing — consider sub-objects
**Severity:** P3
**Applies to:** General
**Issue:** Adding `past_date_detected` (Fix 1) + potentially `day_of_week` or `is_weekday` (Fix 2) continues expanding a 25+ field type. Risk of "classification bag."
**Suggestion:** Consider `temporal: { timeline_band, past_date_detected, day_of_week }` sub-object for readability if the type keeps growing.

### Fix 2 signal-based routing should be deterministic post-classification
**Severity:** P2
**Applies to:** Fix 2
**Issue:** Adding multi-signal routing logic to the classify prompt makes it longer and harder to debug. The LLM classifies signals, but code should apply rules.
**Suggestion:** Add `resolveFormatRouting()` in enrich.ts that takes classification + event date and applies day-of-week + signal rules deterministically. The classify prompt stays focused on signal extraction.

### Fix 3 — split vocab table from few-shot examples
**Severity:** P3
**Applies to:** Fix 3
**Issue:** Vocab table is reference material (better in context.ts). Few-shot examples are prompt instruction (better in generate.ts).
**Suggestion:** Put vocab table in `docs/VOCAB_SPANISH_LATIN.md` injected via context.ts. Keep few-shot examples inline in generate.ts.

---

## code-simplicity-reviewer

**Type:** compound-engineering:review:code-simplicity-reviewer
**Findings:**

### Fix 2 signal hierarchy is over-engineered
**Severity:** P1
**Applies to:** Fix 2
**Issue:** The 6-row signal hierarchy table resolves to: "default is full ensemble for everything except weekday corporate background or low-key signals." That is one rule, not six rows. Five of six rows resolve to the same answer (full ensemble).
**Suggestion:** Replace with: "Default full ensemble. Exception: weekday + corporate background or low-key signals → 4-piece." Two lines instead of a 6-row table.

### Fix 2 dual-format presentation has 4 unnecessary branches
**Severity:** P2
**Applies to:** Fix 2
**Issue:** Four scenarios for when to show both options is four branches of display logic. Simpler: the pipeline picks ONE format, the generate prompt always has one instruction mentioning the other format briefly.
**Suggestion:** One sentence: "If recommending mariachi_full, mention 4-piece as a more intimate option (weekday only). If recommending mariachi_4piece, mention full ensemble as an upgrade."

### Fix 3 vocab table is redundant with few-shot examples
**Severity:** P2
**Applies to:** Fix 3
**Issue:** The few-shot examples already cover Nochebuena, Las Mañanitas, and Serenata. The brainstorm says "few-shot examples teach the principle so Claude can generalize." If true, the table is unnecessary. Quinceañera is already in the classify prompt.
**Suggestion:** Ship few-shot examples only. Add vocab table later only if Claude still picks wrong terms.

### Estimated complexity reduction
**Severity:** P2
**Applies to:** General
**Issue:** Total ~50-65 lines never written if simplified: 20-30 lines of classify prompt signal table, 15-20 lines of conditional generate branches, 10-15 lines of vocab table.
**Suggestion:** Apply simplifications before planning phase.

---

## performance-oracle

**Type:** compound-engineering:review:performance-oracle
**Findings:**

### Token cost is amplified by the retry loop (acceptable)
**Severity:** P3
**Applies to:** Fix 3 primarily
**Issue:** Fix 3 adds ~300 tokens conditionally on cultural leads. In worst case (3 retries), that's 900 extra input tokens per run. At Sonnet pricing, ~$0.003 per cultural lead. Latency: ~600ms total across 3 retries.
**Suggestion:** Acceptable. No action needed.

### No new API calls — positive confirmation
**Severity:** P3 (positive)
**Applies to:** All fixes
**Issue:** All three fixes modify prompt content within existing API calls. Pipeline call count unchanged (3-7 calls per run).
**Suggestion:** None needed. This is the most important performance property.

### Use ISO date format for Fix 1 injection
**Severity:** P3
**Applies to:** Fix 1
**Issue:** Verbose format like "Friday, February 21, 2026" wastes ~5 tokens vs ISO `2026-02-21`.
**Suggestion:** Use ISO date format. Small savings, but worth being deliberate.

### Fix 2 new Classification fields need validation
**Severity:** P3
**Applies to:** Fix 2
**Issue:** If new fields are added to Classification JSON output but not validated in `classify.ts`, missing field validation triggers JSON parse retries in `callClaude`, doubling the classify API call.
**Suggestion:** Add new fields to the validation checks in `pipeline/classify.ts` (lines 16-24).

---

## security-sentinel

**Type:** compound-engineering:review:security-sentinel
**Findings:**

### Indirect prompt injection via lead text (pre-existing)
**Severity:** P2
**Applies to:** All fixes (pre-existing risk)
**Issue:** Lead text is untrusted input concatenated directly into Claude prompts. A crafted lead could manipulate classification. Fix 3's cultural vocabulary injection depends on classification flags derived from untrusted input.
**Suggestion:** Acknowledge the risk. Consider a TypeScript-side keyword check as secondary gate before injecting cultural vocabulary. Current mitigation: human review before sending.

### Date parsing manipulation (edge cases)
**Severity:** P3
**Applies to:** Fix 1, Fix 2
**Issue:** Ambiguous dates ("March 14" without year, "02/03/2026" MM/DD vs DD/MM) could be misclassified. Not a new attack surface — same ambiguity Claude already handles.
**Suggestion:** Use unambiguous ISO format `2026-02-21 (Friday)` when injecting today's date.

### Existing: unauthenticated `/api/analyze` endpoint
**Severity:** P2
**Applies to:** Existing (not plan-specific)
**Issue:** No auth or rate limiting. Anyone discovering the URL can make unlimited Claude API calls.
**Suggestion:** Add basic auth or rate limiter. Not blocking for this plan but worth tracking.

### Existing: dashboard auth bypass when env vars missing
**Severity:** P2
**Applies to:** Existing (not plan-specific)
**Issue:** If `DASHBOARD_USER`/`DASHBOARD_PASS` not set, dashboard is fully open.
**Suggestion:** Default to "locked out" when credentials not set.

---

## agent-native-reviewer

**Type:** compound-engineering:review:agent-native-reviewer
**Findings:**

### Fix 1 `past_date_detected` invisible in formatted CLI output
**Severity:** P2
**Applies to:** Fix 1
**Issue:** The flag is in JSON output (`--json` mode) but not in the default formatted CLI output. The CLASSIFICATION SUMMARY block (lines 48-60 of index.ts) has no line for it.
**Suggestion:** Add: `if (classification.past_date_detected) console.log('** WARNING: Event date appears to be in the past **');`

### Fix 2 format routing reasoning is opaque
**Severity:** P2
**Applies to:** Fix 2
**Issue:** Only the final `format_recommended` value is visible. No field shows what signals drove the decision. Debugging wrong format routing requires re-reading the lead and guessing.
**Suggestion:** Add `format_routing_signals: string[]` to Classification (mirrors existing `stealth_premium_signals` pattern).

### Fix 2 dual-format has no structured representation
**Severity:** P3
**Applies to:** Fix 2
**Issue:** Alternative format/price only exists as prose in the draft. No structured field for programmatic consumers.
**Suggestion:** Add optional `alternative_quote?: { format: Format, price: number }` to PricingResult. Low priority.

### Existing: budget fields not in formatted CLI output
**Severity:** P3
**Applies to:** Existing (not plan-specific)
**Issue:** `stated_budget` and `pricing.budget.tier` have no formatted output lines. Same gap as Fix 1.
**Suggestion:** Print budget info in the PRICING section of formatted output.

---

## dhh-rails-reviewer

**Type:** compound-engineering:review:dhh-rails-reviewer
**Findings:**

### Fix 2 — building a rules engine in a prompt
**Severity:** P1
**Applies to:** Fix 2
**Issue:** Replacing one line of format routing with (1) day-of-week parsing, (2) holiday detection, (3) 6-row signal hierarchy, and (4) three-way presentation logic — four interlocking decision systems for ONE format choice. Setting a precedent for every format needing its own signal hierarchy.
**Suggestion:** Simplify to: `if (weekend or holiday) → mariachi_full (only option). if (weekday) → mariachi_full (default high, let them choose down).` That is the entire fix. The brainstorm's own default for "no signals" is already full ensemble.

### Fix 2 — day-of-week is deterministic code, not LLM judgment
**Severity:** P2
**Applies to:** Fix 2
**Issue:** Asking Claude to determine what day of the week December 24, 2025 falls on. Claude will get this wrong. It is a date calculation.
**Suggestion:** Compute in TypeScript, pass as `is_weekend: boolean` into the prompt or enrichment step.

### Fix 2 — holiday contradiction
**Severity:** P2
**Applies to:** Fix 2
**Issue:** "Holiday premium is a separate feature" but the routing condition includes holidays. Either implement detection now or remove from routing.
**Suggestion:** Remove holidays from routing rule for now. Add when you have real data.

### Fix 3 — vocab table will grow forever
**Severity:** P3
**Applies to:** Fix 3
**Issue:** Five entries today, ten next month. The few-shot examples teach the PRINCIPLE. The table is training wheels.
**Suggestion:** Ship few-shot examples. Add vocab table only if needed.

---

## data-integrity-guardian

**Type:** compound-engineering:review:data-integrity-guardian
**Findings:**

### `past_date_detected` must be optional for backward compat
**Severity:** P2
**Applies to:** Fix 1
**Issue:** Existing `classification_json` blobs in SQLite lack this field. `JSON.parse` produces `undefined`, not `false`. Code doing `=== false` will behave differently from `!classification.past_date_detected`.
**Suggestion:** Declare as `past_date_detected?: boolean`. All downstream code uses `?? false`. Only one deserialization site today: `twilio-webhook.ts` line 133.

### Format routing changes — reprocessing produces different prices
**Severity:** P3
**Applies to:** Fix 2
**Issue:** Reprocessing a lead from scratch with new routing logic could produce different `format_recommended` and different price. Edit pipeline is safe (reuses stored classification).
**Suggestion:** Acceptable. Document in plan: new routing applies to future runs. Edit pipeline preserves original classification.

### Dashboard shows `undefined` for new fields on old leads
**Severity:** P3
**Applies to:** Fix 1
**Issue:** `classification.past_date_detected` will be `undefined` in dashboard display for pre-existing leads.
**Suggestion:** Add `?? false` fallback in dashboard rendering.

---

## deployment-verification-agent

**Type:** compound-engineering:review:deployment-verification-agent
**Findings:**

### No deployment blockers
**Severity:** P3 (positive)
**Applies to:** All fixes
**Issue:** This is a CLI tool. Deployment = git push + `npx tsx src/index.ts`. No migration, no server restart, no persistent state at risk. Rollback = `git checkout <sha>`.
**Suggestion:** None needed. Provided testing checklist for the 4 existing test leads plus boundary verification queries.

---

## data-migration-expert

**Type:** compound-engineering:review:data-migration-expert
**Findings:**

### No SQLite migration needed — confirmed safe
**Severity:** P3 (positive)
**Applies to:** All fixes
**Issue:** `classification_json` is a TEXT blob. New fields appear in JSON strings automatically. No `ALTER TABLE` needed.
**Suggestion:** None.

### Use optional `?` for `past_date_detected`
**Severity:** P2
**Applies to:** Fix 1
**Issue:** Same as data-integrity-guardian finding. Old records lack the field. Optional modifier forces compiler to handle the missing case.
**Suggestion:** `past_date_detected?: boolean` + `?? false` at all usage sites.

---

## julik-frontend-races-reviewer

**Type:** compound-engineering:review:julik-frontend-races-reviewer
**Findings:**

### No race conditions found
**Severity:** P3 (positive)
**Applies to:** All fixes
**Issue:** Pipeline is strictly sequential (classify → price → enrich → context → generate → verify). Each stage `await`s the previous. Zero concurrency.
**Suggestion:** If Fix 1 adds date injection, capture the date once at the top of `runPipeline` and pass it down. Never call `new Date()` separately in each prompt builder.

### `pricing.budget` mutation is a consistency note
**Severity:** P3
**Applies to:** Existing
**Issue:** `lookupPrice` returns a PricingResult, then `run-pipeline.ts` mutates `.budget`. Not a race today, but inconsistent with the plan's immutability principles.
**Suggestion:** Use spread: `const pricing = { ...basePricing, budget: budgetGap }`.

---

## kieran-rails-reviewer

**Type:** compound-engineering:review:kieran-rails-reviewer
**Findings:**

### `enrichClassification` shallow copy shares array references
**Severity:** P2
**Applies to:** Existing (affects Fix 1 + Fix 2)
**Issue:** The spread operator in `enrichClassification` creates a shallow copy. `Classification` has three array fields (`stealth_premium_signals`, `context_modifiers`, `flagged_concerns`). If downstream code mutates these arrays on the enriched object, it corrupts the original.
**Suggestion:** Either document the constraint or deep-copy arrays in the spread.

### `pricing.budget` mutation contradicts pure function principle
**Severity:** P3
**Applies to:** Existing
**Issue:** Plan emphasizes pure functions, but `pricing.budget` is mutated in place.
**Suggestion:** `const pricing = { ...basePricing, budget: budgetGap }`.

### `findScopedAlternative` near-miss tolerance diverges from plan
**Severity:** P3
**Applies to:** Existing
**Issue:** Plan says `scoped_floor <= stated_budget`. Code uses `NEAR_MISS_TOLERANCE = 75`. Client who says "$400" could be offered $474. Plan is stale on this point.
**Suggestion:** Update plan to reflect actual near-miss tolerance.

### `no_viable_scope` may trigger `prose_flows` gut check failures
**Severity:** P2
**Applies to:** Existing (budget feature)
**Issue:** A 50-75 word warm redirect structured as four numbered points will likely fail "reads as one continuous movement" check. The plan acknowledges the risk but offers no mitigation.
**Suggestion:** Add targeted verifier instruction for `no_viable_scope` context.

---

## kieran-python-reviewer

**Type:** compound-engineering:review:kieran-python-reviewer
**Findings:**

### `findMinFloor` does not handle empty rate table
**Severity:** P3
**Applies to:** Existing
**Issue:** If `tier_key` has no rates, returns `{ min_floor: Infinity, min_duration: 0 }`. Prompt would contain "$Infinity for 0hr."
**Suggestion:** Add guard: `if (min_floor === Infinity) throw new Error(...)`.

### `PipelineOutput.classification` leaks un-enriched version
**Severity:** P2
**Applies to:** Existing
**Issue:** Stored classification has `tier: "standard"` even when the draft was generated under `tier: "qualification"` rules. Deliberate but should be documented explicitly.
**Suggestion:** Add comment in plan and code: "We intentionally store original classification. Enrichment is implicit in `pricing.budget.tier`."

---

## Consolidated Finding Summary

| # | Severity | Fix | Finding | Sources (agents that flagged it) |
|---|----------|-----|---------|----------------------------------|
| 1 | P1 | Fix 1 | Date comparison must be in TypeScript, not LLM | kieran-ts, pattern-recognition, dhh, architecture |
| 2 | P1 | Fix 1+2 | Shared `event_date_iso` dependency not identified | kieran-ts, pattern-recognition |
| 3 | P1 | Fix 2 | Signal hierarchy is over-engineered (6 rows → 1 rule) | code-simplicity, dhh |
| 4 | P2 | Fix 2 | Operational constraints (weekday-only) should be deterministic code | pattern-recognition, dhh, architecture |
| 5 | P2 | Fix 2 | Dual-format breaks single-format pipeline assumption | architecture, pattern-recognition, agent-native |
| 6 | P2 | Fix 2 | Holiday contradiction (deferred but in routing condition) | pattern-recognition, dhh |
| 7 | P2 | Fix 2 | Fix 2 bundles two independent features | kieran-ts |
| 8 | P2 | Fix 1 | `past_date_detected` must be optional for backward compat | data-integrity, data-migration |
| 9 | P2 | Fix 1 | Flag not in formatted CLI output | agent-native |
| 10 | P2 | Fix 2 | Format routing signals are opaque — no traceability | agent-native |
| 11 | P2 | Fix 1+2 | UTC timezone pitfall on `new Date()` | kieran-ts |
| 12 | P2 | Fix 3 | Vocab table redundant with few-shot examples | code-simplicity, dhh |
| 13 | P3 | Fix 3 | Factual error: quinceañera ≠ "godmother celebration" | kieran-ts |
| 14 | P3 | Fix 3 | Cultural knowledge split across two injection points | pattern-recognition, kieran-ts |
| 15 | P3 | General | Performance impact acceptable (~$0.003/cultural lead) | performance-oracle |
| 16 | P3 | General | No deployment blockers, no SQLite migration needed | deployment, data-migration |
| 17 | P3 | General | No race conditions | julik-races |
