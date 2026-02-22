# Review Summary — rubric-comparison-fixes

**Date:** 2026-02-21
**Agents run:** 9 (3 batches of 3)
**Total unique findings:** 27

---

## P1 — Critical (4)

### 1. Stale pricing after format routing override — wrong dollar amounts in drafts
**Found by:** architecture-strategist, git-history-analyzer, data-integrity-guardian, kieran-typescript, pattern-recognition
**File:** `src/run-pipeline.ts:84-94`, `src/prompts/generate.ts:220`
**Issue:** `lookupPrice(classification)` at run-pipeline.ts:84 computes pricing using the original `format_recommended` (e.g., `mariachi_4piece`). Then `enrichClassification` at line 94 overrides it to `mariachi_full`. But pricing is never recomputed. The generate prompt then tells the LLM "Lead with the full ensemble at $650" when the real full-ensemble rate is $1,650+. Customer-facing drafts would show incorrect dollar amounts.
**Suggestion:** Either (a) split enrichment into pre-price (format routing) and post-price (budget, past-date), running format routing before `lookupPrice`, or (b) re-run `lookupPrice(enriched)` if `format_recommended` changed after enrichment.

---

### 2. Non-enriched classification returned in pipeline output
**Found by:** data-integrity-guardian, architecture-strategist, performance-oracle, git-history-analyzer
**File:** `src/run-pipeline.ts:124-127`
**Issue:** Line 127 returns the original `classification` object, not `enriched`. This means: `past_date_detected` is always `undefined` in the output; `format_recommended` reflects the LLM's original pick (not the routing override); `flagged_concerns` is missing format concerns; `tier`/`close_type` are stale after budget enrichment. The CLI warning at `index.ts:59` (`if (classification.past_date_detected)`) never triggers. Line 124 also passes the stale object to `computeConfidence`.
**Suggestion:** Return `enriched` instead of `classification` on line 127. Pass `enriched` to `computeConfidence` on line 124.

---

### 3. "Today" computed independently in two pipeline stages — UTC timezone, clock-skew, untestable
**Found by:** kieran-typescript, pattern-recognition, code-simplicity, architecture-strategist
**File:** `src/pipeline/classify.ts:10`, `src/pipeline/enrich.ts:17`
**Issue:** Three problems in one:
1. **UTC timezone:** `new Date().toISOString().slice(0, 10)` returns UTC. At 11 PM Pacific, it returns tomorrow's date. The LLM gets the wrong "today" and past-date detection compares against the wrong day.
2. **Clock-skew:** Two independent `new Date()` calls in different pipeline stages could disagree if execution crosses midnight.
3. **Impurity:** `enrichClassification` reads the system clock despite its JSDoc claiming "Pure function." Neither function accepts `today` as a parameter, making deterministic testing impossible.

**Suggestion:** Compute today once at the pipeline entry point using Pacific time:
```typescript
// In runPipeline:
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
// "en-CA" produces YYYY-MM-DD format

const classification = await classifyLead(rawText, today);
const enriched = enrichClassification(classification, pricing, today);
```
This fixes all three problems. Update or remove the "pure function" JSDoc on `enrichClassification`.

---

### 4. No validation of `event_date_iso` from LLM — silent failures in date detection and format routing
**Found by:** pattern-recognition, architecture-strategist, security-sentinel, kieran-typescript
**File:** `src/pipeline/enrich.ts:15-21`, `src/utils/dates.ts:6-8`, `src/pipeline/classify.ts:17-28`
**Issue:** The LLM returns `event_date_iso` as a free-form string. If it returns `"March 22"` or `"TBD"`, `parseLocalDate` constructs `new Date("March 22T12:00:00")` which returns `Invalid Date`. The comparison `eventDate < today` silently returns `false` (past-date detection skipped). In `resolveFormatRouting`, `getDay()` on `Invalid Date` returns `NaN`, making `isWeekend` always `false` (incorrect format routing). The classify step validates 4 fields but not `event_date_iso` or `event_energy`.
**Suggestion:** Add validation at both layers:
```typescript
// In parseLocalDate (defensive):
const d = new Date(`${isoDate}T12:00:00`);
if (isNaN(d.getTime())) throw new Error(`Invalid ISO date: "${isoDate}"`);

// In classifyLead (trust boundary):
if (result.event_date_iso && !/^\d{4}-\d{2}-\d{2}$/.test(result.event_date_iso)) {
  console.warn(`Invalid event_date_iso: "${result.event_date_iso}" — treating as null`);
  result.event_date_iso = null;
}
```

---

## P2 — Important (10)

### 5. Optional (`?`) vs required-nullable (`| null`) type inconsistency on Classification
**Found by:** kieran-typescript, pattern-recognition, code-simplicity, architecture-strategist, git-history-analyzer
**File:** `src/types.ts:42-43,50`
**Issue:** New fields use `?` (optional) plus `| null`, creating three possible states: `undefined`, `null`, and a value. Existing fields like `stated_budget` use the `| null` convention (required, always present, sometimes null). The LLM always returns these fields (the classify prompt schema requires them), so `undefined` should never occur for LLM-returned fields.
**Suggestion:** Remove `?` from `event_date_iso` and `event_energy` (match `stated_budget` convention). Keep `past_date_detected?` optional since it is code-computed and genuinely absent until enrichment runs, or default it to `false`.

---

### 6. Magic string constants for `flagged_concerns` across 3 files
**Found by:** kieran-typescript, pattern-recognition, code-simplicity, architecture-strategist, git-history-analyzer
**File:** `src/pipeline/enrich.ts:32-34`, `src/prompts/generate.ts:217,226`, `src/prompts/verify.ts:171,176`
**Issue:** `"mention_4piece_alternative"` and `"mention_full_ensemble_upgrade"` are raw string literals produced in `enrich.ts` and consumed via `.includes()` in `generate.ts` and `verify.ts`. A typo in any file silently breaks the feature with no compiler protection. These are the first concerns produced by TypeScript code (not LLM), making the string-matching riskier than LLM-produced concerns. Git-history also notes these are control-flow signals masquerading as user-facing concerns.
**Suggestion:** Define as `as const` exports in `types.ts` and import everywhere. Consider a dedicated `format_routing_flag` field on Classification instead of overloading `flagged_concerns`.

---

### 7. Hardcoded "12 of 14" threshold in verify prompt
**Found by:** code-simplicity, architecture-strategist, data-integrity-guardian, git-history-analyzer, deployment-verification
**File:** `src/prompts/verify.ts:83`
**Issue:** The string `"At least 12 of 14 gut_checks"` is hardcoded. `index.ts` already computes the count dynamically via `Object.keys(checks).length`. Adding a 15th gut check requires manually updating the prompt — an easy-to-miss step. Git-history notes the threshold was out of sync for 3 intermediate commits during this feature.
**Suggestion:** Derive count and threshold from constants and interpolate: `At least ${threshold} of ${totalChecks} gut_checks`.

---

### 8. Implicit enrichment ordering dependency
**Found by:** pattern-recognition, git-history-analyzer
**File:** `src/pipeline/enrich.ts:24-50`
**Issue:** Format routing (lines 23-38) checks `tier === "premium"` to identify corporate background events. Budget enrichment (lines 40-50) can override `tier` to `"qualification"`. The current order is correct, but reordering would silently break corporate-background detection.
**Suggestion:** Add a comment: `// NOTE: Format routing must run BEFORE budget enrichment — uses original LLM tier, not budget-adjusted tier.`

---

### 9. LLM JSON output trusted without runtime schema validation
**Found by:** security-sentinel
**File:** `src/claude.ts:49`
**Issue:** `callClaude<T>` uses `JSON.parse(cleaned) as T` — a compile-time cast, not runtime check. If Claude returns structurally wrong JSON (missing fields, wrong types), the pipeline proceeds with a malformed object. If `gut_checks` is missing a key, the 12/14 threshold breaks. If `flagged_concerns` is a string instead of array, `.includes()` throws.
**Suggestion:** Add lightweight runtime checks for critical fields: validate `flagged_concerns` is an array, `gut_checks` has all expected keys.

---

### 10. Prompt injection via raw lead text
**Found by:** security-sentinel
**File:** `src/pipeline/classify.ts:12`
**Issue:** Raw lead text from stdin is embedded directly into the user message with no sanitization. A malicious lead could contain prompt injection to manipulate classification (e.g., forcing T1 tier). Real-world risk is low (leads come from booking platforms) and the verify gate provides defense-in-depth.
**Suggestion:** Add a `rawText` length cap (e.g., 5000 chars). Low priority given the threat model.

---

### 11. Prompt token growth — full Classification serialized into prompts
**Found by:** performance-oracle
**File:** `src/prompts/generate.ts:35`, `src/prompts/verify.ts:17`
**Issue:** The full Classification object (~25 fields, ~500 tokens pretty-printed) is serialized into both generate and verify prompts. The 5 new fields add ~50-80 tokens per prompt. In worst-case retry (3 generate + 3 verify), the extra tokens ship 6 times. Cost is ~$0.001/lead — negligible now but worth watching.
**Suggestion:** Consider serializing only the fields each prompt needs. Not urgent — simplicity of "dump whole object" has maintenance value.

---

### 12. Worst-case 7 LLM calls per lead due to stricter gut check threshold
**Found by:** performance-oracle, deployment-verification
**File:** `src/pipeline/verify.ts:25-55`, `src/prompts/verify.ts:83`
**Issue:** The 12/14 threshold (up from 9/11) is strictly harder. For leads that activate all three new dimensions, all 14 checks run and only 2 failures are tolerated. Each retry adds 2 API calls (generate + verify). Worst case: 7 calls, 14-28 seconds. The "Always true" no-ops for inactive checks should prevent false failures, but deployment monitoring is needed.
**Suggestion:** Monitor retry rate after deployment. If it increases, check which new gut checks fail and whether "Always true" no-ops trigger correctly.

---

### 13. Date calculations depend on deployment timezone
**Found by:** deployment-verification
**File:** `src/pipeline/enrich.ts:77`
**Issue:** The `parseLocalDate` noon-padding trick works for all US timezones but would produce wrong day-of-week results on a UTC cloud VM for dates near timezone boundaries.
**Suggestion:** Set `TZ=America/Los_Angeles` in the deployment environment if deploying to cloud. (Related to P1 #3 — fixing the UTC "today" issue also addresses this.)

---

### 14. Unit test uses fragile reference equality
**Found by:** deployment-verification
**File:** `src/enrich-generate.test.ts:58`
**Issue:** Test asserts `assert.equal(result, c)` (same object reference), but the new enrichment logic creates new objects in more cases now. Currently safe because test fixtures omit `event_date_iso`, but fragile for future changes.
**Suggestion:** Switch to `assert.deepEqual` or structural comparison.

---

## P3 — Minor (13)

### 15. Conditional spread readability in enrichClassification
**Found by:** kieran-typescript, pattern-recognition
**File:** `src/pipeline/enrich.ts:29-35`
**Issue:** `...(routing.show_alternative && { flagged_concerns: [...] })` nests a ternary inside an array spread inside a conditional spread inside an object spread. Four levels of nesting.
**Suggestion:** Split into two steps: set `format_recommended`, then `if (routing.show_alternative)` append the concern.

---

### 16. `resolveFormatRouting` return type annotation
**Found by:** kieran-typescript, code-simplicity
**File:** `src/pipeline/enrich.ts:61-62`
**Issue:** Inline return type `{ format_recommended: Format; show_alternative: boolean } | null` on a private helper. Kieran suggests extracting to a named type; simplicity suggests letting TypeScript infer it.
**Suggestion:** Either extract a `FormatRoutingResult` type or let inference handle it. Minor preference.

---

### 17. Friday-as-weekend needs documentation
**Found by:** pattern-recognition
**File:** `src/pipeline/enrich.ts:78`
**Issue:** `isWeekend` includes Friday (`day === 5`), which is domain-correct (mariachi demand) but not obvious.
**Suggestion:** Add comment: `// Fri-Sun: 4-piece not available (full ensemble demand)`.

---

### 18. `tier === "premium"` as proxy for "corporate" is imprecise
**Found by:** architecture-strategist
**File:** `src/pipeline/enrich.ts:86-88`
**Issue:** Premium tier also matches luxury weddings and quinceañeras, not just corporate. Reasonable heuristic for now but could mis-route.
**Suggestion:** Add a code comment acknowledging the limitation.

---

### 19. Builder function naming inconsistency
**Found by:** pattern-recognition
**File:** `src/prompts/verify.ts:158,169,186`
**Issue:** Existing: `buildBudgetAcknowledgedInstruction` (matches gut check key). New: `buildPastDateInstruction` (missing "Acknowledged"). Minor naming drift.
**Suggestion:** Standardize to `build<GutCheckKey>Instruction` in camelCase.

---

### 20. Hardcoded phone number in source code
**Found by:** security-sentinel
**File:** `src/pipeline/generate.ts:18`
**Issue:** Business phone `(619) 755-3246` hardcoded in `CONTACT_BLOCK`. Not a secret, but updating requires a code change.
**Suggestion:** Move to config or env var. Low priority.

---

### 21. Error message leaks raw LLM response on JSON parse failure
**Found by:** security-sentinel
**File:** `src/claude.ts:62`
**Issue:** On JSON parse failure, error includes full raw LLM response, which could contain system prompt fragments (pricing tables, rate tiers). Low risk in CLI, higher in future server deployment.
**Suggestion:** Truncate raw response in error to first 200 chars.

---

### 22. No stdin input length limit
**Found by:** security-sentinel
**File:** `src/index.ts:16-20`
**Issue:** Pipeline reads all of stdin with no size guard. Extremely large input could cause memory exhaustion or oversized API calls.
**Suggestion:** Add a size guard (e.g., 10,000 chars max).

---

### 23. `flagged_concerns` no deduplication guard
**Found by:** security-sentinel, architecture-strategist, deployment-verification
**File:** `src/pipeline/enrich.ts:30-36`
**Issue:** Concerns appended via spread without checking for duplicates. If `enrichClassification` were called twice (future retry path), duplicates would accumulate. No active bug currently.
**Suggestion:** Check `!enriched.flagged_concerns.includes(concern)` before appending.

---

### 24. Three sequential object spreads in enrichClassification
**Found by:** code-simplicity, performance-oracle
**File:** `src/pipeline/enrich.ts:12-50`
**Issue:** Up to 3 shallow copies of Classification (~25 fields). Negligible performance impact (<0.01ms vs 2-4s API calls). The "one spread per concern" pattern is readable.
**Suggestion:** No action needed. Only revisit if Classification grows to 100+ fields.

---

### 25. Classify prompt leaks "Code may override" implementation detail
**Found by:** code-simplicity
**File:** `src/prompts/classify.ts:91`
**Issue:** The classify prompt tells the LLM "Code may override to mariachi_4piece for weekday corporate background events." The LLM doesn't act on this — its job is classifying `event_energy`.
**Suggestion:** Simplify to just the classification instruction. Remove the implementation leak.

---

### 26. `buildVerifyPrompt` takes `pricing` as optional but gut checks depend on it
**Found by:** architecture-strategist
**File:** `src/prompts/verify.ts:10`
**Issue:** `pricing` is optional, masking a real dependency. `mariachi_pricing_format` depends on `flagged_concerns`, which depends on enrichment, which depends on pricing.
**Suggestion:** Make `pricing` required.

---

### 27. Duration "4" valid in type but missing from most rate tables
**Found by:** data-integrity-guardian
**File:** `src/types.ts:36`, `src/data/rates.ts`
**Issue:** `duration_hours` accepts `4` but only `mariachi_full` has a "4" duration key. If LLM classifies a solo lead as 4 hours, `lookupPrice` will throw.
**Suggestion:** Add format-specific duration constraints to the classify prompt.

---

## Batch Coverage

| Batch | Agent | Findings |
|-------|-------|----------|
| batch1 | kieran-typescript-reviewer | 10 |
| batch1 | pattern-recognition-specialist | 11 |
| batch1 | code-simplicity-reviewer | 10 |
| batch2 | architecture-strategist | 12 |
| batch2 | security-sentinel | 8 |
| batch2 | performance-oracle | 7 |
| batch3 | data-integrity-guardian | 8 |
| batch3 | git-history-analyzer | 6 |
| batch3 | deployment-verification-agent | 7 |

**Total raw findings:** 79
**After deduplication:** 27

---

## Three Questions

### 1. Hardest judgment call in this review?

Severity assignment for finding #3 ("today" computed independently). Three agents called it P1, one called it P2. The UTC timezone bug means past-date detection and the LLM's "today" are wrong after 5 PM Pacific — that's a real correctness issue, not just a testability concern. But the pipeline currently runs in San Diego during business hours, so the bug rarely activates. I went P1 because the failure is silent and the fix is simple (one helper function). A bug that's hard to detect and easy to fix should be fixed, not rationalized.

### 2. What did you consider flagging but chose not to, and why?

The pattern-recognition agent flagged "Deterministic code over LLM for objective checks" as a **positive** finding — the architecture of moving date comparisons and format routing into TypeScript instead of prompts. I considered elevating this to the summary as a design principle recommendation, but the REVIEW-SUMMARY format is for issues, not commendations. It's worth noting in a future CLAUDE.md or PATTERNS.md update.

I also considered upgrading the "prompt injection via raw lead text" (#10) to P1, but the threat model doesn't support it — leads come from booking platforms, not adversarial users, and the verify gate catches classification anomalies. The security-sentinel agent correctly assessed this as low real-world risk.

### 3. What might this review have missed?

- **End-to-end behavior with real leads:** No agent ran the pipeline against the 4 test leads to verify the new gut checks pass. The deployment-verification agent created a checklist but didn't execute it.
- **Rate table correctness:** Finding #1 (stale pricing) was identified structurally, but no agent verified the actual dollar amounts in `src/data/rates.ts` for `mariachi_full` vs `mariachi_4piece`.
- **Accessibility and i18n:** Not applicable for a CLI tool, but the cultural vocabulary feature (Nochebuena, Las Mañanitas) was not reviewed for cultural accuracy — only for code quality.
- **Logging and observability:** No agent checked whether the pipeline logs enough information to debug issues in production (e.g., which enrichment steps fired, what the original vs enriched classification looked like).
- **Error recovery:** No agent analyzed what happens when a single pipeline stage throws — does the error propagate cleanly, or does it leave partial state?
